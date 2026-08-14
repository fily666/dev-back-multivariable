import {
  FREQUENCY_SCORES,
  INTERACTION_TYPE_COUNT,
  OTHER_AREA_CODE,
} from '../../common/constants';
import {
  countSelectedOptions,
  groupByResponse,
  optionScore,
  roundIndex,
  selectedOption,
} from './shared/component-index.util';
import type { IndicatorResult, RawAnswerRow } from './indicator.types';

const MAX_AREAS = 5;

const WEIGHT_FREQUENCY = 0.5;
const WEIGHT_BREADTH = 0.3;
const WEIGHT_DIVERSITY = 0.2;

/**
 * Nivel de Interacción Organizacional = 0.50·F + 0.30·A + 0.20·D (Contexto.md §4.3).
 *
 * Se calcula por respuesta y luego se promedia, no al revés: promediar primero los
 * componentes por separado perdería la relación entre la frecuencia de una persona y la
 * amplitud de su red, que es justo lo que el indicador quiere capturar.
 *
 * Mide intensidad de interacción, NO calidad. Por eso se reporta aparte del IMC.
 */
export function computeNio(rows: RawAnswerRow[]): IndicatorResult {
  const byResponse = groupByResponse(rows);
  const perResponse: number[] = [];
  let observations = 0;

  for (const responseRows of byResponse.values()) {
    const frequency = optionScore(
      FREQUENCY_SCORES,
      selectedOption(responseRows, 'c1_frecuencia'),
    );

    // 'OTRA' no identifica un área del catálogo, así que no amplía la red de forma medible.
    const areaCount = countSelectedOptions(
      responseRows,
      'c1_areas_interaccion',
      [OTHER_AREA_CODE],
    );
    const typeCount = countSelectedOptions(responseRows, 'c1_tipo_interaccion');

    const breadth =
      areaCount === null ? null : Math.min(areaCount / MAX_AREAS, 1) * 100;
    const diversity =
      typeCount === null
        ? null
        : Math.min(typeCount / INTERACTION_TYPE_COUNT, 1) * 100;

    const parts = [
      { value: frequency, weight: WEIGHT_FREQUENCY },
      { value: breadth, weight: WEIGHT_BREADTH },
      { value: diversity, weight: WEIGHT_DIVERSITY },
    ];

    let weighted = 0;
    let totalWeight = 0;
    for (const part of parts) {
      if (part.value === null) continue;
      weighted += part.value * part.weight;
      totalWeight += part.weight;
    }

    if (totalWeight <= 0) continue;
    perResponse.push(weighted / totalWeight);
    observations += 1;
  }

  const value =
    perResponse.length === 0
      ? null
      : roundIndex(
          perResponse.reduce((sum, v) => sum + v, 0) / perResponse.length,
        );

  return { code: 'NIO', value, respondents: perResponse.length, observations };
}
