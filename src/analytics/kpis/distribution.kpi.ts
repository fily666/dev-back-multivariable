import { GLOBAL_AREA_CODE, OTHER_AREA_CODE } from '../../common/constants';
import type { RawAnswerRow } from '../indicators/indicator.types';
import type {
  CountedOption,
  DistributionRow,
  InnovationEdge,
} from '../dto/analytics.dto';

type Labels = Map<string, string>;

function share(count: number, total: number): number {
  return total === 0 ? 0 : Math.round((count / total) * 1000) / 10;
}

/**
 * Cuenta las opciones marcadas en una pregunta múltiple (KPIs 14, 16, 18).
 *
 * El denominador de `share` es el número de ENCUESTADOS que respondieron la pregunta, no
 * el de marcas: en una múltiple los porcentajes suman más de 100, y eso es correcto —
 * "el 60% señaló comunicación" es la lectura útil, no "comunicación fue el 30% de las marcas".
 */
export function countMultiOptions(
  rows: RawAnswerRow[],
  questionCode: string,
  labels: Labels = new Map(),
): CountedOption[] {
  const counts = new Map<string, number>();
  const respondents = new Set<string>();

  for (const row of rows) {
    if (row.questionCode !== questionCode || row.valueOptions.length === 0)
      continue;
    respondents.add(row.responseId);
    for (const option of row.valueOptions) {
      counts.set(option, (counts.get(option) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([value, count]) => ({
      value,
      label: labels.get(value) ?? value,
      count,
      share: share(count, respondents.size),
    }))
    .sort((a, b) => b.count - a.count);
}

/** Cuenta las opciones de una pregunta de selección única (KPI 15 y moda del KPI 6). */
export function countSingleOptions(
  rows: RawAnswerRow[],
  questionCode: string,
  labels: Labels = new Map(),
): CountedOption[] {
  const counts = new Map<string, number>();
  let total = 0;

  for (const row of rows) {
    if (row.questionCode !== questionCode || !row.valueOption) continue;
    counts.set(row.valueOption, (counts.get(row.valueOption) ?? 0) + 1);
    total += 1;
  }

  return [...counts.entries()]
    .map(([value, count]) => ({
      value,
      label: labels.get(value) ?? value,
      count,
      share: share(count, total),
    }))
    .sort((a, b) => b.count - a.count);
}

/** KPI 13: distribución del tiempo de respuesta percibido, en el orden del instrumento. */
const RESPONSE_TIME_ORDER = [
  'MENOS_2H',
  'MISMO_DIA',
  'H24',
  'H48',
  'MAS_3_DIAS',
] as const;
const RESPONSE_TIME_LABELS: Record<string, string> = {
  MENOS_2H: 'Menos de 2 horas',
  MISMO_DIA: 'Mismo día',
  H24: '24 horas',
  H48: '48 horas',
  MAS_3_DIAS: 'Más de tres días',
};

export function buildResponseTimeDistribution(
  rows: RawAnswerRow[],
): DistributionRow[] {
  const counts = new Map<string, number>();
  let total = 0;

  for (const row of rows) {
    if (row.questionCode !== 'c5_tiempo_respuesta' || !row.valueOption)
      continue;
    counts.set(row.valueOption, (counts.get(row.valueOption) ?? 0) + 1);
    total += 1;
  }

  // Se conserva el orden del instrumento y se incluyen los tramos con cero: un hueco en la
  // distribución es información, y ordenarla por frecuencia perdería la escala temporal.
  return RESPONSE_TIME_ORDER.map((value) => {
    const count = counts.get(value) ?? 0;
    return {
      value,
      label: RESPONSE_TIME_LABELS[value],
      count,
      share: share(count, total),
    };
  });
}

/**
 * KPI 17: red de iniciativas conjuntas de innovación.
 *
 * Sirve para detectar áreas AISLADAS de la innovación: las que no aparecen en ninguna
 * arista son las que no han desarrollado nada con nadie en seis meses.
 */
export function buildInnovationNetwork(rows: RawAnswerRow[]): InnovationEdge[] {
  const edges = new Map<string, number>();

  for (const row of rows) {
    if (row.questionCode !== 'c8_areas_iniciativas' || !row.ownArea) continue;
    if (row.ownArea === GLOBAL_AREA_CODE || row.ownArea === OTHER_AREA_CODE)
      continue;

    for (const partner of row.valueOptions) {
      if (partner === 'NINGUNA' || partner === OTHER_AREA_CODE) continue;
      const key = `${row.ownArea} ${partner}`;
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  }

  return [...edges.entries()]
    .map(([key, initiatives]) => {
      const [sourceArea, targetArea] = key.split(' ');
      return { sourceArea, targetArea, initiatives };
    })
    .sort((a, b) => b.initiatives - a.initiatives);
}
