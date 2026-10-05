import { SCALE_MAX, SCALE_MIN } from '../../common/constants';
import {
  IMC_COMPONENT_CODES,
  NPS_CODE,
  QUESTION_CODES_BY_INDICATOR,
} from '../indicators/question-codes.constant';
import type { RawAnswerRow } from '../indicators/indicator.types';
import type { ItemStat } from '../dto/analytics.dto';

/**
 * La mayor desviación estándar posible en la escala: la mitad de las notas en 0 y la otra
 * mitad en 10. Es el denominador del consenso.
 */
export const MAX_SCALE_SD = (SCALE_MAX - SCALE_MIN) / 2;

/** Pregunta 0-10 del catálogo, tal como la trae `ResponsesRepository.fetchScaleQuestions`. */
export interface ScaleQuestion {
  code: string;
  label: string;
  componentId: number;
  sortOrder: number;
  component: { title: string; sortOrder: number };
}

export interface ScaleSummary {
  mean: number | null;
  index: number | null;
  sd: number | null;
  consensus: number | null;
  distribution: number[];
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Índice al que alimenta una pregunta. Se busca en el orden del IMC para que la que figura
 * en dos listas caiga en la principal: `c2_confianza` es IREL antes que ICONF, que es solo
 * una faceta suya.
 */
export function indicatorCodeOf(questionCode: string): string {
  if (questionCode === NPS_CODE) return 'NPS_INT';
  const code = IMC_COMPONENT_CODES.find((indicator) =>
    QUESTION_CODES_BY_INDICATOR[indicator].includes(questionCode),
  );
  return code ?? '';
}

/**
 * Promedio, dispersión y reparto de un conjunto de notas 0-10.
 *
 * La desviación es la poblacional: estos son todos los que respondieron el corte, no una
 * muestra de la que se quiera inferir otra cosa. Todo se calcula con los valores sin
 * redondear y se redondea solo al final, para que `index` no herede el redondeo de `mean`.
 */
export function summarizeScale(values: number[]): ScaleSummary {
  const distribution = new Array<number>(SCALE_MAX - SCALE_MIN + 1).fill(0);
  if (values.length === 0) {
    return { mean: null, index: null, sd: null, consensus: null, distribution };
  }

  for (const value of values) {
    // La regla de escala ya impide notas fuera de 0-10; el tope solo evita escribir fuera
    // del arreglo si algún día llega una.
    const bucket = Math.min(SCALE_MAX, Math.max(SCALE_MIN, Math.round(value)));
    distribution[bucket - SCALE_MIN] += 1;
  }

  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  const sd = Math.sqrt(variance);

  // Un 5 de promedio sale igual de una organización que coincide en el 5 que de una partida
  // entre ceros y dieces. El consenso es lo que las distingue: 100 es unanimidad y 0 la
  // dispersión máxima que admite la escala.
  const consensus = Math.max(0, Math.min(100, 100 * (1 - sd / MAX_SCALE_SD)));

  return {
    mean: round(mean, 2),
    index: round(mean * 10, 1),
    sd: round(sd, 2),
    consensus: round(consensus, 1),
    distribution,
  };
}

/**
 * Cada afirmación 0-10 del instrumento por separado, en el orden en que se pregunta.
 *
 * Las preguntas por área (C2 y el NPS) aportan una nota por cada área evaluada, así que
 * `observations` puede superar a `respondents`. No se descarta ninguna área evaluada: el
 * ítem tiene que salir de las mismas notas que el índice que lo contiene, y el índice no
 * descarta ninguna.
 */
export function buildItemStats(
  rows: RawAnswerRow[],
  questions: ScaleQuestion[],
): ItemStat[] {
  const valuesByCode = new Map<
    string,
    { values: number[]; respondents: Set<string> }
  >();

  for (const row of rows) {
    if (row.valueNumber === null) continue;
    const entry = valuesByCode.get(row.questionCode) ?? {
      values: [],
      respondents: new Set<string>(),
    };
    entry.values.push(row.valueNumber);
    entry.respondents.add(row.responseId);
    valuesByCode.set(row.questionCode, entry);
  }

  return [...questions]
    .sort(
      (a, b) =>
        a.component.sortOrder - b.component.sortOrder ||
        a.sortOrder - b.sortOrder,
    )
    .map((question) => {
      const entry = valuesByCode.get(question.code);
      const values = entry?.values ?? [];
      return {
        code: question.code,
        label: question.label,
        componentId: question.componentId,
        componentTitle: question.component.title,
        indicatorCode: indicatorCodeOf(question.code),
        respondents: entry?.respondents.size ?? 0,
        observations: values.length,
        ...summarizeScale(values),
      };
    });
}
