import type {
  IndicatorResult,
  NpsResult,
  ThresholdBand,
} from '../indicators/indicator.types';

/** Filtros globales del dashboard (Contexto.md §4.5). */
export interface AnalyticsFilters {
  campaignId?: string;
  ownArea?: string;
  /** Nivel de cargo de quien responde, uno de `RESPONDENT_ROLES`. */
  respondentRole?: string;
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

/**
 * KPI 32: zona de un nodo en el plano de motricidad y dependencia. Motriz: mueve más de lo
 * típico y depende menos; de enlace: las dos por encima; dependiente: la mueven más de lo
 * que mueve; autónoma: las dos por debajo.
 */
export type InfluenceZone = 'MOTRIZ' | 'ENLACE' | 'DEPENDIENTE' | 'AUTONOMA';

/** Un área, o una gestión, en la red de influencias. */
export interface InfluenceNode {
  code: string;
  name: string;
  /** La gestión del área; `null` en el nivel de gestiones. */
  groupCode: string | null;
  groupName: string | null;
  /** Suma de la fuerza (1-3) de las relaciones en que otras dependen de esta. */
  motricidad: number;
  /** Suma de la fuerza de las relaciones en que esta depende de otras. */
  dependencia: number;
  /** Nodos distintos que dependen de este. */
  clients: number;
  /** Nodos distintos de los que este depende. */
  providers: number;
  zone: InfluenceZone;
  /** Personas que la evalúan. */
  receivedFrom: number;
  /** Personas de ella que evaluaron a otras. Con cero, su dependencia no se conoce. */
  grantedBy: number;
  /** IREL que recibe; `null` bajo la cohorte. */
  irelReceived: number | null;
  /** IREL que otorga; `null` bajo la cohorte. */
  irelGranted: number | null;
}

/** «`from` mueve a `to`»: la gente de `to` trabaja con `from` y depende de lo que entrega. */
export interface InfluenceEdge {
  from: string;
  to: string;
  /** 1 débil, 2 media, 3 fuerte: tercios del peso dentro del nivel. */
  strength: 1 | 2 | 3;
  /** Personas × frecuencia de interacción, como el peso del mapa. */
  weight: number;
  respondents: number;
  /** IREL que `to` le da a `from`. */
  irel: number | null;
}

export interface InfluenceLevel {
  /** Ordenados por zona y, dentro de cada una, de más a menos motriz. */
  nodes: InfluenceNode[];
  /** Solo las relaciones que alcanzan la cohorte. */
  edges: InfluenceEdge[];
  suppressedEdges: number;
  /** Relaciones entre áreas del mismo nodo (de la misma gestión), que no se dibujan. */
  internalPairs: number;
  /** La media que corta los dos ejes del plano: es la misma para los dos. */
  mean: number;
  /** Pesos desde los que una relación es media o fuerte; `null` si todas pesan igual. */
  thresholds: { media: number; fuerte: number } | null;
}

/** KPI 32: la red de influencias, por área y por gestión. */
export interface InfluencePayload {
  areas: InfluenceLevel;
  gestiones: InfluenceLevel;
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

/** Reparto de una opción única en el orden de su escala (hoy, la frecuencia de interacción). */
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

/**
 * Una afirmación 0-10 del instrumento, leída sola. Los índices promedian cinco ítems y
 * esconden cuál de ellos arrastra el resultado y si la nota es un acuerdo o un promedio de
 * opiniones opuestas.
 */
export interface ItemStat {
  /** Código de la pregunta. */
  code: string;
  label: string;
  componentId: number;
  componentTitle: string;
  /**
   * Índice al que alimenta, el primero en el orden del IMC; `NPS_INT` para la pregunta de
   * recomendación. Vacío si la pregunta aún no alimenta ningún índice.
   */
  indicatorCode: string;
  /** Respuestas distintas con al menos un valor. */
  respondents: number;
  /** Valores contados. Las preguntas por área aportan uno por cada área evaluada. */
  observations: number;
  /** Promedio en la escala 0-10, con dos decimales. */
  mean: number | null;
  /** El promedio llevado a 0-100 como los índices, con un decimal. */
  index: number | null;
  /** Desviación estándar poblacional en la escala 0-10, con dos decimales. */
  sd: number | null;
  /** 0-100: 100 es que todos dieron la misma nota; 0, la dispersión máxima posible. */
  consensus: number | null;
  /** Cuántas veces se dio cada nota: 11 posiciones, de la nota 0 a la 10. */
  distribution: number[];
}

export interface ItemsPayload {
  items: ItemStat[];
}

/** Los indicadores vistos desde un nivel de cargo, o desde un grupo de niveles. */
export interface RoleIndicesRow {
  /** Código del cargo, o del grupo en las filas de grupo. */
  key: string;
  label: string;
  respondents: number;
  /** Los 10 indicadores, por código. */
  indicators: Record<string, number | null>;
  /** IMC con los pesos vigentes. */
  imc: number | null;
  nps: number | null;
}

export type RoleGroupIndicesRow = RoleIndicesRow & { roles: string[] };

export interface IndicesByRolePayload {
  /** Los cargos en el orden de `RESPONDENT_ROLES`, solo los que alcanzan la cohorte. */
  roles: RoleIndicesRow[];
  /** Cargos con al menos una respuesta que no alcanzan la cohorte. */
  suppressedRoles: number;
  /** Los grupos de `ROLE_GROUPS`, en su orden, solo los que alcanzan la cohorte. */
  groups: RoleGroupIndicesRow[];
  suppressedGroups: number;
}

/** Cuánto se busca a un área: cuántos la mencionan y cuántos la tienen como relación principal. */
export interface NetworkDemandRow {
  areaCode: string;
  areaName: string;
  procesoName: string | null;
  /** Encuestados que la marcaron entre las áreas con las que interactúan. */
  mentions: number;
  /** Encuestados que la marcaron como su relación principal. */
  principal: number;
  /** menciones / encuestados de la pregunta, en %, con un decimal. */
  mentionShare: number;
}

/** Un área que se busca, cruzada con cómo la califican quienes trabajan con ella. */
export interface NetworkImportanceRow {
  areaCode: string;
  areaName: string;
  mentions: number;
  /** IREL que el área RECIBE. */
  irel: number;
  /** Encuestados que sostienen ese IREL. */
  respondents: number;
}

/** Cuántas veces se eligió un área como la de mayor valor y como la que debe fortalecerse. */
export interface NetworkValueRow {
  areaCode: string;
  areaName: string;
  value: number;
  strengthen: number;
}

export interface NetworkInnovation {
  /** Respuestas que contestaron la 8.1. */
  respondents: number;
  /** De ellas, las que marcaron NINGUNA, en %, con un decimal. */
  noneShare: number;
  /** Áreas evaluables que aparecen en al menos una iniciativa con otra área. */
  connectedAreas: number;
  /** Áreas evaluables que no aparecen en ninguna. */
  isolated: { areaCode: string; areaName: string }[];
}

/** Quién trabaja con quién, con qué frecuencia y para qué (componentes 1, 8 y 10). */
export interface NetworkPayload {
  /** Respuestas que contestaron con qué áreas interactúan. */
  respondents: number;
  /** Todas las áreas evaluables, con ceros, de la más a la menos mencionada. */
  demand: NetworkDemandRow[];
  importance: NetworkImportanceRow[];
  /** Frecuencia de interacción en el orden de la escala, con ceros. */
  frequency: DistributionRow[];
  /** Tipos de interacción, de más a menos marcados; el % es sobre encuestados. */
  interactionTypes: CountedOption[];
  valueVsStrengthen: NetworkValueRow[];
  innovation: NetworkInnovation;
}

/**
 * Qué tanto se puede confiar en el corte: señales de respuestas dadas sin leer. Habla de
 * cómo se respondió, no de qué se respondió.
 */
export interface QualityPayload {
  completed: number;
  /** Completadas en menos de `thresholdSeconds`; el % es sobre las que tienen duración. */
  speeders: { thresholdSeconds: number; count: number; share: number | null };
  /** Completadas con todos sus ítems globales 0-10 idénticos (al menos `minItems`). */
  straightLining: { count: number; share: number | null; minItems: number };
  /** Por componente 3-8: respuestas con la misma nota en todos sus ítems. */
  flatComponents: {
    componentId: number;
    title: string;
    count: number;
    share: number | null;
  }[];
  /** Completadas que escribieron algo en la pregunta abierta final. */
  openAnswers: { count: number; share: number | null };
  /** Respuestas que eligieron "Otra/Otro" y escribieron cuál. */
  otherSpecified: number;
}
