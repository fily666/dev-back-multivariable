import { RESPONSE_TIME_SCORES } from '../../common/constants';
import {
  aggregateScaleItems,
  averageOf,
  groupByResponse,
  optionScore,
  selectedOption,
  toIndex,
  weightedAverage,
} from './shared/component-index.util';
import { IAG_SCALE_CODES, IAG_TIME_CODE } from './question-codes.constant';
import type { IndicatorResult, RawAnswerRow } from './indicator.types';

const WEIGHT_SCALES = 0.75;
const WEIGHT_TIME = 0.25;

/**
 * Índice de Agilidad = 0.75·(promedio de los 4 ítems × 10) + 0.25·T (Contexto.md §4.3),
 * donde T es el score del tiempo de respuesta percibido en 5.1.
 *
 * Si falta una de las dos mitades, `weightedAverage` reescala los pesos sobre la que sí
 * hay. Imputar 0 hundiría el índice inventando una percepción que nadie expresó.
 */
export function computeIag(rows: RawAnswerRow[]): IndicatorResult {
  const scales = aggregateScaleItems(rows, IAG_SCALE_CODES);

  // El tiempo se promedia por respuesta: es una sola opción por persona, y contarla una
  // vez por fila la ponderaría según cuántas escalas respondió.
  const timeScores: number[] = [];
  for (const responseRows of groupByResponse(rows).values()) {
    const score = optionScore(
      RESPONSE_TIME_SCORES,
      selectedOption(responseRows, IAG_TIME_CODE),
    );
    if (score !== null) timeScores.push(score);
  }

  const value = weightedAverage([
    { value: toIndex(scales.average), weight: WEIGHT_SCALES },
    { value: averageOf(timeScores), weight: WEIGHT_TIME },
  ]);

  const respondents = new Set(scales.respondentIds);
  for (const [responseId, responseRows] of groupByResponse(rows)) {
    if (selectedOption(responseRows, IAG_TIME_CODE) !== null)
      respondents.add(responseId);
  }

  return {
    code: 'IAG',
    value,
    respondents: respondents.size,
    observations: scales.observations + timeScores.length,
  };
}
