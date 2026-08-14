import { NPS_PASSIVE_MIN, NPS_PROMOTER_MIN } from '../../common/constants';
import { roundIndex } from './shared/component-index.util';
import { NPS_CODE, NPS_MOTIVES_CODE } from './question-codes.constant';
import type { NpsResult, RawAnswerRow } from './indicator.types';

type Segment = 'promoter' | 'passive' | 'detractor';

function segmentOf(score: number): Segment {
  if (score >= NPS_PROMOTER_MIN) return 'promoter';
  if (score >= NPS_PASSIVE_MIN) return 'passive';
  return 'detractor';
}

/**
 * NPS Interno = %promotores − %detractores, rango −100..100 (Contexto.md §4.3).
 *
 * La unidad de conteo es cada par (encuestado, área evaluada), no cada encuestado: una
 * persona que califica cuatro áreas aporta cuatro observaciones, porque la pregunta es
 * sobre el área, no sobre ella.
 *
 * Se reporta aparte del IMC porque su escala no es 0..100.
 */
export function computeNps(rows: RawAnswerRow[]): NpsResult {
  let promoters = 0;
  let passives = 0;
  let detractors = 0;

  for (const row of rows) {
    if (row.questionCode !== NPS_CODE || row.valueNumber === null) continue;
    const segment = segmentOf(row.valueNumber);
    if (segment === 'promoter') promoters += 1;
    else if (segment === 'passive') passives += 1;
    else detractors += 1;
  }

  const total = promoters + passives + detractors;
  const value =
    total === 0 ? null : roundIndex(((promoters - detractors) * 100) / total);

  return { code: 'NPS_INT', value, promoters, passives, detractors, total };
}

/**
 * Motivos del NPS separados entre promotores y detractores (KPI 18).
 *
 * SUPUESTO DE DISEÑO: `c9_motivos` se responde una sola vez a nivel global, pero `c9_nps`
 * es por área. Para poder atribuir los motivos a un segmento, se clasifica al encuestado
 * por el PROMEDIO de las calificaciones que dio a las áreas que evaluó. Un encuestado
 * pasivo en promedio no aporta a ninguno de los dos grupos, porque sus motivos no explican
 * ni una recomendación ni un rechazo.
 *
 * Si LinkTIC decide pedir motivos por área (flag NPS_MOTIVOS_POR_AREA), esta atribución
 * deja de ser necesaria y puede leerse directo del par (encuestado, área).
 */
export function computeNpsMotives(rows: RawAnswerRow[]): {
  promoters: Map<string, number>;
  detractors: Map<string, number>;
} {
  const scoresByResponse = new Map<string, number[]>();
  const motivesByResponse = new Map<string, string[]>();

  for (const row of rows) {
    if (row.questionCode === NPS_CODE && row.valueNumber !== null) {
      const scores = scoresByResponse.get(row.responseId) ?? [];
      scores.push(row.valueNumber);
      scoresByResponse.set(row.responseId, scores);
    } else if (
      row.questionCode === NPS_MOTIVES_CODE &&
      row.valueOptions.length > 0
    ) {
      motivesByResponse.set(row.responseId, row.valueOptions);
    }
  }

  const promoters = new Map<string, number>();
  const detractors = new Map<string, number>();

  for (const [responseId, motives] of motivesByResponse) {
    const scores = scoresByResponse.get(responseId);
    if (!scores?.length) continue;

    const average =
      scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const segment = segmentOf(average);
    if (segment === 'passive') continue;

    const target = segment === 'promoter' ? promoters : detractors;
    for (const motive of motives) {
      target.set(motive, (target.get(motive) ?? 0) + 1);
    }
  }

  return { promoters, detractors };
}
