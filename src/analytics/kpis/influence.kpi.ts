import {
  FREQUENCY_SCORES,
  GLOBAL_AREA_CODE,
  OTHER_AREA_CODE,
} from '../../common/constants';
import { computeIrel } from '../indicators';
import type { RawAnswerRow } from '../indicators/indicator.types';
import type {
  InfluenceEdge,
  InfluenceLevel,
  InfluenceNode,
  InfluenceZone,
} from '../dto/analytics.dto';
import { C2_CODES } from './relationship.kpi';

/** Un área del catálogo con la gestión a la que pertenece. */
export interface InfluenceArea {
  code: string;
  name: string;
  groupCode: string | null;
  groupName: string | null;
}

/**
 * Lo que sale de la función pura: el nivel completo, sin cohorte. Las aristas llevan sus
 * encuestados y los nodos cuántas personas sostienen cada IREL, para que el servicio
 * decida qué se publica.
 */
export interface RawInfluenceLevel extends Omit<
  InfluenceLevel,
  'suppressedEdges'
> {
  edges: InfluenceEdge[];
}

const ZONE_ORDER: InfluenceZone[] = [
  'MOTRIZ',
  'ENLACE',
  'DEPENDIENTE',
  'AUTONOMA',
];

function push(
  map: Map<string, RawAnswerRow[]>,
  key: string,
  row: RawAnswerRow,
) {
  const group = map.get(key);
  if (group) group.push(row);
  else map.set(key, [row]);
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * La fuerza de cada relación, de 1 a 3, por tercios de su peso: «fuerte» es el tercio de
 * relaciones de más peso del nivel. Con todas iguales no hay tercios que separar y todas
 * quedan en «media», que es lo honesto: ninguna pesa más que otra.
 */
export function strengthThresholds(weights: number[]): {
  media: number;
  fuerte: number;
} | null {
  if (weights.length === 0) return null;
  const sorted = [...weights].sort((a, b) => a - b);
  if (sorted[0] === sorted[sorted.length - 1]) return null;
  return {
    media: sorted[Math.floor(sorted.length / 3)],
    fuerte: sorted[Math.floor((sorted.length * 2) / 3)],
  };
}

function strengthOf(
  weight: number,
  thresholds: { media: number; fuerte: number } | null,
): 1 | 2 | 3 {
  if (!thresholds) return 2;
  if (weight >= thresholds.fuerte) return 3;
  if (weight >= thresholds.media) return 2;
  return 1;
}

/**
 * KPI 32: quién mueve a quién.
 *
 * Es el análisis estructural de la prospectiva (MICMAC) aplicado a las áreas. Cuando la gente
 * de A evalúa a B, es porque trabaja con B y depende de lo que B le entrega: B «mueve» a A.
 * Sumando la fuerza de esas relaciones salen dos medidas por área:
 *
 * - motricidad: cuánto dependen de ella las demás (si falla, cuántas lo sienten);
 * - dependencia: cuánto depende ella de las demás (cuántas fallas ajenas le llegan).
 *
 * Las dos medias cortan el plano en las cuatro zonas clásicas: motrices, de enlace,
 * dependientes y autónomas. Cada relación suma lo mismo a una motricidad y a una
 * dependencia, así que las dos medias son iguales.
 *
 * `mapNode` lleva cada área a su nodo: el área misma, o su gestión. Las relaciones dentro de
 * un mismo nodo (dos áreas de la misma gestión) no son influencia entre nodos y no se dibujan;
 * se cuentan aparte.
 */
export function buildInfluenceLevel(
  rows: RawAnswerRow[],
  nodeOf: (areaCode: string) => { code: string; name: string } | null,
  groupOf: (nodeCode: string) => { code: string; name: string } | null,
): RawInfluenceLevel {
  const frequencyByResponse = new Map<string, number>();
  for (const row of rows) {
    if (row.questionCode !== 'c1_frecuencia' || !row.valueOption) continue;
    frequencyByResponse.set(
      row.responseId,
      FREQUENCY_SCORES[row.valueOption] ?? 0,
    );
  }

  const names = new Map<string, string>();
  const pairs = new Map<string, RawAnswerRow[]>();
  const received = new Map<string, RawAnswerRow[]>();
  const granted = new Map<string, RawAnswerRow[]>();
  let internalPairs = 0;
  const internalSeen = new Set<string>();

  for (const row of rows) {
    if (!C2_CODES.includes(row.questionCode) || !row.ownArea) continue;
    if (
      row.targetArea === GLOBAL_AREA_CODE ||
      row.targetArea === OTHER_AREA_CODE ||
      row.ownArea === OTHER_AREA_CODE
    )
      continue;

    const client = nodeOf(row.ownArea);
    const provider = nodeOf(row.targetArea);
    if (!client || !provider) continue;
    names.set(client.code, client.name);
    names.set(provider.code, provider.name);

    if (client.code === provider.code) {
      const key = `${row.ownArea} ${row.targetArea}`;
      if (!internalSeen.has(key)) {
        internalSeen.add(key);
        internalPairs += 1;
      }
      continue;
    }

    push(pairs, `${provider.code} ${client.code}`, row);
    push(received, provider.code, row);
    push(granted, client.code, row);
  }

  const raw = [...pairs.entries()].map(([key, pairRows]) => {
    const [from, to] = key.split(' ');
    const respondentIds = new Set(pairRows.map((row) => row.responseId));
    let weight = 0;
    for (const id of respondentIds) weight += frequencyByResponse.get(id) ?? 0;
    return {
      from,
      to,
      weight: Math.round(weight),
      respondents: respondentIds.size,
      irel: computeIrel(pairRows).value,
    };
  });

  const thresholds = strengthThresholds(raw.map((edge) => edge.weight));
  const edges: InfluenceEdge[] = raw.map((edge) => ({
    ...edge,
    strength: strengthOf(edge.weight, thresholds),
  }));

  const nodeCodes = [...names.keys()];
  const sumOf = (code: string, side: 'from' | 'to') =>
    edges
      .filter((edge) => edge[side] === code)
      .reduce((total, edge) => total + edge.strength, 0);
  const countOf = (code: string, side: 'from' | 'to') =>
    edges.filter((edge) => edge[side] === code).length;

  const measured = nodeCodes.map((code) => ({
    code,
    motricidad: sumOf(code, 'from'),
    dependencia: sumOf(code, 'to'),
  }));
  const total = measured.reduce((sum, node) => sum + node.motricidad, 0);
  const mean = measured.length === 0 ? 0 : total / measured.length;

  const zoneOf = (motricidad: number, dependencia: number): InfluenceZone => {
    const moves = motricidad >= mean;
    const moved = dependencia >= mean;
    if (moves && !moved) return 'MOTRIZ';
    if (moves && moved) return 'ENLACE';
    if (!moves && moved) return 'DEPENDIENTE';
    return 'AUTONOMA';
  };

  const nodes: InfluenceNode[] = measured.map((node) => {
    const receivedRows = received.get(node.code) ?? [];
    const grantedRows = granted.get(node.code) ?? [];
    const group = groupOf(node.code);
    return {
      code: node.code,
      name: names.get(node.code) ?? node.code,
      groupCode: group?.code ?? null,
      groupName: group?.name ?? null,
      motricidad: node.motricidad,
      dependencia: node.dependencia,
      clients: countOf(node.code, 'from'),
      providers: countOf(node.code, 'to'),
      zone: zoneOf(node.motricidad, node.dependencia),
      receivedFrom: new Set(receivedRows.map((row) => row.responseId)).size,
      grantedBy: new Set(grantedRows.map((row) => row.responseId)).size,
      irelReceived:
        receivedRows.length === 0 ? null : computeIrel(receivedRows).value,
      irelGranted:
        grantedRows.length === 0 ? null : computeIrel(grantedRows).value,
    };
  });

  nodes.sort(
    (a, b) =>
      ZONE_ORDER.indexOf(a.zone) - ZONE_ORDER.indexOf(b.zone) ||
      b.motricidad - a.motricidad ||
      b.dependencia - a.dependencia ||
      a.name.localeCompare(b.name, 'es'),
  );

  return {
    nodes,
    edges: edges.sort((a, b) => b.weight - a.weight),
    internalPairs,
    mean: round(mean),
    thresholds,
  };
}

/** Los dos niveles: cada área como nodo, y cada gestión como nodo. */
export function buildInfluence(
  rows: RawAnswerRow[],
  areas: InfluenceArea[],
): { areas: RawInfluenceLevel; gestiones: RawInfluenceLevel } {
  const byCode = new Map(areas.map((area) => [area.code, area]));

  const areaLevel = buildInfluenceLevel(
    rows,
    (code) => {
      const area = byCode.get(code);
      return area ? { code: area.code, name: area.name } : null;
    },
    (code) => {
      const area = byCode.get(code);
      return area?.groupCode
        ? { code: area.groupCode, name: area.groupName ?? area.groupCode }
        : null;
    },
  );

  const gestionLevel = buildInfluenceLevel(
    rows,
    (code) => {
      const area = byCode.get(code);
      return area?.groupCode
        ? { code: area.groupCode, name: area.groupName ?? area.groupCode }
        : null;
    },
    () => null,
  );

  return { areas: areaLevel, gestiones: gestionLevel };
}
