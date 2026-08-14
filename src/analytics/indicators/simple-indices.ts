import { simpleAverageIndex } from './shared/component-index.util';
import { QUESTION_CODES_BY_INDICATOR } from './question-codes.constant';
import type { IndicatorResult, RawAnswerRow } from './indicator.types';

/**
 * Los siete índices cuya fórmula es exactamente "promedio de los ítems × 10"
 * (Contexto.md §4.3). Comparten un único lugar de verdad —`simpleAverageIndex`— y viven
 * juntos porque separarlos daría siete archivos idénticos de tres líneas, que esconde la
 * fórmula compartida en vez de exponerla.
 *
 * Los que llevan ponderación propia (NIO, IAG, IINN) y los de otra escala (NPS) tienen su
 * archivo aparte.
 */

export const computeIrel = (rows: RawAnswerRow[]): IndicatorResult =>
  simpleAverageIndex(rows, QUESTION_CODES_BY_INDICATOR.IREL, 'IREL');

export const computeIconf = (rows: RawAnswerRow[]): IndicatorResult =>
  simpleAverageIndex(rows, QUESTION_CODES_BY_INDICATOR.ICONF, 'ICONF');

export const computeIval = (rows: RawAnswerRow[]): IndicatorResult =>
  simpleAverageIndex(rows, QUESTION_CODES_BY_INDICATOR.IVAL, 'IVAL');

export const computeIcom = (rows: RawAnswerRow[]): IndicatorResult =>
  simpleAverageIndex(rows, QUESTION_CODES_BY_INDICATOR.ICOM, 'ICOM');

export const computeIsi = (rows: RawAnswerRow[]): IndicatorResult =>
  simpleAverageIndex(rows, QUESTION_CODES_BY_INDICATOR.ISI, 'ISI');

export const computeIint = (rows: RawAnswerRow[]): IndicatorResult =>
  simpleAverageIndex(rows, QUESTION_CODES_BY_INDICATOR.IINT, 'IINT');

export const computeIcol = (rows: RawAnswerRow[]): IndicatorResult =>
  simpleAverageIndex(rows, QUESTION_CODES_BY_INDICATOR.ICOL, 'ICOL');
