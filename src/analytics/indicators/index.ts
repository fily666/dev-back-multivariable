export * from './indicator.types';
export * from './question-codes.constant';
export * from './shared/component-index.util';
export * from './simple-indices';
export { computeNio } from './nio.indicator';
export { computeIag } from './iag.indicator';
export { computeIinn } from './iinn.indicator';
export { computeNps, computeNpsMotives } from './nps.indicator';
export { computeImc } from './imc.indicator';

import { computeIag } from './iag.indicator';
import { computeIinn } from './iinn.indicator';
import { computeNio } from './nio.indicator';
import {
  computeIcol,
  computeIcom,
  computeIconf,
  computeIint,
  computeIrel,
  computeIsi,
  computeIval,
} from './simple-indices';
import type {
  IndicatorCode,
  IndicatorResult,
  RawAnswerRow,
} from './indicator.types';

/** Registro de las 10 funciones de indicador, para iterarlas sin repetir la lista. */
export const INDICATOR_REGISTRY: Record<
  IndicatorCode,
  (rows: RawAnswerRow[]) => IndicatorResult
> = {
  NIO: computeNio,
  IREL: computeIrel,
  ICONF: computeIconf,
  IVAL: computeIval,
  ICOM: computeIcom,
  ISI: computeIsi,
  IAG: computeIag,
  IINT: computeIint,
  ICOL: computeIcol,
  IINN: computeIinn,
};

/** Calcula los 10 indicadores sobre el mismo conjunto de filas. */
export function computeAllIndicators(rows: RawAnswerRow[]): IndicatorResult[] {
  return (Object.keys(INDICATOR_REGISTRY) as IndicatorCode[]).map((code) =>
    INDICATOR_REGISTRY[code](rows),
  );
}
