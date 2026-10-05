import { GLOBAL_AREA_CODE, OTHER_AREA_CODE } from '../../common/constants';
import {
  IINN_PARTNERS_CODE,
  NO_PARTNER_OPTION,
} from '../indicators/question-codes.constant';
import type { RawAnswerRow } from '../indicators/indicator.types';
import type {
  CountedOption,
  DistributionRow,
  NetworkDemandRow,
  NetworkImportanceRow,
  NetworkInnovation,
  NetworkPayload,
  NetworkValueRow,
} from '../dto/analytics.dto';
import {
  buildInnovationNetwork,
  countMultiOptions,
  countSingleOptions,
  share,
} from './distribution.kpi';
import {
  RELATIONSHIP_QUESTION_CODES,
  buildAreaRanking,
} from './relationship.kpi';

const AREAS_CODE = 'c1_areas_interaccion';
const PRINCIPAL_CODE = 'c1_area_principal';
const FREQUENCY_CODE = 'c1_frecuencia';
const INTERACTION_TYPE_CODE = 'c1_tipo_interaccion';
const MOST_VALUE_CODE = 'c10_area_mayor_valor';
const STRENGTHEN_CODE = 'c10_area_fortalecer';

/** Códigos que hay que traer una sola vez para todo el payload de la red. */
export const NETWORK_QUESTION_CODES = [
  ...RELATIONSHIP_QUESTION_CODES,
  PRINCIPAL_CODE,
  INTERACTION_TYPE_CODE,
  IINN_PARTNERS_CODE,
  MOST_VALUE_CODE,
  STRENGTHEN_CODE,
] as const;

/** Preguntas cuyas etiquetas de opción vienen de `question_options`. */
export const NETWORK_OPTION_CODES = [FREQUENCY_CODE, INTERACTION_TYPE_CODE];

/**
 * La frecuencia en el orden de la escala, de la más a la menos intensa. Ordenarla por
 * conteo perdería justo la lectura de "qué tan seguido", como en el KPI 13.
 */
export const FREQUENCY_ORDER = [
  'DIARIA',
  'VARIAS_SEMANA',
  'SEMANAL',
  'MENSUAL',
  'ESPORADICA',
] as const;

/** Área del catálogo, tal como la trae `ResponsesRepository.fetchAreas`. */
export interface NetworkArea {
  code: string;
  name: string;
  isEvaluable: boolean;
  proceso: { name: string } | null;
}

/** Opción estática de una pregunta, en el orden del instrumento. */
export interface NetworkOption {
  questionCode: string;
  value: string;
  label: string;
}

export interface NetworkInput {
  rows: RawAnswerRow[];
  areas: NetworkArea[];
  options: NetworkOption[];
}

/** Áreas que pueden aparecer en la red: las evaluables del catálogo, en su orden. */
function evaluableAreas(areas: NetworkArea[]): NetworkArea[] {
  return areas.filter(
    (area) =>
      area.isEvaluable &&
      area.code !== OTHER_AREA_CODE &&
      area.code !== GLOBAL_AREA_CODE,
  );
}

/** Respuestas que marcaron al menos una opción de una pregunta múltiple. */
function respondentsOf(rows: RawAnswerRow[], questionCode: string): number {
  const ids = new Set<string>();
  for (const row of rows) {
    if (row.questionCode === questionCode && row.valueOptions.length > 0) {
      ids.add(row.responseId);
    }
  }
  return ids.size;
}

function countsByValue(options: CountedOption[]): Map<string, number> {
  return new Map(options.map((option) => [option.value, option.count]));
}

/**
 * Cuánto se busca a cada área. Salen todas las evaluables, con cero: el área que nadie
 * menciona es la lectura más importante de la red. El empate conserva el orden del catálogo.
 */
export function buildDemand(
  rows: RawAnswerRow[],
  areas: NetworkArea[],
): NetworkDemandRow[] {
  // La regla de selección múltiple rechaza opciones repetidas, así que contar marcas es
  // contar personas, y el % de `countMultiOptions` ya es sobre quienes respondieron.
  const mentions = new Map(
    countMultiOptions(rows, AREAS_CODE).map((option) => [option.value, option]),
  );
  const principal = countsByValue(countSingleOptions(rows, PRINCIPAL_CODE));

  return evaluableAreas(areas)
    .map((area) => ({
      areaCode: area.code,
      areaName: area.name,
      procesoName: area.proceso?.name ?? null,
      mentions: mentions.get(area.code)?.count ?? 0,
      principal: principal.get(area.code) ?? 0,
      mentionShare: mentions.get(area.code)?.share ?? 0,
    }))
    .sort((a, b) => b.mentions - a.mentions);
}

/**
 * Las áreas que se buscan, cruzadas con cómo las califican quienes trabajan con ellas: un
 * área muy buscada y mal evaluada es un cuello de botella, una poco buscada y bien evaluada
 * es capacidad que la organización no está usando.
 *
 * Sale sin la cohorte por fila. La aplica el servicio, como en el ranking del mapa.
 */
export function buildImportance(
  rows: RawAnswerRow[],
  demand: NetworkDemandRow[],
): NetworkImportanceRow[] {
  const names = new Map(demand.map((row) => [row.areaCode, row.areaName]));
  const ranking = new Map(
    buildAreaRanking(rows, names).map((row) => [row.areaCode, row]),
  );

  return demand.flatMap((row) => {
    const received = ranking.get(row.areaCode);
    if (row.mentions === 0 || !received || received.irel === null) return [];
    return [
      {
        areaCode: row.areaCode,
        areaName: row.areaName,
        mentions: row.mentions,
        irel: received.irel,
        respondents: received.respondents,
      },
    ];
  });
}

/** Frecuencia de interacción en el orden de la escala, con ceros. El % es sobre respuestas. */
export function buildFrequency(
  rows: RawAnswerRow[],
  labels: Map<string, string>,
): DistributionRow[] {
  const counted = new Map(
    countSingleOptions(rows, FREQUENCY_CODE).map((option) => [
      option.value,
      option,
    ]),
  );

  return FREQUENCY_ORDER.map((value) => ({
    value,
    label: labels.get(value) ?? value,
    count: counted.get(value)?.count ?? 0,
    share: counted.get(value)?.share ?? 0,
  }));
}

/**
 * Tipos de interacción, de más a menos marcados, con las opciones declaradas aunque nadie
 * las marque. Es múltiple: el % es sobre encuestados y la suma pasa de 100.
 */
export function buildInteractionTypes(
  rows: RawAnswerRow[],
  declared: { value: string; label: string }[],
): CountedOption[] {
  const labels = new Map(
    declared.map((option) => [option.value, option.label]),
  );
  const counted = countMultiOptions(rows, INTERACTION_TYPE_CODE, labels);
  const byValue = new Map(counted.map((option) => [option.value, option]));

  return [
    ...declared.map(
      (option) =>
        byValue.get(option.value) ?? {
          value: option.value,
          label: option.label,
          count: 0,
          share: 0,
        },
    ),
    // Una opción marcada que ya no está en el catálogo se conserva: es una respuesta real.
    ...counted.filter((option) => !labels.has(option.value)),
  ].sort((a, b) => b.count - a.count);
}

/**
 * Cuántas veces se eligió cada área como la que más valor genera y como la que más debe
 * fortalecer su relacionamiento. Arriba quedan las que se reconocen sin reparos; abajo, las
 * que se señalan más de lo que se valoran.
 */
export function buildValueVsStrengthen(
  rows: RawAnswerRow[],
  areas: NetworkArea[],
): NetworkValueRow[] {
  const value = countsByValue(countSingleOptions(rows, MOST_VALUE_CODE));
  const strengthen = countsByValue(countSingleOptions(rows, STRENGTHEN_CODE));

  return evaluableAreas(areas)
    .map((area) => ({
      areaCode: area.code,
      areaName: area.name,
      value: value.get(area.code) ?? 0,
      strengthen: strengthen.get(area.code) ?? 0,
    }))
    .filter((row) => row.value + row.strengthen > 0)
    .sort((a, b) => b.value - b.strengthen - (a.value - a.strengthen));
}

/**
 * Quién quedó fuera de la innovación conjunta (KPI 17): las áreas que no aparecen en
 * ninguna iniciativa con otra área, ni como quien la declara ni como socia.
 */
export function buildInnovationSummary(
  rows: RawAnswerRow[],
  areas: NetworkArea[],
): NetworkInnovation {
  const respondents = new Set<string>();
  const none = new Set<string>();

  for (const row of rows) {
    if (row.questionCode !== IINN_PARTNERS_CODE) continue;
    if (row.valueOptions.length === 0) continue;
    respondents.add(row.responseId);
    if (row.valueOptions.includes(NO_PARTNER_OPTION)) none.add(row.responseId);
  }

  // La 8.1 no lleva la regla de «no incluya su propia área» que sí tiene la 1.1, así que
  // alguien puede marcarse a sí mismo. Un área que innova consigo misma no dice nada del
  // trabajo entre áreas: esa arista no la saca del aislamiento.
  const connected = new Set<string>();
  for (const edge of buildInnovationNetwork(rows)) {
    if (edge.sourceArea === edge.targetArea) continue;
    connected.add(edge.sourceArea);
    connected.add(edge.targetArea);
  }

  const evaluable = evaluableAreas(areas);

  return {
    respondents: respondents.size,
    noneShare: share(none.size, respondents.size),
    connectedAreas: evaluable.filter((area) => connected.has(area.code)).length,
    isolated: evaluable
      .filter((area) => !connected.has(area.code))
      .map((area) => ({ areaCode: area.code, areaName: area.name })),
  };
}

/**
 * Quién trabaja con quién, con qué frecuencia y para qué.
 *
 * `importance` sale completa: la cohorte por área la aplica el servicio.
 */
export function buildNetwork(input: NetworkInput): NetworkPayload {
  const { rows, areas, options } = input;
  const demand = buildDemand(rows, areas);

  const frequencyLabels = new Map(
    options
      .filter((option) => option.questionCode === FREQUENCY_CODE)
      .map((option) => [option.value, option.label]),
  );
  const interactionTypes = options
    .filter((option) => option.questionCode === INTERACTION_TYPE_CODE)
    .map(({ value, label }) => ({ value, label }));

  return {
    respondents: respondentsOf(rows, AREAS_CODE),
    demand,
    importance: buildImportance(rows, demand),
    frequency: buildFrequency(rows, frequencyLabels),
    interactionTypes: buildInteractionTypes(rows, interactionTypes),
    valueVsStrengthen: buildValueVsStrengthen(rows, areas),
    innovation: buildInnovationSummary(rows, areas),
  };
}
