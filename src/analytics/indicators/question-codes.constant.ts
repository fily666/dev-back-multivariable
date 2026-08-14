import type { IndicatorCode } from './indicator.types';

/**
 * Qué `question_code` alimenta cada indicador. Los repositorios lo usan para traer en una
 * sola consulta todo lo que necesita un cálculo, en vez de un viaje a la base por índice.
 */
export const QUESTION_CODES_BY_INDICATOR: Record<
  IndicatorCode,
  readonly string[]
> = {
  NIO: ['c1_frecuencia', 'c1_areas_interaccion', 'c1_tipo_interaccion'],
  IREL: [
    'c2_facilidad',
    'c2_comunicacion',
    'c2_confianza',
    'c2_cumplimiento',
    'c2_valor',
  ],
  ICONF: ['c2_confianza'],
  IVAL: ['c2_valor'],
  ICOM: [
    'c3_oportunidad',
    'c3_claridad',
    'c3_comprension',
    'c3_canales',
    'c3_reproceso',
  ],
  ISI: [
    'c4_disposicion',
    'c4_comprension',
    'c4_seguimiento',
    'c4_compromisos',
    'c4_valor',
  ],
  IAG: [
    'c5_cumplimiento_tiempos',
    'c5_capacidad_respuesta',
    'c5_facilidad_resolver',
    'c5_seguimiento',
    'c5_tiempo_respuesta',
  ],
  IINT: [
    'c6_impacto',
    'c6_roles',
    'c6_coordinacion',
    'c6_reprocesos',
    'c6_responsabilidades',
  ],
  ICOL: [
    'c7_conocimiento',
    'c7_confianza',
    'c7_soluciones',
    'c7_aprendizaje',
    'c7_objetivos',
  ],
  IINN: [
    'c8_disposicion',
    'c8_apertura',
    'c8_capacidad_mejoras',
    'c8_aprendizaje',
    'c8_areas_iniciativas',
  ],
};

/** Los 4 ítems de escala del C5; el 5.º código de IAG es la opción de tiempo. */
export const IAG_SCALE_CODES = QUESTION_CODES_BY_INDICATOR.IAG.slice(0, 4);
export const IAG_TIME_CODE = 'c5_tiempo_respuesta';

/** Los 4 ítems de escala del C8; el 5.º código de IINN es la multi de iniciativas. */
export const IINN_SCALE_CODES = QUESTION_CODES_BY_INDICATOR.IINN.slice(0, 4);
export const IINN_PARTNERS_CODE = 'c8_areas_iniciativas';

/** Opción de 8.1 que no cuenta como área colaboradora. */
export const NO_PARTNER_OPTION = 'NINGUNA';

export const NPS_CODE = 'c9_nps';
export const NPS_MOTIVES_CODE = 'c9_motivos';

/** Los 7 indicadores que componen el IMC (Contexto.md §4.4). */
export const IMC_COMPONENT_CODES: readonly IndicatorCode[] = [
  'IREL',
  'ICOM',
  'ISI',
  'IAG',
  'IINT',
  'ICOL',
  'IINN',
];

/**
 * Series del radar del dashboard: los 7 del IMC más NIO.
 *
 * Quedan fuera a propósito ICONF e IVAL (son sub-facetas de IREL, ya representada, y
 * duplicarlas haría parecer que el relacionamiento pesa el triple) y NPS_INT (su escala es
 * −100..100 y no cabe en un radar 0..100 sin distorsionar la figura).
 */
export const RADAR_INDICES: readonly { code: IndicatorCode; label: string }[] =
  [
    { code: 'IREL', label: 'Relacionamiento' },
    { code: 'ICOM', label: 'Comunicación' },
    { code: 'ISI', label: 'Servicio interno' },
    { code: 'IAG', label: 'Agilidad' },
    { code: 'IINT', label: 'Integración' },
    { code: 'ICOL', label: 'Colaboración' },
    { code: 'IINN', label: 'Innovación' },
    { code: 'NIO', label: 'Interacción' },
  ];

/** Nombre legible de cada indicador, para tablas y tooltips. */
export const INDICATOR_LABELS: Record<
  IndicatorCode | 'IMC' | 'NPS_INT',
  string
> = {
  NIO: 'Nivel de Interacción Organizacional',
  IREL: 'Índice de Relacionamiento',
  ICONF: 'Índice de Confianza',
  IVAL: 'Índice de Valor',
  ICOM: 'Índice de Comunicación',
  ISI: 'Índice de Servicio Interno',
  IAG: 'Índice de Agilidad',
  IINT: 'Índice de Integración',
  ICOL: 'Índice de Colaboración',
  IINN: 'Índice de Innovación Colaborativa',
  IMC: 'Índice de Madurez Colaborativa',
  NPS_INT: 'NPS Interno',
};
