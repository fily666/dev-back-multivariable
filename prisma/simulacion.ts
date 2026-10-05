/**
 * Generador de respuestas SIMULADAS del diagnóstico, para ver el panel con datos antes de
 * la recolección real. Ninguna viene de una persona.
 *
 * Es determinista: un generador pseudoaleatorio de semilla fija produce exactamente las
 * mismas respuestas en cada corrida, así que una cifra del panel se puede reproducir. Y es
 * puro: no toca la base. Lo que la escribe es `seed-simulacion.ts`.
 *
 * Los datos no son ruido uniforme, que daría un panel plano donde todo ronda el 5. Cada
 * encuestado trae su propia indulgencia, el cargo mueve la nota (la dirección califica
 * mejor que los equipos), cada área tiene una reputación propia y cada afirmación su sesgo
 * —el reproceso sale peor que la disposición para ayudar—. Así el panel tiene algo que
 * concluir: áreas fuertes y débiles, brecha jerárquica, afirmaciones que tiran a la baja.
 */
import { GLOBAL_AREA_CODE } from '../src/common/constants.ts';
import { findMissingAnswers } from '../src/responses/rules/completeness.rule.ts';
import { runRules } from '../src/responses/rules/index.ts';
import type {
  CatalogQuestion,
  IncomingAnswer,
  RuleViolation,
} from '../src/responses/rules/index.ts';
import { AREAS, PROCESOS, QUESTIONS } from './catalog.ts';

export const TOTAL_SIMULADAS = 46;
export const SEMILLA = 20261005;

export interface RespuestaSimulada {
  ownArea: string;
  respondentRole: string;
  startedAt: Date;
  submittedAt: Date;
  durationSeconds: number;
  answers: IncomingAnswer[];
}

// ============ QUIÉN RESPONDE ============

/**
 * Cuántas personas responden desde cada subproceso. Concentra la participación donde están
 * los equipos grandes, como pasaría en la recolección real, y deja gestiones sin nadie: la
 * cobertura por área del monitoreo tiene que mostrar huecos. Desarrollo de software lleva
 * cinco a propósito: es el único subproceso con equipo suficiente para que alguno de sus
 * pares alcance la cohorte mínima de 4 en la matriz.
 */
const ENCUESTADOS_POR_AREA: Record<string, number> = {
  DESARROLLO_SOFTWARE: 5,
  QA: 2,
  DATOS: 2,
  ARQUITECTURA_SOFTWARE: 1,
  INFRAESTRUCTURA_FABRICA: 1,
  GOBIERNO_FABRICA: 1,
  MESA_AYUDA: 3,
  REQUERIMIENTOS: 2,
  ASEGURAMIENTO_PROYECTOS: 2,
  PMO: 3,
  AGILE: 1,
  GESTION_SERVICIOS: 1,
  COMERCIAL: 2,
  PREVENTA: 2,
  SOPORTE: 2,
  ATRACCION_TALENTO: 1,
  ADMINISTRACION_PERSONAL: 1,
  BIENESTAR_CULTURA: 1,
  COMPRAS: 1,
  TESORERIA: 1,
  CONTABLE: 1,
  NOMINA: 1,
  FINANCIERA: 1,
  CONTRATACION_PUBLICA: 2,
  LEGAL_PROYECTOS: 1,
  SEGURIDAD_INFORMACION: 1,
  SOC: 1,
  DISENO_UX_UI: 1,
  CALIDAD: 1,
  ESTRATEGIA_DIGITAL: 1,
};

/** Cargos del corte: la pirámide de una empresa de servicios, ancha en la base. */
const CARGOS: Record<string, number> = {
  DIRECTOR: 2,
  GERENTE: 3,
  HEAD: 4,
  COORDINADOR: 6,
  LIDER: 7,
  PROFESIONAL: 14,
  ANALISTA: 10,
};

/** Cuánto sube o baja la nota según el nivel: la brecha jerárquica que el panel busca. */
const EFECTO_CARGO: Record<string, number> = {
  DIRECTOR: 0.7,
  GERENTE: 0.6,
  HEAD: 0.5,
  COORDINADOR: 0.1,
  LIDER: 0.1,
  PROFESIONAL: -0.3,
  ANALISTA: -0.4,
};

// ============ CON QUIÉN SE RELACIONA ============

/** Cuánto lo buscan las demás áreas. Por defecto 1. */
const DEMANDA: Record<string, number> = {
  PMO: 6,
  DESARROLLO_SOFTWARE: 6,
  SOPORTE: 6,
  MESA_AYUDA: 4,
  REQUERIMIENTOS: 4,
  PREVENTA: 4,
  ADMINISTRACION_PERSONAL: 4,
  NOMINA: 4,
  COMPRAS: 4,
  COMERCIAL: 3,
  CONTRATACION_PUBLICA: 3,
  QA: 3,
  ARQUITECTURA_SOFTWARE: 3,
  ATRACCION_TALENTO: 3,
  LEGAL_PROYECTOS: 3,
  COMUNICACION_INTERNA: 3,
  DATOS: 2,
  INFRAESTRUCTURA_FABRICA: 2,
  INFRAESTRUCTURA_ON_PREMISE: 2,
  SEGURIDAD_INFORMACION: 2,
  FINANCIERA: 2,
  CONTABLE: 2,
  TESORERIA: 2,
  ADMINISTRATIVO: 2,
  ASEGURAMIENTO_PROYECTOS: 2,
  GESTION_SERVICIOS: 2,
  AGILE: 2,
  GOBIERNO_FABRICA: 2,
  CALIDAD: 2,
  BIENESTAR_CULTURA: 2,
};

/** Gestiones que trabajan de cerca: sus subprocesos se eligen más entre sí. */
const AFINES: Record<string, string[]> = {
  TALENTO_HUMANO: [
    'CONTABLE_TRIBUTARIA',
    'SOSTENIBILIDAD_REPUTACION',
    'ADMINISTRATIVO_COMPRAS',
  ],
  SOSTENIBILIDAD_REPUTACION: ['COMUNICACIONES', 'TALENTO_HUMANO', 'MARKETING'],
  COMERCIAL: ['PREVENTA', 'JURIDICA', 'MARKETING', 'FINANCIERA'],
  LA_FABRICA: [
    'PROYECTOS',
    'PLANEACION_ESTRATEGICA',
    'TECNOLOGIA',
    'CIBERSEGURIDAD',
  ],
  MARKETING: ['COMUNICACIONES', 'COMERCIAL', 'PREVENTA'],
  TECNOLOGIA: ['LA_FABRICA', 'CIBERSEGURIDAD', 'PROYECTOS'],
  MEJORAMIENTO_CONTINUO: ['PLANEACION_ESTRATEGICA', 'PROYECTOS', 'LA_FABRICA'],
  ADMINISTRATIVO_COMPRAS: ['CONTABLE_TRIBUTARIA', 'FINANCIERA', 'JURIDICA'],
  CONTABLE_TRIBUTARIA: [
    'FINANCIERA',
    'ADMINISTRATIVO_COMPRAS',
    'TALENTO_HUMANO',
  ],
  FINANCIERA: ['CONTABLE_TRIBUTARIA', 'ADMINISTRATIVO_COMPRAS', 'COMERCIAL'],
  JURIDICA: ['COMERCIAL', 'PREVENTA', 'PROYECTOS'],
  CIBERSEGURIDAD: ['TECNOLOGIA', 'LA_FABRICA'],
  PREVENTA: ['COMERCIAL', 'LA_FABRICA', 'JURIDICA'],
  PROYECTOS: ['LA_FABRICA', 'PLANEACION_ESTRATEGICA', 'JURIDICA'],
  COMUNICACIONES: ['MARKETING', 'SOSTENIBILIDAD_REPUTACION'],
  PLANEACION_ESTRATEGICA: ['PROYECTOS', 'LA_FABRICA', 'FINANCIERA'],
};

/**
 * Relaciones casi obligadas: quien trabaja en desarrollo casi siempre trata con QA y con
 * la PMO. Entran con probabilidad alta antes de sortear el resto de la lista.
 */
const VINCULOS: Record<string, string[]> = {
  DESARROLLO_SOFTWARE: ['QA', 'PMO', 'REQUERIMIENTOS'],
  QA: ['DESARROLLO_SOFTWARE', 'REQUERIMIENTOS'],
  DATOS: ['DESARROLLO_SOFTWARE', 'ARQUITECTURA_SOFTWARE'],
  ARQUITECTURA_SOFTWARE: ['DESARROLLO_SOFTWARE', 'PREVENTA'],
  INFRAESTRUCTURA_FABRICA: ['INFRAESTRUCTURA_ON_PREMISE', 'SOPORTE'],
  GOBIERNO_FABRICA: ['PMO', 'DESARROLLO_SOFTWARE'],
  MESA_AYUDA: ['SOPORTE', 'DESARROLLO_SOFTWARE'],
  REQUERIMIENTOS: ['DESARROLLO_SOFTWARE', 'PMO'],
  ASEGURAMIENTO_PROYECTOS: ['PMO', 'QA'],
  PMO: ['DESARROLLO_SOFTWARE', 'ASEGURAMIENTO_PROYECTOS', 'FINANCIERA'],
  COMERCIAL: ['PREVENTA', 'CONTRATACION_PUBLICA'],
  PREVENTA: ['COMERCIAL', 'ARQUITECTURA_SOFTWARE'],
  CONTRATACION_PUBLICA: ['PREVENTA', 'COMERCIAL'],
  SOPORTE: ['MESA_AYUDA', 'INFRAESTRUCTURA_ON_PREMISE'],
  NOMINA: ['ADMINISTRACION_PERSONAL', 'CONTABLE'],
  COMPRAS: ['TESORERIA', 'CONTABLE'],
};

// ============ CÓMO LA CALIFICA ============

/** Reputación de cada área en la escala 0-10 cuando otra la evalúa. Por defecto 6.9. */
const REPUTACION: Record<string, number> = {
  SOPORTE: 7.9,
  BIENESTAR_CULTURA: 8.2,
  NOMINA: 8.0,
  ARQUITECTURA_SOFTWARE: 7.6,
  PREVENTA: 7.5,
  QA: 7.4,
  PMO: 7.3,
  DATOS: 7.2,
  COMUNICACION_INTERNA: 7.1,
  DESARROLLO_SOFTWARE: 7.0,
  AGILE: 7.0,
  COMERCIAL: 6.9,
  SEGURIDAD_INFORMACION: 6.9,
  CONTABLE: 6.8,
  ATRACCION_TALENTO: 6.7,
  ASEGURAMIENTO_PROYECTOS: 6.6,
  CALIDAD: 6.6,
  FINANCIERA: 6.5,
  LEGAL_PROYECTOS: 6.4,
  GESTION_SERVICIOS: 6.4,
  TESORERIA: 6.3,
  GOBIERNO_FABRICA: 6.3,
  INFRAESTRUCTURA_ON_PREMISE: 6.2,
  MESA_AYUDA: 6.1,
  ADMINISTRACION_PERSONAL: 6.0,
  CONTRATACION_PUBLICA: 5.8,
  REQUERIMIENTOS: 5.6,
  COMPRAS: 5.2,
};

/** Sesgo de cada aspecto del componente 2: se cumple peor de lo que se confía. */
const SESGO_ASPECTO: Record<string, number> = {
  c2_facilidad: 0.1,
  c2_comunicacion: -0.4,
  c2_confianza: 0.3,
  c2_cumplimiento: -0.5,
  c2_valor: 0.5,
};

/** Media de cada componente global (C3 a C8). */
const MEDIA_COMPONENTE: Record<number, number> = {
  3: 6.0,
  4: 6.9,
  5: 6.2,
  6: 5.8,
  7: 7.3,
  8: 6.6,
};

/** Sesgo de cada afirmación sobre la media de su componente. Por defecto 0. */
const SESGO_AFIRMACION: Record<string, number> = {
  c3_oportunidad: -0.3,
  c3_claridad: 0.2,
  c3_comprension: 0.3,
  c3_canales: 0.4,
  c3_reproceso: -0.9,
  c4_disposicion: 0.7,
  c4_seguimiento: -0.6,
  c4_compromisos: -0.2,
  c4_valor: 0.3,
  c5_cumplimiento_tiempos: -0.5,
  c5_facilidad_resolver: 0.1,
  c5_seguimiento: -0.3,
  c6_impacto: 1.1,
  c6_roles: -0.7,
  c6_coordinacion: -0.3,
  c6_reprocesos: -0.9,
  c6_responsabilidades: -0.2,
  c7_confianza: 0.3,
  c7_aprendizaje: 0.4,
  c7_objetivos: -0.4,
  c8_disposicion: 0.8,
  c8_apertura: 0.2,
  c8_capacidad_mejoras: -0.7,
  c8_aprendizaje: -0.1,
};

// ============ OPCIONES Y TEXTOS ============

const FRECUENCIAS: [string, number][] = [
  ['DIARIA', 34],
  ['VARIAS_SEMANA', 30],
  ['SEMANAL', 20],
  ['MENSUAL', 10],
  ['ESPORADICA', 6],
];

const TIEMPOS_RESPUESTA: [string, number][] = [
  ['SUPERA_ANS', 10],
  ['CUMPLE_ANS', 36],
  ['CUMPLE_PARCIAL_ANS', 34],
  ['NO_CUMPLE_ANS', 12],
  ['NO_CONOCE_ANS', 8],
];

const MOTIVOS_NPS: [string, number][] = [
  ['COMUNICACION', 0.45],
  ['SERVICIO', 0.4],
  ['CONOCIMIENTO', 0.35],
  ['COMPROMISO', 0.35],
  ['RAPIDEZ', 0.3],
  ['ACTITUD', 0.3],
];

const OBSTACULOS: [string, number][] = [
  ['COMUNICACION', 0.45],
  ['PROCESOS', 0.4],
  ['PRIORIDADES', 0.35],
  ['PLANEACION', 0.3],
  ['ROLES', 0.25],
  ['TECNOLOGIA', 0.15],
  ['LIDERAZGO', 0.12],
  ['CULTURA', 0.1],
];

/** Qué gestión genera más reprocesos, según quien responde. Por defecto 1. */
const REPROCESOS: Record<string, number> = {
  PROYECTOS: 9,
  LA_FABRICA: 7,
  ADMINISTRATIVO_COMPRAS: 7,
  JURIDICA: 5,
  TALENTO_HUMANO: 4,
  COMERCIAL: 4,
  PREVENTA: 3,
  TECNOLOGIA: 3,
  CONTABLE_TRIBUTARIA: 3,
  PLANEACION_ESTRATEGICA: 3,
  FINANCIERA: 2,
  SOSTENIBILIDAD_REPUTACION: 0.5,
};

/** Qué área genera mayor valor para LinkTIC. Las no listadas pesan 0.3. */
const MAYOR_VALOR: Record<string, number> = {
  DESARROLLO_SOFTWARE: 8,
  PREVENTA: 6,
  PMO: 6,
  COMERCIAL: 5,
  SOPORTE: 5,
  ARQUITECTURA_SOFTWARE: 4,
  DATOS: 3,
  QA: 2,
  BIENESTAR_CULTURA: 2,
  ATRACCION_TALENTO: 2,
};

const OTROS_MOTIVOS = [
  'Claridad en los entregables',
  'Disponibilidad cuando hay urgencias',
  'Orden en la documentación',
];

const OTROS_PROCESOS = [
  'Facturación de proyectos',
  'Legalización de gastos de viaje',
];

/** La pregunta abierta final. Se reparten sin repetirse, como en una recolección real. */
const CAMBIOS = [
  'Que los ANS entre áreas estén publicados y se cumplan; hoy cada quien entiende un tiempo distinto.',
  'Una sola herramienta para radicar solicitudes internas, con trazabilidad del estado.',
  'Que los requerimientos lleguen completos a desarrollo antes de comprometer fechas con el cliente.',
  'Reuniones de seguimiento entre gestiones más cortas y con acuerdos escritos.',
  'Definir mejor los roles en los proyectos: muchas veces no se sabe quién aprueba.',
  'Más comunicación de las decisiones de la dirección; nos enteramos tarde.',
  'Priorizar en conjunto: todo llega como urgente y se pierde el foco.',
  'Que compras tenga tiempos claros para cada tipo de solicitud.',
  'Espacios para conocer qué hace cada área; con tantas áreas nuevas no sabemos a quién acudir.',
  'Documentar los procesos y mantenerlos actualizados en un solo lugar.',
  'Reconocer el trabajo colaborativo entre áreas, no solo el resultado individual.',
  'Integrar a QA desde el inicio del proyecto y no al final.',
  'Que la mesa de ayuda tenga acceso a la información de los proyectos para resolver más rápido.',
  'Un calendario compartido de entregas y cierres contables para planear mejor.',
  'Menos correos y más uso de los canales oficiales para las solicitudes.',
  'Que preventa y la fábrica estimen juntos antes de presentar una propuesta.',
  'Capacitación cruzada entre áreas para entender el impacto de nuestro trabajo.',
  'Que contratación pública comparta antes los requisitos de cada proceso.',
  'Tableros visibles con el estado de las solicitudes entre áreas.',
  'Respetar los tiempos de respuesta acordados y avisar cuando no se van a cumplir.',
  'Más autonomía a los equipos para resolver sin escalar todo.',
  'Una inducción que explique el nuevo organigrama y quién es responsable de qué.',
  'Hacer retrospectivas entre áreas al cerrar cada proyecto.',
  'Simplificar las aprobaciones de compras pequeñas.',
  'Que las decisiones de cambio de alcance pasen por todas las áreas impactadas.',
  'Mejorar la comunicación entre comercial y proyectos al momento de la entrega.',
  'Tener un responsable visible por cada proceso transversal.',
  'Automatizar los reportes que hoy se consolidan a mano entre varias áreas.',
  'Cumplir los compromisos de las reuniones; muchos acuerdos se quedan en el acta.',
  'Más cercanía de talento humano con los equipos de proyecto.',
  'Unificar las plantillas y formatos entre gestiones.',
  'Planear la capacidad de los equipos antes de aceptar nuevos proyectos.',
  'Que la información de nómina y novedades tenga un canal único.',
  'Abrir espacios para proponer mejoras y darles seguimiento.',
  'Fortalecer la confianza: a veces se busca culpables en lugar de soluciones.',
  'Reducir el reproceso con criterios de aceptación claros desde el inicio.',
  'Medir la satisfacción entre áreas de forma periódica, no solo una vez.',
  'Que la seguridad de la información acompañe los proyectos desde el diseño.',
];

// ============ AZAR REPRODUCIBLE ============

type Azar = () => number;

/** mulberry32: pequeño, rápido y suficiente para simular; no sirve para criptografía. */
function crearAzar(semilla: number): Azar {
  let estado = semilla >>> 0;
  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Normal estándar por Box-Muller. */
function normal(azar: Azar): number {
  const u = Math.max(azar(), Number.EPSILON);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * azar());
}

function sortear<T>(azar: Azar, pesos: [T, number][]): T {
  const total = pesos.reduce((suma, [, peso]) => suma + peso, 0);
  let corte = azar() * total;
  for (const [valor, peso] of pesos) {
    corte -= peso;
    if (corte < 0) return valor;
  }
  return pesos[pesos.length - 1][0];
}

/** Hasta `k` valores distintos, cada uno con probabilidad proporcional a su peso. */
function sortearVarios<T>(azar: Azar, pesos: [T, number][], k: number): T[] {
  const quedan = [...pesos];
  const elegidos: T[] = [];
  while (elegidos.length < k && quedan.length > 0) {
    const valor = sortear(azar, quedan);
    elegidos.push(valor);
    quedan.splice(
      quedan.findIndex(([otro]) => otro === valor),
      1,
    );
  }
  return elegidos;
}

/** Cada opción entra por su cuenta con su probabilidad; al menos una, como exige el ítem. */
function marcarVarias(
  azar: Azar,
  probabilidades: [string, number][],
  maximo: number,
): string[] {
  const marcadas = probabilidades
    .filter(([, probabilidad]) => azar() < probabilidad)
    .map(([valor]) => valor)
    .slice(0, maximo);
  return marcadas.length > 0 ? marcadas : [sortear(azar, probabilidades)];
}

function barajar<T>(azar: Azar, valores: T[]): T[] {
  const copia = [...valores];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

const nota = (valor: number) => Math.max(0, Math.min(10, Math.round(valor)));

const expandir = (conteos: Record<string, number>) =>
  Object.entries(conteos).flatMap(([valor, veces]) =>
    Array.from({ length: veces }, () => valor),
  );

// ============ CALENDARIO ============

/**
 * Días hábiles de la recolección simulada, con el pico del lanzamiento y el repunte del
 * recordatorio del lunes 28. Las horas son de Bogotá (UTC−5): mañana y media tarde.
 */
const DIAS: [string, number][] = [
  ['2026-09-22', 9],
  ['2026-09-23', 7],
  ['2026-09-24', 5],
  ['2026-09-25', 4],
  ['2026-09-28', 7],
  ['2026-09-29', 4],
  ['2026-09-30', 3],
  ['2026-10-01', 3],
  ['2026-10-02', 2],
  ['2026-10-05', 2],
];

const HORAS: [number, number][] = [
  [8, 3],
  [9, 6],
  [10, 7],
  [11, 5],
  [12, 2],
  [13, 2],
  [14, 5],
  [15, 6],
  [16, 5],
  [17, 3],
];

/** Respuestas que delatan poco cuidado, para que la vista de calidad tenga qué mostrar. */
const A_LA_CARRERA = 2;
const EN_LINEA_RECTA = 1;

// ============ GENERADOR ============

const gestionDe = new Map(AREAS.map((area) => [area.code, area.procesoCode]));

function elegirAreas(azar: Azar, propia: string): string[] {
  const gestion = gestionDe.get(propia)!;
  const afines = AFINES[gestion] ?? [];
  const cuantas = sortear(azar, [
    [1, 5],
    [2, 10],
    [3, 25],
    [4, 25],
    [5, 35],
  ]);

  const fijas = (VINCULOS[propia] ?? [])
    .filter(() => azar() < 0.85)
    .slice(0, cuantas);

  const candidatas: [string, number][] = AREAS.filter(
    (area) => area.code !== propia && !fijas.includes(area.code),
  ).map((area) => {
    const cercania =
      area.procesoCode === gestion
        ? 3
        : afines.includes(area.procesoCode)
          ? 2.5
          : 1;
    return [area.code, (DEMANDA[area.code] ?? 1) * cercania];
  });

  return [...fijas, ...sortearVarios(azar, candidatas, cuantas - fijas.length)];
}

function generarUna(
  azar: Azar,
  propia: string,
  cargo: string,
  indice: number,
  textos: string[],
  calidad: { carrera: boolean; recta: boolean },
): RespuestaSimulada {
  const answers: IncomingAnswer[] = [];
  const responder = (answer: IncomingAnswer) => answers.push(answer);

  const indulgencia = normal(azar) * 0.9 + EFECTO_CARGO[cargo];
  const gestion = gestionDe.get(propia)!;
  const esDireccion = ['DIRECTOR', 'GERENTE', 'HEAD'].includes(cargo);

  // --- Componente 1 ---
  const areas = elegirAreas(azar, propia);
  responder({ questionCode: 'c1_areas_interaccion', valueOptions: areas });
  responder({
    questionCode: 'c1_area_principal',
    valueOption: sortear(
      azar,
      areas.map((area, posicion) => [
        area,
        (DEMANDA[area] ?? 1) * (posicion === 0 ? 2 : 1),
      ]),
    ),
  });
  responder({
    questionCode: 'c1_frecuencia',
    valueOption: sortear(azar, FRECUENCIAS),
  });
  responder({
    questionCode: 'c1_tipo_interaccion',
    valueOptions: marcarVarias(
      azar,
      [
        ['OPERATIVA', 0.7],
        ['TACTICA', 0.4],
        ['ESTRATEGICA', esDireccion ? 0.6 : 0.2],
        [
          'COMERCIAL',
          ['COMERCIAL', 'PREVENTA', 'MARKETING'].includes(gestion) ? 0.7 : 0.1,
        ],
        ['SOPORTE', ['TECNOLOGIA', 'PROYECTOS'].includes(gestion) ? 0.65 : 0.3],
      ],
      5,
    ),
  });

  // --- Componentes 2 y 9: por cada área evaluada ---
  const npsPorArea: number[] = [];
  for (const area of areas) {
    const base = (REPUTACION[area] ?? 6.9) + indulgencia * 0.8;
    const afinidad = normal(azar) * 0.6;
    const notas: number[] = [];
    for (const [codigo, sesgo] of Object.entries(SESGO_ASPECTO)) {
      const valor = nota(base + afinidad + sesgo + normal(azar) * 0.9);
      notas.push(valor);
      responder({ questionCode: codigo, targetArea: area, valueNumber: valor });
    }
    const promedio = notas.reduce((a, b) => a + b, 0) / notas.length;
    const nps = nota(promedio + 0.8 + normal(azar) * 1.1);
    npsPorArea.push(nps);
    responder({ questionCode: 'c9_nps', targetArea: area, valueNumber: nps });
  }

  // --- Componentes 3 a 8: afirmaciones globales 0-10 ---
  const rectaEn = nota(7.5 + normal(azar) * 0.5);
  for (const [componente, media] of Object.entries(MEDIA_COMPONENTE)) {
    const tono = normal(azar) * 0.6;
    const escalas = QUESTIONS.filter(
      (q) =>
        q.componentId === Number(componente) &&
        q.type === 'SCALE_0_10' &&
        !q.perArea,
    );
    for (const pregunta of escalas) {
      const valor = calidad.recta
        ? rectaEn
        : nota(
            media +
              (SESGO_AFIRMACION[pregunta.code] ?? 0) +
              indulgencia +
              tono +
              normal(azar),
          );
      responder({ questionCode: pregunta.code, valueNumber: valor });
    }
  }

  // C5.1: el ANS acompaña a la percepción de agilidad de la misma persona.
  const agil = indulgencia + normal(azar) * 0.5;
  responder({
    questionCode: 'c5_tiempo_respuesta',
    valueOption: sortear(
      azar,
      TIEMPOS_RESPUESTA.map(([valor, peso]) => {
        if (valor === 'SUPERA_ANS' || valor === 'CUMPLE_ANS') {
          return [valor, peso * Math.exp(agil * 0.8)];
        }
        if (valor === 'CUMPLE_PARCIAL_ANS' || valor === 'NO_CUMPLE_ANS') {
          return [valor, peso * Math.exp(-agil * 0.8)];
        }
        return [valor, peso];
      }),
    ),
  });

  // C8.1 es opcional: unos no la responden, otros marcan «Ninguna».
  const iniciativas = azar();
  if (iniciativas >= 0.12) {
    responder({
      questionCode: 'c8_areas_iniciativas',
      valueOptions:
        iniciativas < 0.34
          ? ['NINGUNA']
          : sortearVarios(
              azar,
              AREAS.filter((area) => area.code !== propia).map((area) => [
                area.code,
                areas.includes(area.code) ? 6 : (DEMANDA[area.code] ?? 1) * 0.3,
              ]),
              sortear(azar, [
                [1, 45],
                [2, 35],
                [3, 20],
              ]),
            ),
    });
  }

  // --- Componente 9: motivos, una vez por encuesta ---
  const motivos = marcarVarias(azar, MOTIVOS_NPS, 3);
  const otroMotivo = azar() < 0.06;
  responder({
    questionCode: 'c9_motivos',
    valueOptions: otroMotivo ? [...motivos, 'OTRO'] : motivos,
    valueText: otroMotivo ? OTROS_MOTIVOS[indice % OTROS_MOTIVOS.length] : null,
  });

  // --- Componente 10 ---
  responder({
    questionCode: 'c10_obstaculo',
    valueOptions: marcarVarias(azar, OBSTACULOS, 3),
  });

  const otroProceso = azar() < 0.05;
  responder({
    questionCode: 'c10_proceso_reprocesos',
    valueOption: otroProceso
      ? 'OTRO'
      : sortear(
          azar,
          PROCESOS.map((p) => [
            p.code,
            (REPROCESOS[p.code] ?? 1) * (p.code === gestion ? 0.3 : 1),
          ]),
        ),
    valueText: otroProceso
      ? OTROS_PROCESOS[indice % OTROS_PROCESOS.length]
      : null,
  });

  const otras = AREAS.filter((area) => area.code !== propia);
  responder({
    questionCode: 'c10_area_mayor_valor',
    valueOption: sortear(
      azar,
      otras.map((area) => [area.code, MAYOR_VALOR[area.code] ?? 0.3]),
    ),
  });
  // Necesita fortalecer su relacionamiento quien está mal calificada y es muy buscada.
  responder({
    questionCode: 'c10_area_fortalecer',
    valueOption: sortear(
      azar,
      otras.map((area) => [
        area.code,
        (DEMANDA[area.code] ?? 1) *
          Math.max(0.2, 7.5 - (REPUTACION[area.code] ?? 6.9)) ** 2,
      ]),
    ),
  });

  // La abierta es opcional: la responde cerca del 75 %, y nunca quien fue a la carrera.
  if (!calidad.carrera && textos.length > 0 && azar() < 0.78) {
    responder({ questionCode: 'c10_cambio_unico', valueText: textos.pop()! });
  }

  // --- Cuándo y cuánto tardó ---
  const [anio, mes, dia] = sortear(azar, DIAS).split('-').map(Number);
  const hora = sortear(azar, HORAS);
  const submittedAt = new Date(
    Date.UTC(anio, mes - 1, dia, hora + 5, Math.floor(azar() * 60)),
  );
  const durationSeconds = calidad.carrera
    ? 200 + Math.floor(azar() * 90)
    : Math.round(
        Math.min(
          1800,
          Math.max(380, Math.exp(Math.log(690) + 0.3 * normal(azar))),
        ),
      );

  return {
    ownArea: propia,
    respondentRole: cargo,
    startedAt: new Date(submittedAt.getTime() - durationSeconds * 1000),
    submittedAt,
    durationSeconds,
    answers,
  };
}

/** Las respuestas simuladas, en orden de envío. */
export function generarRespuestasSimuladas(
  semilla = SEMILLA,
): RespuestaSimulada[] {
  const azar = crearAzar(semilla);
  const propias = expandir(ENCUESTADOS_POR_AREA);
  const cargos = barajar(azar, expandir(CARGOS));
  const textos = barajar(azar, CAMBIOS);

  if (propias.length !== TOTAL_SIMULADAS || cargos.length !== TOTAL_SIMULADAS) {
    throw new Error(
      `El reparto no suma ${TOTAL_SIMULADAS}: ${propias.length} áreas y ${cargos.length} cargos.`,
    );
  }

  // Los casos de poca calidad caen en posiciones al azar, no en las primeras.
  const marcadas = barajar(
    azar,
    propias.map((_, i) => i),
  );
  const carrera = new Set(marcadas.slice(0, A_LA_CARRERA));
  const recta = new Set(
    marcadas.slice(A_LA_CARRERA, A_LA_CARRERA + EN_LINEA_RECTA),
  );

  return propias
    .map((propia, i) =>
      generarUna(azar, propia, cargos[i], i, textos, {
        carrera: carrera.has(i),
        recta: recta.has(i),
      }),
    )
    .sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime());
}

// ============ VALIDACIÓN ============

/**
 * El catálogo tal como lo resuelve `SurveyService.getQuestionIndex`, pero armado desde
 * `catalog.ts` en vez de la base: las preguntas "(Lista)" llevan como opciones las áreas o
 * las gestiones. Es lo que el seed escribe, así que valida lo mismo que validaría la API.
 */
export function indiceDelCatalogo(): Map<string, CatalogQuestion> {
  return new Map(
    QUESTIONS.map((question, index) => {
      const catalogo =
        question.optionSource === 'AREAS'
          ? AREAS.map((area) => ({ value: area.code, label: area.name }))
          : question.optionSource === 'PROCESOS'
            ? PROCESOS.map((p) => ({ value: p.code, label: p.name }))
            : [];
      const opciones = [...catalogo, ...(question.options ?? [])];

      return [
        question.code,
        {
          code: question.code,
          componentId: question.componentId,
          label: question.label,
          helpText: question.helpText ?? null,
          scaleMinLabel: question.scaleMinLabel ?? null,
          scaleMaxLabel: question.scaleMaxLabel ?? null,
          type: question.type,
          required: question.required ?? true,
          minSelect: question.minSelect ?? null,
          maxSelect: question.maxSelect ?? null,
          perArea: question.perArea ?? false,
          optionSource: question.optionSource ?? 'STATIC',
          maxLength: question.maxLength ?? null,
          sortOrder: index + 1,
          active: true,
          options: opciones.map((option, optionIndex) => ({
            id: BigInt(optionIndex + 1),
            questionCode: question.code,
            value: option.value,
            label: option.label,
            allowsText: 'allowsText' in option ? !!option.allowsText : false,
            exclusive: 'exclusive' in option ? !!option.exclusive : false,
            sortOrder: optionIndex + 1,
          })),
        },
      ];
    }),
  );
}

/**
 * Pasa una respuesta por las reglas que la API aplica al guardar cada paso y por la de
 * completitud que aplica al enviar. Devuelve las infracciones; vacío es una respuesta que
 * la API habría aceptado.
 */
export function validarRespuesta(
  respuesta: RespuestaSimulada,
  indice = indiceDelCatalogo(),
): (RuleViolation | { questionCode: string; message: string })[] {
  const answers = respuesta.answers.map((answer) => ({
    ...answer,
    targetArea: answer.targetArea ?? GLOBAL_AREA_CODE,
  }));
  const evaluableAreas =
    answers.find((a) => a.questionCode === 'c1_areas_interaccion')
      ?.valueOptions ?? [];

  const infracciones = runRules({
    questions: indice,
    answers,
    ownArea: respuesta.ownArea,
    evaluableAreas,
    maxAreasInteraccion: 5,
  });
  const faltantes = findMissingAnswers(
    [...indice.values()],
    answers,
    evaluableAreas,
  ).map((falta) => ({
    questionCode: falta.questionCode,
    message: `Falta la respuesta${falta.targetArea ? ` para ${falta.targetArea}` : ''}.`,
  }));

  return [...infracciones, ...faltantes];
}
