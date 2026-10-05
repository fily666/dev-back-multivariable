import {
  buildByArea,
  buildByRole,
  buildDropOff,
  buildDurationHistogram,
  buildFunnel,
  buildHeatmap,
  buildMonitoring,
  buildMonitoringTotals,
  buildTimeline,
  toLocalTime,
} from './monitoring.kpi';
import type {
  MonitoringArea,
  MonitoringComponent,
  MonitoringRow,
} from './monitoring.kpi';

/** Lunes 5-oct-2026, 10:00 en Bogotá (UTC−5). */
const NOW = new Date('2026-10-05T15:00:00Z');

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

/** Desordenados a propósito: el embudo debe salir en el orden del instrumento. */
const COMPONENTS: MonitoringComponent[] = [
  { id: 2, title: 'Red de colaboración', sortOrder: 2 },
  { id: 1, title: 'Caracterización', sortOrder: 1 },
  { id: 3, title: 'Comunicación', sortOrder: 3 },
];

const AREAS: MonitoringArea[] = [
  {
    code: 'PMO',
    name: 'PMO',
    headcount: 7,
    procesoCode: 'PROYECTOS',
    proceso: { name: 'Gestión de proyectos' },
  },
  {
    code: 'TECNOLOGIA',
    name: 'Tecnología',
    headcount: null,
    procesoCode: 'TI',
    proceso: { name: 'Gestión TI' },
  },
  {
    code: 'OTRA',
    name: 'Otra',
    headcount: null,
    procesoCode: null,
    proceso: null,
  },
];

function completed(overrides: Partial<MonitoringRow> = {}): MonitoringRow {
  return {
    status: 'COMPLETED',
    ownArea: 'PMO',
    respondentRole: 'ANALISTA',
    startedAt: new Date('2026-10-01T14:00:00Z'),
    submittedAt: new Date('2026-10-01T14:20:00Z'),
    updatedAt: new Date('2026-10-01T14:20:00Z'),
    durationSeconds: 1200,
    lastStep: 3,
    ...overrides,
  };
}

function draft(overrides: Partial<MonitoringRow> = {}): MonitoringRow {
  return {
    status: 'DRAFT',
    ownArea: 'PMO',
    respondentRole: 'ANALISTA',
    startedAt: new Date('2026-10-05T13:00:00Z'),
    submittedAt: null,
    updatedAt: new Date('2026-10-05T13:00:00Z'),
    durationSeconds: null,
    lastStep: 0,
    ...overrides,
  };
}

/** Un borrador cuya última actividad fue hace `ms` respecto de NOW. */
function idleDraft(ms: number): MonitoringRow {
  return draft({ updatedAt: new Date(NOW.getTime() - ms) });
}

describe('toLocalTime', () => {
  it('corta el día en Bogotá y no en UTC', () => {
    // 03:30Z del lunes 5-oct menos 5 h = 22:30 del domingo 4-oct
    expect(toLocalTime(new Date('2026-10-05T03:30:00Z'))).toEqual({
      date: '2026-10-04',
      weekday: 6,
      hour: 22,
    });
  });

  it('la medianoche local es la hora 0 del día nuevo, no la 24 del anterior', () => {
    // 05:00Z - 5 h = 00:00 del lunes 5-oct
    expect(toLocalTime(new Date('2026-10-05T05:00:00Z'))).toEqual({
      date: '2026-10-05',
      weekday: 0,
      hour: 0,
    });
  });
});

describe('buildTimeline', () => {
  it('agrupa por día de Bogotá a ambos lados de la medianoche UTC', () => {
    // 03:30Z -> 4-oct 22:30 local; 05:30Z -> 5-oct 00:30 local. Mismo día UTC, días distintos
    const rows = [
      draft({ startedAt: new Date('2026-10-05T03:30:00Z') }),
      draft({ startedAt: new Date('2026-10-05T05:30:00Z') }),
    ];
    const timeline = buildTimeline(rows, NOW);

    expect(timeline.map((day) => [day.date, day.started])).toEqual([
      ['2026-10-04', 1],
      ['2026-10-05', 1],
    ]);
  });

  it('rellena con cero los días sin movimiento y acumula iniciadas y completadas', () => {
    const rows = [
      // inicia y envía el 1-oct (09:00 y 09:20 local)
      completed(),
      // inicia el 2-oct 18:00 local y envía el 3-oct 01:00 local
      completed({
        startedAt: new Date('2026-10-02T23:00:00Z'),
        submittedAt: new Date('2026-10-03T06:00:00Z'),
      }),
      // borrador abierto el 5-oct 08:00 local
      draft(),
    ];

    // 1-oct: 1 / 1 -> acumulado 1 / 1
    // 2-oct: 1 / 0 -> acumulado 2 / 1
    // 3-oct: 0 / 1 -> acumulado 2 / 2
    // 4-oct: 0 / 0 -> acumulado 2 / 2   (hueco relleno con cero)
    // 5-oct: 1 / 0 -> acumulado 3 / 2
    expect(buildTimeline(rows, NOW)).toEqual([
      {
        date: '2026-10-01',
        started: 1,
        completed: 1,
        cumulativeStarted: 1,
        cumulativeCompleted: 1,
      },
      {
        date: '2026-10-02',
        started: 1,
        completed: 0,
        cumulativeStarted: 2,
        cumulativeCompleted: 1,
      },
      {
        date: '2026-10-03',
        started: 0,
        completed: 1,
        cumulativeStarted: 2,
        cumulativeCompleted: 2,
      },
      {
        date: '2026-10-04',
        started: 0,
        completed: 0,
        cumulativeStarted: 2,
        cumulativeCompleted: 2,
      },
      {
        date: '2026-10-05',
        started: 1,
        completed: 0,
        cumulativeStarted: 3,
        cumulativeCompleted: 2,
      },
    ]);
  });

  it('llega hasta hoy aunque el último movimiento sea anterior', () => {
    // del 1-oct al 5-oct son 5 días; el último no tiene movimiento pero conserva el acumulado
    const timeline = buildTimeline([completed()], NOW);

    expect(timeline).toHaveLength(5);
    expect(timeline.at(-1)).toEqual({
      date: '2026-10-05',
      started: 0,
      completed: 0,
      cumulativeStarted: 1,
      cumulativeCompleted: 1,
    });
  });

  it('conserva los últimos 120 días con el acumulado de toda la serie', () => {
    const rows = [
      completed({
        startedAt: new Date('2026-05-01T15:00:00Z'),
        submittedAt: new Date('2026-05-01T15:30:00Z'),
      }),
      draft(),
    ];
    const timeline = buildTimeline(rows, NOW);

    // 1-may..5-oct = 31 + 30 + 31 + 31 + 30 + 5 = 158 días; se recortan los 38 primeros
    // (31 de mayo + 1..7 de junio), así que el primero que queda es el 8-jun
    expect(timeline).toHaveLength(120);
    // el 8-jun no tiene movimiento, pero ya arrastra la respuesta del 1-may
    expect(timeline[0]).toEqual({
      date: '2026-06-08',
      started: 0,
      completed: 0,
      cumulativeStarted: 1,
      cumulativeCompleted: 1,
    });
    // el último cuadra con los totales: 2 iniciadas, 1 completada
    expect(timeline.at(-1)).toMatchObject({
      date: '2026-10-05',
      cumulativeStarted: 2,
      cumulativeCompleted: 1,
    });
  });

  it('devuelve vacío cuando no hay respuestas', () => {
    expect(buildTimeline([], NOW)).toEqual([]);
  });
});

describe('buildHeatmap', () => {
  it('numera la semana desde el lunes, usa la hora local y omite las celdas vacías', () => {
    const rows = [
      // 5-oct 03:30Z -> domingo 22:30 local -> (6, 22)
      completed({ submittedAt: new Date('2026-10-05T03:30:00Z') }),
      // 5-oct 14:10Z y 14:50Z -> lunes 09:10 y 09:50 local -> (0, 9) dos veces
      completed({ submittedAt: new Date('2026-10-05T14:10:00Z') }),
      completed({ submittedAt: new Date('2026-10-05T14:50:00Z') }),
      // un borrador no tiene envío y no cuenta
      draft(),
    ];

    expect(buildHeatmap(rows)).toEqual([
      { weekday: 0, hour: 9, completed: 2 },
      { weekday: 6, hour: 22, completed: 1 },
    ]);
  });
});

describe('buildFunnel', () => {
  // 2 completadas + borradores detenidos en 0, 1, 2 y 2
  const rows = [
    completed({ lastStep: 3 }),
    completed({ lastStep: 2 }),
    draft({ lastStep: 0 }),
    draft({ lastStep: 1 }),
    draft({ lastStep: 2 }),
    draft({ lastStep: 2 }),
  ];

  it('suma las completadas en todos los pasos y los borradores hasta donde llegaron', () => {
    // C1: 2 completadas + borradores con lastStep >= 1 (1, 2, 2) = 5
    // C2: 2 completadas + borradores con lastStep >= 2 (2, 2)    = 4
    // C3: 2 completadas + ninguno llegó a 3                       = 2
    // La completada con lastStep 2 cuenta en C3: para enviarse tuvo que pasar por él.
    expect(buildFunnel(rows, COMPONENTS)).toEqual([
      { componentId: 1, title: 'Caracterización', reached: 5 },
      { componentId: 2, title: 'Red de colaboración', reached: 4 },
      { componentId: 3, title: 'Comunicación', reached: 2 },
    ]);
  });
});

describe('buildDropOff', () => {
  it('agrupa los borradores por último paso, con el 0 y los pasos vacíos incluidos', () => {
    const rows = [
      completed({ lastStep: 3 }),
      draft({ lastStep: 0 }),
      draft({ lastStep: 1 }),
      draft({ lastStep: 2 }),
      draft({ lastStep: 2 }),
    ];

    // las completadas no cuentan: solo interesa dónde se quedaron los que no terminaron
    expect(buildDropOff(rows, COMPONENTS)).toEqual([
      { componentId: 0, title: 'Abrió sin guardar', drafts: 1 },
      { componentId: 1, title: 'Caracterización', drafts: 1 },
      { componentId: 2, title: 'Red de colaboración', drafts: 2 },
      { componentId: 3, title: 'Comunicación', drafts: 0 },
    ]);
  });
});

describe('buildDurationHistogram', () => {
  it('incluye el límite inferior de cada tramo y excluye el superior', () => {
    const rows = [0, 299, 300, 599, 1800, 3599, 3600, 7200].map(
      (durationSeconds) => completed({ durationSeconds }),
    );
    // una completada sin duración no se cuenta en ningún tramo
    rows.push(completed({ durationSeconds: null }));
    const histogram = buildDurationHistogram(rows);

    // 0–5: 0 y 299          -> 2
    // 5–10: 300 (justo 5 min) y 599 -> 2
    // 10–15, 15–20, 20–30   -> 0
    // 30–60: 1800 y 3599    -> 2
    // 60+: 3600 y 7200      -> 2
    expect(histogram.map((bucket) => bucket.count)).toEqual([
      2, 2, 0, 0, 0, 2, 2,
    ]);
  });

  it('presenta los 7 tramos fijos aunque estén vacíos, con el último abierto', () => {
    expect(buildDurationHistogram([])).toEqual([
      { label: '0–5 min', minSeconds: 0, maxSeconds: 300, count: 0 },
      { label: '5–10 min', minSeconds: 300, maxSeconds: 600, count: 0 },
      { label: '10–15 min', minSeconds: 600, maxSeconds: 900, count: 0 },
      { label: '15–20 min', minSeconds: 900, maxSeconds: 1200, count: 0 },
      { label: '20–30 min', minSeconds: 1200, maxSeconds: 1800, count: 0 },
      { label: '30–60 min', minSeconds: 1800, maxSeconds: 3600, count: 0 },
      { label: '60+ min', minSeconds: 3600, maxSeconds: null, count: 0 },
    ]);
  });
});

describe('buildByArea', () => {
  it('lista todas las áreas en el orden del catálogo, con ceros y su gestión', () => {
    const rows = [
      completed(),
      completed(),
      completed(),
      draft(),
      completed({ ownArea: 'TECNOLOGIA' }),
      // sin área declarada: va a `unidentified`, no a una fila
      draft({ ownArea: null }),
    ];
    const byArea = buildByArea(rows, AREAS);

    expect(byArea.map((row) => row.areaCode)).toEqual([
      'PMO',
      'TECNOLOGIA',
      'OTRA',
    ]);
    // PMO: 3 completadas sobre headcount 7 -> 42.857% -> 42.9
    expect(byArea[0]).toEqual({
      areaCode: 'PMO',
      areaName: 'PMO',
      procesoCode: 'PROYECTOS',
      procesoName: 'Gestión de proyectos',
      completed: 3,
      drafts: 1,
      headcount: 7,
      participationRate: 42.9,
    });
    // sin headcount la tasa queda en null, no en 0%
    expect(byArea[1]).toMatchObject({
      completed: 1,
      drafts: 0,
      headcount: null,
      participationRate: null,
    });
    // OTRA no tiene respuestas ni gestión, pero sale igual
    expect(byArea[2]).toMatchObject({
      procesoCode: null,
      procesoName: null,
      completed: 0,
      drafts: 0,
    });
  });
});

describe('buildByRole', () => {
  it('sigue el orden declarado de los cargos y rellena con cero', () => {
    const rows = [
      completed({ respondentRole: 'ANALISTA' }),
      completed({ respondentRole: 'ANALISTA' }),
      draft({ respondentRole: 'DIRECTOR' }),
      // sin cargo todavía: no cae en ninguna fila
      draft({ respondentRole: null }),
    ];
    const byRole = buildByRole(rows);

    expect(byRole.map((row) => row.value)).toEqual([
      'DIRECTOR',
      'GERENTE',
      'HEAD',
      'COORDINADOR',
      'LIDER',
      'PROFESIONAL',
      'ANALISTA',
    ]);
    expect(byRole[0]).toEqual({
      value: 'DIRECTOR',
      label: 'Director',
      completed: 0,
      drafts: 1,
    });
    expect(byRole[1]).toMatchObject({ completed: 0, drafts: 0 });
    expect(byRole[6]).toMatchObject({ completed: 2, drafts: 0 });
  });
});

describe('buildMonitoringTotals', () => {
  it('separa los borradores activos de los estancados por su última actividad', () => {
    const rows = [
      idleDraft(30 * MINUTE_MS), // justo 30 min: todavía activo
      idleDraft(30 * MINUTE_MS + 1000), // 30 min y 1 s: ni activo ni estancado
      idleDraft(24 * HOUR_MS), // justo 24 h: aún no estancado
      idleDraft(24 * HOUR_MS + 1000), // 24 h y 1 s: estancado
      // una completada vieja no es un borrador estancado
      completed({ updatedAt: new Date('2026-09-01T00:00:00Z') }),
    ];
    const totals = buildMonitoringTotals(rows, null, NOW);

    expect(totals).toMatchObject({
      started: 5,
      completed: 1,
      drafts: 4,
      activeNow: 1,
      stalled: 1,
    });
  });

  it('cuenta como de hoy los envíos de la fecha de Bogotá, no de la de UTC', () => {
    // 6-oct 04:00Z = 5-oct 23:00 local: en UTC ya es mañana, en Bogotá sigue siendo hoy
    const lateNight = new Date('2026-10-06T04:00:00Z');
    const rows = [
      completed({ submittedAt: new Date('2026-10-05T05:30:00Z') }), // 5-oct 00:30 local: hoy
      completed({ submittedAt: new Date('2026-10-06T00:30:00Z') }), // 5-oct 19:30 local: hoy
      completed({ submittedAt: new Date('2026-10-05T04:30:00Z') }), // 4-oct 23:30 local: ayer
    ];

    // con la fecha UTC (6-oct) contaría solo 1
    expect(buildMonitoringTotals(rows, null, lateNight).completedToday).toBe(2);
  });

  it('calcula las tasas con un decimal y la mediana con un número par de duraciones', () => {
    const rows = [
      completed({ durationSeconds: 600 }),
      completed({ durationSeconds: 900 }),
      completed({ durationSeconds: 1500 }),
      completed({ durationSeconds: 1700 }),
      completed({ durationSeconds: null }),
      draft(),
    ];
    const totals = buildMonitoringTotals(rows, 8, NOW);

    // 5 completadas / 6 iniciadas = 83.33% -> 83.3
    expect(totals.completionRate).toBe(83.3);
    // 5 completadas / población 8 = 62.5%
    expect(totals.participationRate).toBe(62.5);
    // la nula no cuenta: mediana de [600, 900, 1500, 1700] = (900 + 1500) / 2 = 1200
    expect(totals.medianDurationSeconds).toBe(1200);
  });

  it('toma la mediana central con un número impar de duraciones', () => {
    // [600, 900, 7200]: la de 7200 s no arrastra el dato como lo haría un promedio (2900)
    const rows = [600, 7200, 900].map((durationSeconds) =>
      completed({ durationSeconds }),
    );
    expect(buildMonitoringTotals(rows, null, NOW).medianDurationSeconds).toBe(
      900,
    );
  });

  it('deja las tasas en null cuando no hay denominador', () => {
    expect(buildMonitoringTotals([], null, NOW)).toMatchObject({
      started: 0,
      completionRate: null,
      population: null,
      participationRate: null,
      medianDurationSeconds: null,
      lastSubmittedAt: null,
      lastActivityAt: null,
    });
    // una población de 0 tampoco es un denominador
    expect(
      buildMonitoringTotals([completed()], 0, NOW).participationRate,
    ).toBeNull();
  });

  it('reporta el último envío y la última actividad, borradores incluidos', () => {
    const rows = [
      completed({
        submittedAt: new Date('2026-10-03T10:00:00Z'),
        updatedAt: new Date('2026-10-03T10:00:00Z'),
      }),
      completed(),
      draft({ updatedAt: new Date('2026-10-05T14:00:00Z') }),
    ];
    const totals = buildMonitoringTotals(rows, null, NOW);

    expect(totals.lastSubmittedAt).toBe('2026-10-03T10:00:00.000Z');
    expect(totals.lastActivityAt).toBe('2026-10-05T14:00:00.000Z');
  });
});

describe('buildMonitoring', () => {
  it('cuenta aparte a quien aún no declara área, para que la suma cuadre', () => {
    const rows = [completed(), draft(), draft({ ownArea: null })];
    const payload = buildMonitoring({
      rows,
      components: COMPONENTS,
      areas: AREAS,
      population: 7,
      now: NOW,
    });
    const byAreaTotal = payload.byArea.reduce(
      (sum, row) => sum + row.completed + row.drafts,
      0,
    );

    expect(payload.timezone).toBe('America/Bogota');
    expect(payload.unidentified).toBe(1);
    // 2 con área + 1 sin identificar = 3 iniciadas
    expect(byAreaTotal + payload.unidentified).toBe(payload.totals.started);
  });

  it('con cero respuestas devuelve la estructura completa en cero', () => {
    const payload = buildMonitoring({
      rows: [],
      components: COMPONENTS,
      areas: AREAS,
      population: null,
      now: NOW,
    });

    expect(payload.timeline).toEqual([]);
    expect(payload.heatmap).toEqual([]);
    expect(payload.funnel.map((step) => step.reached)).toEqual([0, 0, 0]);
    // el paso 0 más los 3 componentes
    expect(payload.dropOff.map((step) => step.drafts)).toEqual([0, 0, 0, 0]);
    expect(payload.durations).toHaveLength(7);
    expect(payload.byArea).toHaveLength(3);
    expect(
      payload.byRole.every((row) => row.completed + row.drafts === 0),
    ).toBe(true);
    expect(payload.unidentified).toBe(0);
  });
});
