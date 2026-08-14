import type { IndicatorResult, RawAnswerRow } from '../indicator.types';

/**
 * Los ítems del instrumento son 0-10 y todos los índices se reportan 0-100
 * (Contexto.md §4.1).
 */
const SCALE_TO_INDEX = 10;

/** Dos decimales alcanzan para las tarjetas (entero) y las tablas (un decimal). */
const INDEX_DECIMALS = 2;

/**
 * Sin este redondeo el ruido binario del punto flotante (0.75 * 75 + 0.25 * 80) viaja
 * hasta el front y dos cortes idénticos pueden no verse iguales.
 */
export function roundIndex(value: number): number {
  const factor = 10 ** INDEX_DECIMALS;
  return Math.round(value * factor) / factor;
}

/** Promedio que devuelve `null` para el conjunto vacío, nunca 0. */
export function averageOf(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Lleva un promedio de la escala 0-10 al índice 0-100. */
export function toIndex(scaleAverage: number | null): number | null {
  return scaleAverage === null
    ? null
    : roundIndex(scaleAverage * SCALE_TO_INDEX);
}

export interface WeightedPart {
  value: number | null;
  weight: number;
}

/**
 * Media ponderada que reescala los pesos sobre las partes que sí tienen dato: si falta
 * una mitad, la otra se lleva todo el peso. La alternativa —imputar 0— hundiría el
 * índice inventando una calificación de "muy deficiente" que nadie dio.
 */
export function weightedAverage(parts: WeightedPart[]): number | null {
  let weighted = 0;
  let totalWeight = 0;

  for (const part of parts) {
    if (part.value === null) continue;
    weighted += part.value * part.weight;
    totalWeight += part.weight;
  }

  if (totalWeight <= 0) return null;
  return roundIndex(weighted / totalWeight);
}

export interface ItemAggregate {
  /** Promedio de los valores 0-10, o `null` si no hubo ninguno. */
  average: number | null;
  /** Valores individuales promediados. */
  observations: number;
  /** Respuestas distintas que aportaron al menos un valor. */
  respondentIds: Set<string>;
}

/**
 * Promedia los valores de escala de un conjunto de preguntas ignorando los nulos.
 * Devuelve los `responseId` y no su conteo porque los indicadores compuestos necesitan
 * unir varios agregados sin contar dos veces al mismo encuestado.
 */
export function aggregateScaleItems(
  rows: RawAnswerRow[],
  questionCodes: readonly string[],
): ItemAggregate {
  const codes = new Set(questionCodes);
  const respondentIds = new Set<string>();
  let sum = 0;
  let observations = 0;

  for (const row of rows) {
    if (!codes.has(row.questionCode)) continue;
    if (row.valueNumber === null) continue;
    sum += row.valueNumber;
    observations += 1;
    respondentIds.add(row.responseId);
  }

  return {
    average: observations === 0 ? null : sum / observations,
    observations,
    respondentIds,
  };
}

/**
 * Fórmula común de los índices de componente: promedio de los ítems × 10. La comparten
 * IREL, ICONF, IVAL, ICOM, ISI, IINT e ICOL, así que vive en un solo lugar.
 */
export function simpleAverageIndex(
  rows: RawAnswerRow[],
  questionCodes: readonly string[],
  code: IndicatorResult['code'],
): IndicatorResult {
  const aggregate = aggregateScaleItems(rows, questionCodes);

  return {
    code,
    value: toIndex(aggregate.average),
    respondents: aggregate.respondentIds.size,
    observations: aggregate.observations,
  };
}

/** Agrupa por respuesta preservando el orden de llegada de las filas. */
export function groupByResponse(
  rows: RawAnswerRow[],
): Map<string, RawAnswerRow[]> {
  const groups = new Map<string, RawAnswerRow[]>();

  for (const row of rows) {
    const group = groups.get(row.responseId);
    if (group) group.push(row);
    else groups.set(row.responseId, [row]);
  }

  return groups;
}

/** Opción única marcada en una pregunta, `null` si no la respondió. */
export function selectedOption(
  rows: RawAnswerRow[],
  questionCode: string,
): string | null {
  const row = rows.find((candidate) => candidate.questionCode === questionCode);
  return row?.valueOption ?? null;
}

/**
 * Traduce una opción a su score 0-100. Una opción ausente o fuera de la tabla devuelve
 * `null` y no el score más bajo: un valor corrupto no debe leerse como mala percepción.
 */
export function optionScore(
  scores: Record<string, number>,
  option: string | null,
): number | null {
  if (option === null || !(option in scores)) return null;
  return scores[option];
}

/**
 * Cuenta las opciones marcadas en una pregunta múltiple.
 *
 * Una pregunta ausente o con selección vacía devuelve `null`: no distingue "no marqué
 * nada" de "no llegué a la pregunta". `excluded` descarta opciones que no cuentan como
 * área (NINGUNA en 8.1) y ahí sí puede devolver 0, porque esa ausencia es un dato real.
 */
export function countSelectedOptions(
  rows: RawAnswerRow[],
  questionCode: string,
  excluded: readonly string[] = [],
): number | null {
  const row = rows.find((candidate) => candidate.questionCode === questionCode);
  if (!row || row.valueOptions.length === 0) return null;
  return row.valueOptions.filter((option) => !excluded.includes(option)).length;
}
