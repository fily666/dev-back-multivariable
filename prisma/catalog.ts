/**
 * Catálogo del Instrumento de Diagnóstico Organizacional LinkTIC.
 * Transcrito de "Diagnóstico Organizacional.pdf" vía Contexto.md §3.3.
 * Los textos de `label` e `intro` son literales del instrumento.
 */

export const GLOBAL_AREA_CODE = '__GLOBAL__';

type QuestionType = 'SINGLE' | 'MULTI' | 'SCALE_0_10' | 'TEXT' | 'MATRIX_AREA';
type OptionSource = 'STATIC' | 'AREAS' | 'PROCESOS';

export interface OptionSeed {
  value: string;
  label: string;
  allowsText?: boolean;
  exclusive?: boolean;
}

export interface QuestionSeed {
  code: string;
  componentId: number;
  label: string;
  helpText?: string;
  type: QuestionType;
  required?: boolean;
  minSelect?: number;
  maxSelect?: number;
  perArea?: boolean;
  optionSource?: OptionSource;
  maxLength?: number;
  options?: OptionSeed[];
}

// ============ ÁREAS ============
// Catálogo unificado. El PDF lista conjuntos distintos en 1.1 y 1.2; se unifican para
// que el mapa de relacionamiento sea una matriz cuadrada y coherente.
export const AREAS = [
  { code: 'COMERCIAL', name: 'Comercial', sortOrder: 1 },
  { code: 'INNOVACION', name: 'Innovación', sortOrder: 2 },
  { code: 'TECNOLOGIA', name: 'Tecnología', sortOrder: 3 },
  { code: 'PMO', name: 'PMO', sortOrder: 4 },
  { code: 'TALENTO_HUMANO', name: 'Talento Humano', sortOrder: 5 },
  { code: 'JURIDICA', name: 'Jurídica', sortOrder: 6 },
  { code: 'FINANCIERA', name: 'Financiera', sortOrder: 7 },
];

// Centinela para respuestas globales (no por área). Nunca se muestra al encuestado.
export const SENTINEL_AREA = {
  code: GLOBAL_AREA_CODE,
  name: '(Global)',
  isEvaluable: false,
  active: false,
  sortOrder: 999,
};

// ============ PROCESOS ============
// SUPUESTO: el PDF marca esta pregunta como "(Lista)" sin definir el contenido.
// Semilla propuesta — validar con LinkTIC antes de producción (Contexto.md §11.2).
export const PROCESOS = [
  { code: 'PREVENTA', name: 'Preventa', ownerArea: 'COMERCIAL', sortOrder: 1 },
  {
    code: 'CONTRATACION',
    name: 'Contratación',
    ownerArea: 'JURIDICA',
    sortOrder: 2,
  },
  {
    code: 'GESTION_PROYECTOS',
    name: 'Gestión de proyectos',
    ownerArea: 'PMO',
    sortOrder: 3,
  },
  {
    code: 'DESARROLLO',
    name: 'Desarrollo',
    ownerArea: 'TECNOLOGIA',
    sortOrder: 4,
  },
  {
    code: 'DESPLIEGUE_SOPORTE',
    name: 'Despliegue y soporte',
    ownerArea: 'TECNOLOGIA',
    sortOrder: 5,
  },
  {
    code: 'FACTURACION',
    name: 'Facturación',
    ownerArea: 'FINANCIERA',
    sortOrder: 6,
  },
  { code: 'COMPRAS', name: 'Compras', ownerArea: 'FINANCIERA', sortOrder: 7 },
  {
    code: 'SELECCION_PERSONAL',
    name: 'Selección y contratación de personal',
    ownerArea: 'TALENTO_HUMANO',
    sortOrder: 8,
  },
  {
    code: 'REQUERIMIENTOS',
    name: 'Requerimientos',
    ownerArea: 'PMO',
    sortOrder: 9,
  },
];

// ============ COMPONENTES ============
export const COMPONENTS = [
  {
    id: 1,
    code: 'c1_relacionamiento',
    title: 'Caracterización del relacionamiento',
    intro:
      'Este componente permitirá construir posteriormente el mapa de relacionamiento organizacional.',
  },
  {
    id: 2,
    code: 'c2_red_colaboracion',
    title: 'Red de colaboración',
    intro:
      'Comprender cómo funciona LinkTIC, permitirá fortalecer una red más colaborativa entre procesos.',
  },
  {
    id: 3,
    code: 'c3_comunicacion',
    title: 'Comunicación organizacional',
    intro:
      'Evaluar la trazabilidad, claridad y oportunidad de la información dentro de la organización nos orienta sobre cómo potabilizar nuestros lenguajes y comunicación interna, consolidando una narrativa de alto valor.',
  },
  {
    id: 4,
    code: 'c4_servicio_interno',
    title: 'Servicio interno',
    intro:
      'Este componente permite identificar qué tan eficientes somos en la gestión interna y en la atención de solicitudes entre áreas.',
  },
  {
    id: 5,
    code: 'c5_agilidad',
    title: 'Agilidad organizacional',
    intro:
      'Como método de trabajo es importante saber cómo el equipo ha consolidado su capacidad de respuesta frente a solicitudes internas y necesidades de gestión.',
  },
  {
    id: 6,
    code: 'c6_integracion',
    title: 'Integración de procesos',
    intro:
      'Este capítulo brinda una orientación frente a la claridad de roles, responsabilidades y coordinación entre procesos.',
  },
  {
    id: 7,
    code: 'c7_cultura',
    title: 'Cultura colaborativa',
    intro:
      'Como compañía qué tipo de prácticas estamos construyendo en pro del trabajo conjunto, el aprendizaje compartido y la construcción de soluciones entre áreas.',
  },
  {
    id: 8,
    code: 'c8_innovacion',
    title: 'Innovación organizacional',
    intro:
      'Este componente permite identificar la disposición para innovar, la apertura al cambio y la capacidad de implementar mejoras colaborativas.',
  },
  {
    id: 9,
    code: 'c9_experiencia',
    title: 'Experiencia de servicio interno',
    intro:
      'Este componente está establecido para medir la experiencia de servicio entre áreas mediante el NPS interno.',
  },
  {
    id: 10,
    code: 'c10_transformacion',
    title: 'Oportunidades de transformación',
    intro:
      'Como elemento que permite nutrir otras acciones que se vienen desarrollando al interior de la empresa, este ítem permite identificar barreras, oportunidades y prioridades de mejora para fortalecer el trabajo entre áreas.',
  },
];

const OTRA_OPTION: OptionSeed = {
  value: 'OTRA',
  label: 'Otra',
  allowsText: true,
};
const SCALE_HELP = '0 significa muy deficiente y 10 significa excelente.';

/** Genera las 5 baterías de escala 0-10 que comparten estructura (C3, C4, C6, C7). */
const scale = (
  code: string,
  componentId: number,
  label: string,
): QuestionSeed => ({
  code,
  componentId,
  label,
  type: 'SCALE_0_10',
  helpText: SCALE_HELP,
});

// ============ PREGUNTAS ============
export const QUESTIONS: QuestionSeed[] = [
  // --- Componente 1 ---
  {
    code: 'c1_area_propia',
    componentId: 1,
    label: '¿A qué área pertenece?',
    helpText: 'Marque una sola opción.',
    type: 'SINGLE',
    optionSource: 'AREAS',
    options: [OTRA_OPTION],
  },
  {
    code: 'c1_areas_interaccion',
    componentId: 1,
    label: '¿Con cuáles áreas interactúa de manera frecuente?',
    helpText: 'Seleccione máximo cinco opciones. No incluya su propia área.',
    type: 'MULTI',
    minSelect: 1,
    maxSelect: 5,
    optionSource: 'AREAS',
    options: [OTRA_OPTION],
  },
  {
    code: 'c1_frecuencia',
    componentId: 1,
    label: 'Frecuencia de interacción',
    helpText: 'Marque una sola opción.',
    type: 'SINGLE',
    options: [
      { value: 'DIARIA', label: 'Diaria' },
      { value: 'VARIAS_SEMANA', label: 'Varias veces por semana' },
      { value: 'SEMANAL', label: 'Semanal' },
      { value: 'MENSUAL', label: 'Mensual' },
      { value: 'ESPORADICA', label: 'Esporádica' },
    ],
  },
  {
    code: 'c1_tipo_interaccion',
    componentId: 1,
    label: 'Tipo de interacción predominante',
    helpText: 'Marque las opciones que correspondan.',
    type: 'MULTI',
    minSelect: 1,
    options: [
      { value: 'OPERATIVA', label: 'Operativa' },
      { value: 'TACTICA', label: 'Táctica' },
      { value: 'ESTRATEGICA', label: 'Estratégica' },
      { value: 'COMERCIAL', label: 'Comercial' },
      { value: 'SOPORTE', label: 'Soporte' },
    ],
  },

  // --- Componente 2 (por área evaluada) ---
  {
    code: 'c2_facilidad',
    componentId: 2,
    label: 'Facilidad para trabajar',
    type: 'MATRIX_AREA',
    perArea: true,
    helpText: SCALE_HELP,
  },
  {
    code: 'c2_comunicacion',
    componentId: 2,
    label: 'Comunicación',
    type: 'MATRIX_AREA',
    perArea: true,
    helpText: SCALE_HELP,
  },
  {
    code: 'c2_confianza',
    componentId: 2,
    label: 'Confianza',
    type: 'MATRIX_AREA',
    perArea: true,
    helpText: SCALE_HELP,
  },
  {
    code: 'c2_cumplimiento',
    componentId: 2,
    label: 'Cumplimiento',
    type: 'MATRIX_AREA',
    perArea: true,
    helpText: SCALE_HELP,
  },
  {
    code: 'c2_valor',
    componentId: 2,
    label: 'Generación de valor',
    type: 'MATRIX_AREA',
    perArea: true,
    helpText: SCALE_HELP,
  },

  // --- Componente 3 ---
  scale('c3_oportunidad', 3, 'La información llega oportunamente'),
  scale('c3_claridad', 3, 'La comunicación es clara'),
  scale('c3_comprension', 3, 'Comprendemos fácilmente los requerimientos'),
  scale('c3_canales', 3, 'Los canales funcionan adecuadamente'),
  scale('c3_reproceso', 3, 'Se evita el reproceso por mala comunicación'),

  // --- Componente 4 ---
  scale('c4_disposicion', 4, 'Existe disposición para ayudar'),
  scale('c4_comprension', 4, 'Comprenden nuestras necesidades'),
  scale('c4_seguimiento', 4, 'Dan seguimiento a las solicitudes'),
  scale('c4_compromisos', 4, 'Cumplen los compromisos'),
  scale('c4_valor', 4, 'Agregan valor al proceso'),

  // --- Componente 5 ---
  {
    code: 'c5_tiempo_respuesta',
    componentId: 5,
    label: 'Cuando realiza solicitudes, normalmente recibe respuesta en:',
    type: 'SINGLE',
    options: [
      { value: 'MENOS_2H', label: 'Menos de 2 horas' },
      { value: 'MISMO_DIA', label: 'Mismo día' },
      { value: 'H24', label: '24 horas' },
      { value: 'H48', label: '48 horas' },
      { value: 'MAS_3_DIAS', label: 'Más de tres días' },
    ],
  },
  scale('c5_cumplimiento_tiempos', 5, 'Cumplimiento de tiempos'),
  scale('c5_capacidad_respuesta', 5, 'Capacidad de respuesta'),
  scale('c5_facilidad_resolver', 5, 'Facilidad para resolver solicitudes'),
  scale('c5_seguimiento', 5, 'Seguimiento'),

  // --- Componente 6 ---
  scale('c6_impacto', 6, 'Conozco cómo mi proceso impacta otros procesos'),
  scale('c6_roles', 6, 'Existe claridad en los roles'),
  scale('c6_coordinacion', 6, 'Hay coordinación entre áreas'),
  scale('c6_reprocesos', 6, 'Se minimizan los reprocesos'),
  scale('c6_responsabilidades', 6, 'Las responsabilidades son claras'),

  // --- Componente 7 ---
  scale('c7_conocimiento', 7, 'Compartimos conocimiento'),
  scale('c7_confianza', 7, 'Existe confianza'),
  scale('c7_soluciones', 7, 'Buscamos soluciones conjuntamente'),
  scale('c7_aprendizaje', 7, 'Hay apertura al aprendizaje'),
  scale('c7_objetivos', 7, 'Trabajamos por objetivos comunes'),

  // --- Componente 8 ---
  {
    code: 'c8_areas_iniciativas',
    componentId: 8,
    label:
      'Seleccione las áreas con las que ha desarrollado iniciativas nuevas durante los últimos seis meses.',
    // SUPUESTO: el PDF deja las opciones como "□ …" sin listarlas (Contexto.md §11.1).
    type: 'MULTI',
    required: false,
    optionSource: 'AREAS',
    options: [{ value: 'NINGUNA', label: 'Ninguna', exclusive: true }],
  },
  scale('c8_disposicion', 8, 'Disposición para innovar'),
  scale('c8_apertura', 8, 'Apertura al cambio'),
  scale('c8_capacidad_mejoras', 8, 'Capacidad para implementar mejoras'),
  scale('c8_aprendizaje', 8, 'Aprendizaje compartido'),

  // --- Componente 9 (NPS por área evaluada) ---
  {
    code: 'c9_nps',
    componentId: 9,
    label: '¿Qué tan probable es que recomiende trabajar con esta área?',
    helpText: '0 significa nada probable y 10 significa totalmente probable.',
    type: 'SCALE_0_10',
    perArea: true,
  },
  {
    code: 'c9_motivos',
    componentId: 9,
    label: '¿Por qué dio esa calificación?',
    helpText: 'Marque una o varias opciones.',
    type: 'MULTI',
    minSelect: 1,
    options: [
      { value: 'COMUNICACION', label: 'Comunicación' },
      { value: 'SERVICIO', label: 'Servicio' },
      { value: 'RAPIDEZ', label: 'Rapidez' },
      { value: 'CONOCIMIENTO', label: 'Conocimiento' },
      { value: 'ACTITUD', label: 'Actitud' },
      { value: 'COMPROMISO', label: 'Compromiso' },
      { value: 'OTRO', label: 'Otro', allowsText: true },
    ],
  },

  // --- Componente 10 ---
  {
    code: 'c10_obstaculo',
    componentId: 10,
    label:
      '¿Cuál considera que hoy es el mayor obstáculo para trabajar entre áreas?',
    helpText: 'Marque una o varias opciones.',
    type: 'MULTI',
    minSelect: 1,
    options: [
      { value: 'COMUNICACION', label: 'Comunicación' },
      { value: 'PROCESOS', label: 'Procesos' },
      { value: 'TECNOLOGIA', label: 'Tecnología' },
      { value: 'ROLES', label: 'Roles' },
      { value: 'LIDERAZGO', label: 'Liderazgo' },
      { value: 'PLANEACION', label: 'Planeación' },
      { value: 'PRIORIDADES', label: 'Prioridades' },
      { value: 'CULTURA', label: 'Cultura' },
    ],
  },
  {
    code: 'c10_proceso_reprocesos',
    componentId: 10,
    label: '¿Qué proceso genera más reprocesos?',
    type: 'SINGLE',
    optionSource: 'PROCESOS',
    options: [{ value: 'OTRO', label: 'Otro', allowsText: true }],
  },
  {
    code: 'c10_area_mayor_valor',
    componentId: 10,
    label: '¿Qué área genera mayor valor para LinkTIC?',
    type: 'SINGLE',
    optionSource: 'AREAS',
  },
  {
    code: 'c10_area_fortalecer',
    componentId: 10,
    label: '¿Qué área considera que necesita fortalecer su relacionamiento?',
    type: 'SINGLE',
    optionSource: 'AREAS',
  },
  {
    code: 'c10_cambio_unico',
    componentId: 10,
    label:
      'Si pudiera cambiar una sola cosa de LinkTIC para mejorar el trabajo entre áreas, ¿cuál sería?',
    type: 'TEXT',
    required: false,
    maxLength: 1000,
  },
];

// ============ PESOS DEL ÍNDICE COMPUESTO (IMC) ============
// Deben sumar 1.000 — el back lo valida al leerlos (Contexto.md §4.4).
export const INDICATOR_WEIGHTS = [
  { indicatorCode: 'IREL', weight: 0.2 },
  { indicatorCode: 'ICOM', weight: 0.15 },
  { indicatorCode: 'ISI', weight: 0.15 },
  { indicatorCode: 'IAG', weight: 0.15 },
  { indicatorCode: 'IINT', weight: 0.15 },
  { indicatorCode: 'ICOL', weight: 0.1 },
  { indicatorCode: 'IINN', weight: 0.1 },
];

// ============ SEMAFORIZACIÓN ============
// Rangos de Contexto.md §4.2. Los colores viven aquí y no en el front, para que el
// admin pueda ajustarlos sin desplegar.
export const INDICATOR_THRESHOLDS = [
  {
    label: 'Fortaleza',
    minValue: 80,
    maxValue: 100,
    color: '#0F7B3F',
    sortOrder: 1,
  },
  {
    label: 'Aceptable',
    minValue: 60,
    maxValue: 79.99,
    color: '#B58200',
    sortOrder: 2,
  },
  {
    label: 'En riesgo',
    minValue: 40,
    maxValue: 59.99,
    color: '#C2570F',
    sortOrder: 3,
  },
  {
    label: 'Crítico',
    minValue: 0,
    maxValue: 39.99,
    color: '#B3261E',
    sortOrder: 4,
  },
];
