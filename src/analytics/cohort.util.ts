import type { AnalyticsEnvelope } from './indicators/indicator.types';

/**
 * Regla de anonimato del instrumento (Contexto.md §4.5).
 *
 * Ningún corte con menos de `minCohortSize` respuestas se muestra: con dos o tres personas
 * en un área, un promedio permite deducir quién dijo qué, y eso rompería la promesa de que
 * la encuesta es anónima. Es lo que hace creíble el instrumento, no un detalle de UI.
 *
 * Se aplica en el servicio orquestador y NUNCA dentro de las funciones de indicador: esas
 * son puras y no conocen la regla. Centralizarla aquí garantiza que ningún endpoint pueda
 * olvidarse de aplicarla.
 */
export function applyCohort<T>(
  n: number,
  minCohortSize: number,
  data: T,
): AnalyticsEnvelope<T> {
  const insufficient = n < minCohortSize;
  return {
    data: insufficient ? null : data,
    meta: {
      n,
      insufficient,
      minCohortSize,
      generatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Filtra las filas de un desglose dejando fuera las que no alcanzan la cohorte mínima.
 *
 * Sirve para tablas por área: una fila con dos respuestas se retira aunque el corte total
 * sí alcance el umbral, porque el riesgo de reidentificación está en la fila, no en el total.
 */
export function filterCohortRows<T>(
  rows: T[],
  minCohortSize: number,
  respondentsOf: (row: T) => number,
): { rows: T[]; suppressed: number } {
  const kept = rows.filter((row) => respondentsOf(row) >= minCohortSize);
  return { rows: kept, suppressed: rows.length - kept.length };
}
