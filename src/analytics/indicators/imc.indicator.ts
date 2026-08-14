import { roundIndex } from './shared/component-index.util';
import { IMC_COMPONENT_CODES } from './question-codes.constant';
import type { IndicatorResult } from './indicator.types';

/**
 * Índice de Madurez Colaborativa: la suma ponderada de los 7 índices que lo componen
 * (Contexto.md §4.4). Es el KPI titular del dashboard.
 *
 * Los pesos NO se hardcodean: llegan de la tabla `indicator_weights` para que un admin
 * pueda reponderarlos sin desplegar. `weights.service` valida que sumen 1.
 *
 * Cuando un índice no tiene dato, su peso se redistribuye proporcionalmente entre los que
 * sí lo tienen. Tratarlo como 0 sería peor que no reportarlo: convertiría un componente
 * sin respuestas en una calificación de "muy deficiente" que nadie dio.
 *
 * NIO y NPS_INT quedan fuera a propósito: el primero mide intensidad y no calidad, y el
 * segundo está en escala −100..100.
 */
export function computeImc(
  indicators: IndicatorResult[],
  weights: Map<string, number>,
): IndicatorResult {
  const byCode = new Map(
    indicators.map((indicator) => [indicator.code, indicator]),
  );

  let weighted = 0;
  let totalWeight = 0;
  let respondents = 0;
  let observations = 0;

  for (const code of IMC_COMPONENT_CODES) {
    const indicator = byCode.get(code);
    const weight = weights.get(code);
    if (!indicator || weight === undefined || indicator.value === null)
      continue;

    weighted += indicator.value * weight;
    totalWeight += weight;
    // El IMC se reporta sobre el corte completo, así que el número de encuestados que lo
    // sostiene es el del componente con más cobertura, no la suma (se solapan).
    respondents = Math.max(respondents, indicator.respondents);
    observations += indicator.observations;
  }

  return {
    code: 'IMC',
    value: totalWeight <= 0 ? null : roundIndex(weighted / totalWeight),
    respondents,
    observations,
  };
}
