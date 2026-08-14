import type {
  IndicatorResult,
  NpsResult,
  ThresholdBand,
} from '../indicators/indicator.types';

/** Filtros globales del dashboard (Contexto.md §4.5). */
export interface AnalyticsFilters {
  campaignId?: string;
  ownArea?: string;
  frecuencia?: string;
  tipoInteraccion?: string;
  from?: string;
  to?: string;
}

export interface ScoredValue {
  value: number | null;
  band: ThresholdBand | null;
}

/** Tarjetas superiores del dashboard: KPIs 1-6. */
export interface OverviewCards {
  imc: ScoredValue & { respondents: number };
  nps: NpsResult;
  participation: {
    completed: number;
    population: number | null;
    rate: number | null;
  };
  completion: {
    completed: number;
    started: number;
    rate: number | null;
  };
  medianDurationSeconds: number | null;
  topValueArea: { code: string; name: string; mentions: number } | null;
}

/** KPI 7: radar de los 8 índices (los 7 del IMC más NIO). */
export interface RadarPoint {
  code: string;
  label: string;
  value: number | null;
  band: ThresholdBand | null;
}

/** KPI 8: ranking de áreas por índice de relacionamiento. */
export interface AreaRankingRow {
  areaCode: string;
  areaName: string;
  irel: number | null;
  respondents: number;
  band: ThresholdBand | null;
}

/** KPI 9 y 10: matriz evaluador x evaluada, base del mapa de relacionamiento. */
export interface RelationshipCell {
  sourceArea: string;
  targetArea: string;
  irel: number | null;
  iconf: number | null;
  ival: number | null;
  respondents: number;
  /** Menciones ponderadas por frecuencia de interacción: grosor de la arista. */
  weight: number;
}

export interface RelationshipMap {
  areas: { code: string; name: string }[];
  cells: RelationshipCell[];
  /** Grado ponderado por área, para dimensionar los nodos. */
  degrees: { areaCode: string; inbound: number; outbound: number }[];
}

/** KPI 11: brecha entre lo que un área recibe y lo que otorga. */
export interface PerceptionGapRow {
  areaCode: string;
  areaName: string;
  received: number | null;
  granted: number | null;
  gap: number | null;
}

/** KPI 12: los 5 aspectos del C2 desglosados por área evaluada. */
export interface AspectMatrixRow {
  areaCode: string;
  areaName: string;
  aspects: Record<string, number | null>;
  respondents: number;
}

/** KPI 13: distribución de tiempos de respuesta percibidos. */
export interface DistributionRow {
  value: string;
  label: string;
  count: number;
  share: number;
}

/** KPIs 14, 15, 16, 18: conteos de opciones. */
export interface CountedOption {
  value: string;
  label: string;
  count: number;
  share: number;
}

/** KPI 17: red de iniciativas conjuntas de innovación. */
export interface InnovationEdge {
  sourceArea: string;
  targetArea: string;
  initiatives: number;
}

/** KPI 19: respuestas abiertas con su tema editable. */
export interface OpenAnswer {
  id: string;
  text: string;
  theme: string | null;
  ownArea: string | null;
  submittedAt: string | null;
}

/** KPI 20: los índices cruzados por área de origen. */
export interface IndicesByOriginRow {
  areaCode: string;
  areaName: string;
  respondents: number;
  indicators: Record<string, number | null>;
}

export interface IndicatorsPayload {
  indicators: IndicatorResult[];
  composite: IndicatorResult;
  nps: NpsResult;
  radar: RadarPoint[];
  thresholds: ThresholdBand[];
  weights: { indicatorCode: string; weight: number }[];
}

export interface QualitativePayload {
  barriers: CountedOption[];
  reworkProcesses: CountedOption[];
  areasToStrengthen: CountedOption[];
  npsMotives: {
    promoters: CountedOption[];
    detractors: CountedOption[];
  };
  openAnswers: OpenAnswer[];
}
