/**
 * Contrato de la capa de indicadores.
 *
 * Las funciones de indicador son PURAS: reciben filas crudas y devuelven un número.
 * No conocen Prisma, ni la regla de cohorte mínima, ni los umbrales. Eso las hace
 * testeables sin base de datos, que es la única forma de validar las fórmulas del
 * instrumento mientras no exista Supabase.
 */

/** Fila cruda de `answers` unida a su respuesta, tal como la traen los repositorios. */
export interface RawAnswerRow {
  responseId: string;
  /** Área del encuestado (1.1). `null` si aún no la declaró. */
  ownArea: string | null;
  /** Área evaluada, o el centinela '__GLOBAL__' para preguntas globales. */
  targetArea: string;
  questionCode: string;
  valueNumber: number | null;
  valueOption: string | null;
  valueOptions: string[];
}

/** Códigos de indicador del instrumento (Contexto.md §4.3). */
export type IndicatorCode =
  | 'NIO'
  | 'IREL'
  | 'ICONF'
  | 'IVAL'
  | 'ICOM'
  | 'ISI'
  | 'IAG'
  | 'IINT'
  | 'ICOL'
  | 'IINN';

/** Índice compuesto, reportado aparte porque se calcula a partir de los demás. */
export type CompositeCode = 'IMC';

/** El NPS va aparte: su escala es -100..100, no 0..100. */
export type NpsCode = 'NPS_INT';

/**
 * Resultado de un indicador. `value` es `null` cuando no hubo ninguna respuesta que
 * promediar — se distingue de 0, que es una calificación real de "muy deficiente".
 */
export interface IndicatorResult {
  code: IndicatorCode | CompositeCode;
  /** 0-100, o `null` si no hay datos. */
  value: number | null;
  /** Número de respuestas distintas que aportaron al cálculo. */
  respondents: number;
  /** Número de valores individuales promediados. */
  observations: number;
}

export interface NpsResult {
  code: NpsCode;
  /** -100..100, o `null` si no hay datos. */
  value: number | null;
  promoters: number;
  passives: number;
  detractors: number;
  /** Total de pares (encuestado, área evaluada) contados. */
  total: number;
}

/** Clasificación semafórica leída de `indicator_thresholds`. */
export interface ThresholdBand {
  label: string;
  minValue: number;
  maxValue: number;
  color: string;
}

/**
 * Envoltura estándar de toda respuesta analítica.
 *
 * `insufficient` es la regla de anonimato: cuando el corte tiene menos respuestas que
 * `MIN_COHORT_SIZE`, `data` viene vacío y el front muestra el aviso en vez del dato.
 */
export interface AnalyticsEnvelope<T> {
  data: T | null;
  meta: {
    n: number;
    insufficient: boolean;
    minCohortSize: number;
    generatedAt: string;
  };
}
