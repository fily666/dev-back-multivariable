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

/**
 * Monitoreo de participación en vivo: cuántos entraron, cuántos terminaron y dónde se
 * quedaron los demás. Habla de conteos y tiempos, nunca de lo que se respondió.
 */
export interface MonitoringPayload {
  /** Zona en la que se cortan los días, las horas y el "hoy" de todo el payload. */
  timezone: 'America/Bogota';
  totals: MonitoringTotals;
  /**
   * Un día calendario por entrada, continuo y con ceros, desde el primer `startedAt` hasta
   * hoy. Con más de 120 días se conservan los últimos 120. Vacío si no hay respuestas.
   */
  timeline: MonitoringTimelineDay[];
  /** Envíos por día de la semana × hora local. Solo las celdas con al menos uno. */
  heatmap: MonitoringHeatmapCell[];
  /** Cuántas respuestas llegaron al menos hasta cada componente, en el orden del instrumento. */
  funnel: MonitoringFunnelStep[];
  /** Dónde se detuvieron los borradores: último componente guardado, con el 0 incluido. */
  dropOff: MonitoringDropOffStep[];
  /** Histograma de duraciones de las completadas, con tramos fijos y todos presentes. */
  durations: MonitoringDurationBucket[];
  /** Todas las áreas activas del catálogo (OTRA incluida), con ceros y su gestión. */
  byArea: MonitoringAreaRow[];
  /** Los 7 cargos en el orden en que se declaran, con ceros. */
  byRole: MonitoringRoleRow[];
  /** Respuestas, de cualquier estado, que aún no declaran su área. */
  unidentified: number;
}

export interface MonitoringTotals {
  /** Todas las respuestas del corte: borradores más completadas. */
  started: number;
  completed: number;
  drafts: number;
  /** Borradores con actividad en los últimos 30 minutos. */
  activeNow: number;
  /** Borradores sin actividad desde hace más de 24 horas. */
  stalled: number;
  /** completadas / iniciadas, en %, con un decimal. `null` si nadie ha iniciado. */
  completionRate: number | null;
  /** Suma del `headcount` de las áreas, o `null` si ninguna lo tiene definido. */
  population: number | null;
  /** completadas / población, en %, con un decimal. `null` sin población. */
  participationRate: number | null;
  medianDurationSeconds: number | null;
  /** Completadas cuyo envío cae en la fecha de hoy en Bogotá. */
  completedToday: number;
  /** ISO del envío más reciente. */
  lastSubmittedAt: string | null;
  /** ISO de la última escritura sobre cualquier respuesta, borradores incluidos. */
  lastActivityAt: string | null;
}

export interface MonitoringTimelineDay {
  /** YYYY-MM-DD en la zona del monitoreo. */
  date: string;
  started: number;
  completed: number;
  cumulativeStarted: number;
  cumulativeCompleted: number;
}

export interface MonitoringHeatmapCell {
  /** 0 = lunes … 6 = domingo. */
  weekday: number;
  /** 0-23, hora local. */
  hour: number;
  completed: number;
}

export interface MonitoringFunnelStep {
  componentId: number;
  title: string;
  /** Completadas más los borradores cuyo último paso guardado es este o uno posterior. */
  reached: number;
}

export interface MonitoringDropOffStep {
  /** 0 = abrió la encuesta y no guardó ningún paso. */
  componentId: number;
  title: string;
  drafts: number;
}

export interface MonitoringDurationBucket {
  label: string;
  /** Límite inferior, incluido. */
  minSeconds: number;
  /** Límite superior, excluido. `null` en el último tramo, que es abierto. */
  maxSeconds: number | null;
  count: number;
}

export interface MonitoringAreaRow {
  areaCode: string;
  areaName: string;
  procesoCode: string | null;
  procesoName: string | null;
  completed: number;
  drafts: number;
  headcount: number | null;
  /** completadas / headcount, en %, con un decimal. `null` sin headcount. */
  participationRate: number | null;
}

export interface MonitoringRoleRow {
  value: string;
  label: string;
  completed: number;
  drafts: number;
}
