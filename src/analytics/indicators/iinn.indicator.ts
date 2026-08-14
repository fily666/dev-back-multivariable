import { INNOVATION_PARTNER_TARGET } from '../../common/constants';
import {
  aggregateScaleItems,
  averageOf,
  countSelectedOptions,
  groupByResponse,
  toIndex,
  weightedAverage,
} from './shared/component-index.util';
import {
  IINN_PARTNERS_CODE,
  IINN_SCALE_CODES,
  NO_PARTNER_OPTION,
} from './question-codes.constant';
import type { IndicatorResult, RawAnswerRow } from './indicator.types';

const WEIGHT_SCALES = 0.8;
const WEIGHT_PARTNERSHIP = 0.2;

/**
 * Índice de Innovación Colaborativa = 0.80·(promedio de los 4 ítems × 10) + 0.20·R
 * (Contexto.md §4.3), donde R mide con cuántas áreas se desarrollaron iniciativas.
 *
 * La disposición declarada a innovar y la colaboración efectiva son cosas distintas: los
 * ítems de escala capturan la primera, R la segunda.
 */
export function computeIinn(rows: RawAnswerRow[]): IndicatorResult {
  const scales = aggregateScaleItems(rows, IINN_SCALE_CODES);

  const partnershipScores: number[] = [];
  const respondents = new Set(scales.respondentIds);

  for (const [responseId, responseRows] of groupByResponse(rows)) {
    // 'NINGUNA' es una respuesta real de cero colaboración, no una ausencia de dato: por
    // eso se excluye del conteo pero la fila sigue contando como respondida.
    const partners = countSelectedOptions(responseRows, IINN_PARTNERS_CODE, [
      NO_PARTNER_OPTION,
    ]);
    if (partners === null) continue;

    partnershipScores.push(
      Math.min(partners / INNOVATION_PARTNER_TARGET, 1) * 100,
    );
    respondents.add(responseId);
  }

  const value = weightedAverage([
    { value: toIndex(scales.average), weight: WEIGHT_SCALES },
    { value: averageOf(partnershipScores), weight: WEIGHT_PARTNERSHIP },
  ]);

  return {
    code: 'IINN',
    value,
    respondents: respondents.size,
    observations: scales.observations + partnershipScores.length,
  };
}
