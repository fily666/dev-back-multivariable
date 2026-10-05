import { GLOBAL_AREA_CODE } from '../../common/constants';
import type { RawAnswerRow } from '../indicators/indicator.types';
import type { QualityPayload } from '../dto/analytics.dto';
import { percent } from './monitoring.kpi';

/**
 * Menos de 5 minutos es un tercio de los 15 para los que se diseñó la encuesta: no alcanza
 * para leer las preguntas. El límite es excluido: quien tardó justo 300 s no cuenta.
 */
export const SPEEDER_THRESHOLD_SECONDS = 300;

/**
 * Ítems globales que hacen falta para declarar una respuesta "en línea recta". Con pocos,
 * dar la misma nota a todo puede ser una opinión coherente; con diez o más repartidos en seis
 * componentes que preguntan cosas distintas, lo probable es que no se hayan leído.
 */
export const STRAIGHT_LINE_MIN_ITEMS = 10;

/** Ítems de un mismo componente que hacen falta para declararlo plano. */
export const FLAT_COMPONENT_MIN_ITEMS = 3;

/**
 * Los componentes con baterías 0-10 globales. Quedan fuera C1 y C10, que no tienen escalas,
 * y C2 y C9, que se califican por área: dar la misma nota a todas las áreas evaluadas puede
 * ser una opinión legítima sobre ellas, no una señal de no haber leído.
 */
export const QUALITY_COMPONENT_IDS: readonly number[] = [3, 4, 5, 6, 7, 8];

/** La pregunta abierta final: escribir en ella es la señal más clara de implicación. */
export const OPEN_ANSWER_CODE = 'c10_cambio_unico';

/** Una completada del corte, con lo justo para medir la velocidad. */
export interface QualityResponse {
  id: string;
  durationSeconds: number | null;
}

/** Pregunta 0-10 del catálogo; solo importa a qué componente pertenece. */
export interface QualityScaleItem {
  code: string;
  componentId: number;
}

export interface QualityComponent {
  id: number;
  title: string;
}

/** Respuesta con texto y la opción a la que acompaña. */
export interface QualityTextAnswer {
  responseId: string;
  questionCode: string;
  valueOption: string | null;
  valueOptions: string[];
  valueText: string | null;
}

export interface QualityInput {
  /** Las completadas del corte: el denominador de todo el payload. */
  responses: QualityResponse[];
  scaleRows: RawAnswerRow[];
  scaleItems: QualityScaleItem[];
  components: QualityComponent[];
  textAnswers: QualityTextAnswer[];
  /** Las opciones tipo "Otra: ____" (`allowsText`), por pregunta. */
  textOptions: { questionCode: string; value: string }[];
}

function hasText(text: string | null): boolean {
  return (text?.trim().length ?? 0) > 0;
}

function allIdentical(values: number[]): boolean {
  return values.every((value) => value === values[0]);
}

/**
 * Las notas 0-10 globales de cada completada, agrupadas por componente. Solo cuentan los
 * ítems de `QUALITY_COMPONENT_IDS` y las respuestas que están en el corte.
 */
function globalValuesByResponse(
  input: QualityInput,
  completedIds: Set<string>,
): Map<string, Map<number, number[]>> {
  const componentOf = new Map(
    input.scaleItems
      .filter((item) => QUALITY_COMPONENT_IDS.includes(item.componentId))
      .map((item) => [item.code, item.componentId]),
  );
  const byResponse = new Map<string, Map<number, number[]>>();

  for (const row of input.scaleRows) {
    if (row.targetArea !== GLOBAL_AREA_CODE || row.valueNumber === null)
      continue;
    if (!completedIds.has(row.responseId)) continue;
    const componentId = componentOf.get(row.questionCode);
    if (componentId === undefined) continue;

    const components =
      byResponse.get(row.responseId) ?? new Map<number, number[]>();
    const values = components.get(componentId) ?? [];
    values.push(row.valueNumber);
    components.set(componentId, values);
    byResponse.set(row.responseId, components);
  }

  return byResponse;
}

/**
 * Qué tanto se puede confiar en el corte: cuántos respondieron demasiado rápido, cuántos
 * dieron la misma nota a todo y cuántos se tomaron el trabajo de escribir.
 *
 * Son señales, no un filtro: nada se descarta de los indicadores. Una persona que de verdad
 * piensa que todo está en 8 responde igual que una que no leyó, y el panel no puede
 * distinguirlas; lo que sí puede es decir cuánto pesa ese patrón en el corte.
 */
export function buildQuality(input: QualityInput): QualityPayload {
  const { responses, components, textAnswers, textOptions } = input;
  const completed = responses.length;
  const completedIds = new Set(responses.map((response) => response.id));

  const durations = responses
    .map((response) => response.durationSeconds)
    .filter((seconds): seconds is number => seconds !== null);
  const speeders = durations.filter(
    (seconds) => seconds < SPEEDER_THRESHOLD_SECONDS,
  ).length;

  const valuesByResponse = globalValuesByResponse(input, completedIds);

  let straightLiners = 0;
  for (const byComponent of valuesByResponse.values()) {
    const values = [...byComponent.values()].flat();
    if (values.length >= STRAIGHT_LINE_MIN_ITEMS && allIdentical(values)) {
      straightLiners += 1;
    }
  }

  const flatComponents = components
    .filter((component) => QUALITY_COMPONENT_IDS.includes(component.id))
    .sort((a, b) => a.id - b.id)
    .map((component) => {
      let count = 0;
      for (const byComponent of valuesByResponse.values()) {
        const values = byComponent.get(component.id) ?? [];
        if (values.length >= FLAT_COMPONENT_MIN_ITEMS && allIdentical(values)) {
          count += 1;
        }
      }
      return {
        componentId: component.id,
        title: component.title,
        count,
        share: percent(count, completed),
      };
    });

  // Un texto de puros espacios pasa el `not null` de la base pero no dice nada.
  const openRespondents = new Set(
    textAnswers
      .filter(
        (answer) =>
          answer.questionCode === OPEN_ANSWER_CODE &&
          completedIds.has(answer.responseId) &&
          hasText(answer.valueText),
      )
      .map((answer) => answer.responseId),
  );

  const textOptionsByQuestion = new Map<string, Set<string>>();
  for (const option of textOptions) {
    const values =
      textOptionsByQuestion.get(option.questionCode) ?? new Set<string>();
    values.add(option.value);
    textOptionsByQuestion.set(option.questionCode, values);
  }

  const otherSpecified = textAnswers.filter((answer) => {
    if (!completedIds.has(answer.responseId) || !hasText(answer.valueText))
      return false;
    const allowed = textOptionsByQuestion.get(answer.questionCode);
    if (!allowed) return false;
    const selected = answer.valueOption
      ? [answer.valueOption, ...answer.valueOptions]
      : answer.valueOptions;
    return selected.some((value) => allowed.has(value));
  }).length;

  return {
    completed,
    speeders: {
      thresholdSeconds: SPEEDER_THRESHOLD_SECONDS,
      count: speeders,
      share: percent(speeders, durations.length),
    },
    straightLining: {
      count: straightLiners,
      share: percent(straightLiners, completed),
      minItems: STRAIGHT_LINE_MIN_ITEMS,
    },
    flatComponents,
    openAnswers: {
      count: openRespondents.size,
      share: percent(openRespondents.size, completed),
    },
    otherSpecified,
  };
}
