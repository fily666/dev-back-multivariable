import { RESPONDENT_ROLES } from '../../common/constants';
import { median } from '../indicators/shared/component-index.util';
import type {
  MonitoringAreaRow,
  MonitoringDropOffStep,
  MonitoringDurationBucket,
  MonitoringFunnelStep,
  MonitoringHeatmapCell,
  MonitoringPayload,
  MonitoringRoleRow,
  MonitoringTimelineDay,
  MonitoringTotals,
} from '../dto/analytics.dto';

/**
 * Zona en la que se cortan días y horas. Bogotá es UTC−5 fijo, sin horario de verano, pero
 * el corte se hace con `Intl` y no restando cinco horas: así no depende de la zona del
 * servidor (Vercel corre en UTC) ni de que esa regla siga vigente.
 */
export const MONITORING_TIMEZONE = 'America/Bogota';

/** Un borrador tocado dentro de esta ventana es alguien respondiendo ahora mismo. */
export const ACTIVE_WINDOW_MS = 30 * 60 * 1000;

/** Pasado este tiempo sin actividad, el borrador se da por abandonado. */
export const STALLED_AFTER_MS = 24 * 60 * 60 * 1000;

/** Tope de la serie diaria: acota un payload que el panel pide cada 15 s. */
export const TIMELINE_MAX_DAYS = 120;

/** `lastStep = 0`: abrió la encuesta y nunca guardó un paso. */
const UNSAVED_STEP_TITLE = 'Abrió sin guardar';

/**
 * Tramos finos al principio, donde cae casi todo el mundo, y anchos al final, donde solo
 * queda quien dejó la pestaña abierta. El último es abierto.
 */
const DURATION_EDGES_MINUTES = [0, 5, 10, 15, 20, 30, 60];

const DURATION_BUCKETS = DURATION_EDGES_MINUTES.map((from, index) => {
  const isLast = index === DURATION_EDGES_MINUTES.length - 1;
  const to = DURATION_EDGES_MINUTES[index + 1];
  return {
    label: isLast ? `${from}+ min` : `${from}–${to} min`,
    minSeconds: from * 60,
    maxSeconds: isLast ? null : to * 60,
  };
});

/**
 * `en-CA` por los dígitos latinos y los nombres de día en inglés que mapea `WEEKDAY_INDEX`.
 * `h23` evita que la medianoche salga como "24", que algunos motores emiten con `hour12: false`.
 */
const LOCAL_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: MONITORING_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  weekday: 'short',
  hour: '2-digit',
  hourCycle: 'h23',
});

/** `Intl` nombra los días en inglés; el panel numera la semana desde el lunes. */
const WEEKDAY_INDEX: Record<string, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};

/** Fila de `survey_responses` con lo justo para medir participación: ni respuestas ni huellas. */
export interface MonitoringRow {
  status: 'DRAFT' | 'COMPLETED';
  ownArea: string | null;
  respondentRole: string | null;
  startedAt: Date;
  submittedAt: Date | null;
  updatedAt: Date;
  durationSeconds: number | null;
  lastStep: number;
}

export interface MonitoringComponent {
  id: number;
  title: string;
  sortOrder: number;
}

/** Área del catálogo con su gestión, tal como la trae `ResponsesRepository.fetchAreas`. */
export interface MonitoringArea {
  code: string;
  name: string;
  headcount: number | null;
  procesoCode: string | null;
  proceso: { name: string } | null;
}

export interface MonitoringInput {
  rows: MonitoringRow[];
  components: MonitoringComponent[];
  areas: MonitoringArea[];
  population: number | null;
  /** Se recibe y no se lee del reloj: "hoy" y "hace 30 minutos" deben poder fijarse en un test. */
  now: Date;
}

export interface LocalTime {
  /** YYYY-MM-DD. */
  date: string;
  /** 0 = lunes … 6 = domingo. */
  weekday: number;
  /** 0-23. */
  hour: number;
}

/** Fecha, día de la semana y hora de un instante en la zona del monitoreo. */
export function toLocalTime(instant: Date): LocalTime {
  const parts: Record<string, string> = {};
  for (const part of LOCAL_FORMAT.formatToParts(instant)) {
    parts[part.type] = part.value;
  }

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    weekday: WEEKDAY_INDEX[parts.weekday],
    hour: Number(parts.hour),
  };
}

/** Día calendario siguiente. Se opera en UTC porque ahí ningún día dura 23 ni 25 horas. */
function nextDay(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1))
    .toISOString()
    .slice(0, 10);
}

/** Porcentaje con un decimal; `null` sin denominador, nunca un 0% inventado. */
export function percent(part: number, whole: number | null): number | null {
  if (whole === null || whole === 0) return null;
  return Math.round((part / whole) * 1000) / 10;
}

function increment<K>(counts: Map<K, number>, key: K): void {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

function latestIso(dates: (Date | null)[]): string | null {
  let latest: number | null = null;
  for (const date of dates) {
    if (date && (latest === null || date.getTime() > latest)) {
      latest = date.getTime();
    }
  }
  return latest === null ? null : new Date(latest).toISOString();
}

/** Completadas y borradores por una clave de la respuesta (área, cargo). */
function countByStatus(
  rows: MonitoringRow[],
  keyOf: (row: MonitoringRow) => string | null,
): Map<string, { completed: number; drafts: number }> {
  const counts = new Map<string, { completed: number; drafts: number }>();

  for (const row of rows) {
    const key = keyOf(row);
    if (key === null) continue;
    const entry = counts.get(key) ?? { completed: 0, drafts: 0 };
    if (row.status === 'COMPLETED') entry.completed += 1;
    else entry.drafts += 1;
    counts.set(key, entry);
  }

  return counts;
}

export function buildMonitoringTotals(
  rows: MonitoringRow[],
  population: number | null,
  now: Date,
): MonitoringTotals {
  const today = toLocalTime(now).date;
  const durations: number[] = [];
  let completed = 0;
  let drafts = 0;
  let activeNow = 0;
  let stalled = 0;
  let completedToday = 0;

  for (const row of rows) {
    if (row.status === 'COMPLETED') {
      completed += 1;
      if (row.durationSeconds !== null) durations.push(row.durationSeconds);
      if (row.submittedAt && toLocalTime(row.submittedAt).date === today) {
        completedToday += 1;
      }
      continue;
    }

    drafts += 1;
    // `updatedAt` cambia con cada paso guardado, así que mide la última señal de vida del
    // borrador; `startedAt` diría cuándo entró, no si sigue ahí.
    const idle = now.getTime() - row.updatedAt.getTime();
    if (idle <= ACTIVE_WINDOW_MS) activeNow += 1;
    else if (idle > STALLED_AFTER_MS) stalled += 1;
  }

  return {
    started: rows.length,
    completed,
    drafts,
    activeNow,
    stalled,
    completionRate: percent(completed, rows.length),
    population,
    participationRate: percent(completed, population),
    medianDurationSeconds: median(durations),
    completedToday,
    lastSubmittedAt: latestIso(rows.map((row) => row.submittedAt)),
    lastActivityAt: latestIso(rows.map((row) => row.updatedAt)),
  };
}

/**
 * Serie diaria continua: los días sin movimiento salen con cero, porque un hueco en la
 * curva es justo lo que el monitoreo tiene que hacer visible.
 */
export function buildTimeline(
  rows: MonitoringRow[],
  now: Date,
): MonitoringTimelineDay[] {
  if (rows.length === 0) return [];

  const started = new Map<string, number>();
  const completed = new Map<string, number>();
  for (const row of rows) {
    increment(started, toLocalTime(row.startedAt).date);
    if (row.status === 'COMPLETED' && row.submittedAt) {
      increment(completed, toLocalTime(row.submittedAt).date);
    }
  }

  // YYYY-MM-DD ordena igual como texto que como fecha. El final es hoy, salvo que alguna
  // marca caiga después de `now` por desfase entre relojes: entonces se estira hasta ella
  // en vez de perderla.
  const first = [...started.keys()].sort()[0];
  const last = [toLocalTime(now).date, ...started.keys(), ...completed.keys()]
    .sort()
    .at(-1)!;

  const days: MonitoringTimelineDay[] = [];
  let cumulativeStarted = 0;
  let cumulativeCompleted = 0;
  for (let date = first; date <= last; date = nextDay(date)) {
    const dayStarted = started.get(date) ?? 0;
    const dayCompleted = completed.get(date) ?? 0;
    cumulativeStarted += dayStarted;
    cumulativeCompleted += dayCompleted;
    days.push({
      date,
      started: dayStarted,
      completed: dayCompleted,
      cumulativeStarted,
      cumulativeCompleted,
    });
  }

  // El acumulado se calcula sobre la serie entera antes de recortarla: el último punto
  // debe cuadrar con los totales aunque los primeros días ya no se muestren.
  return days.slice(-TIMELINE_MAX_DAYS);
}

/** Envíos por día de la semana × hora local: cuándo conviene mandar los recordatorios. */
export function buildHeatmap(rows: MonitoringRow[]): MonitoringHeatmapCell[] {
  const cells = new Map<number, MonitoringHeatmapCell>();

  for (const row of rows) {
    if (row.status !== 'COMPLETED' || !row.submittedAt) continue;
    const { weekday, hour } = toLocalTime(row.submittedAt);
    const key = weekday * 24 + hour;
    const cell = cells.get(key) ?? { weekday, hour, completed: 0 };
    cell.completed += 1;
    cells.set(key, cell);
  }

  return [...cells.entries()].sort(([a], [b]) => a - b).map(([, cell]) => cell);
}

/**
 * Cuántas respuestas llegaron al menos hasta cada componente.
 *
 * Una completada cuenta en todos los pasos aunque su último guardado haya sido otro: para
 * enviarse tuvo que pasar por todos. En los borradores se compara contra el id porque es
 * lo que guarda `lastStep`; en el catálogo id y `sortOrder` avanzan juntos.
 */
export function buildFunnel(
  rows: MonitoringRow[],
  components: MonitoringComponent[],
): MonitoringFunnelStep[] {
  const completed = rows.filter((row) => row.status === 'COMPLETED').length;
  const draftSteps = rows
    .filter((row) => row.status === 'DRAFT')
    .map((row) => row.lastStep);

  return [...components]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((component) => ({
      componentId: component.id,
      title: component.title,
      reached:
        completed + draftSteps.filter((step) => step >= component.id).length,
    }));
}

/**
 * Dónde se detuvieron los borradores. Incluye todos los componentes con cero: un paso
 * donde nadie se queda es tan informativo como uno donde se queda la mitad.
 */
export function buildDropOff(
  rows: MonitoringRow[],
  components: MonitoringComponent[],
): MonitoringDropOffStep[] {
  const counts = new Map<number, number>();
  for (const row of rows) {
    if (row.status === 'DRAFT') increment(counts, row.lastStep);
  }

  return [
    { id: 0, title: UNSAVED_STEP_TITLE },
    ...components.map(({ id, title }) => ({ id, title })),
  ]
    .sort((a, b) => a.id - b.id)
    .map((step) => ({
      componentId: step.id,
      title: step.title,
      drafts: counts.get(step.id) ?? 0,
    }));
}

/** Histograma de duraciones de las completadas. Los límites inferiores son inclusivos. */
export function buildDurationHistogram(
  rows: MonitoringRow[],
): MonitoringDurationBucket[] {
  const durations = rows
    .filter((row) => row.status === 'COMPLETED')
    .map((row) => row.durationSeconds)
    .filter((seconds): seconds is number => seconds !== null);

  return DURATION_BUCKETS.map((bucket) => ({
    ...bucket,
    count: durations.filter(
      (seconds) =>
        seconds >= bucket.minSeconds &&
        (bucket.maxSeconds === null || seconds < bucket.maxSeconds),
    ).length,
  }));
}

/**
 * Participación por área, con todas las áreas del catálogo en su orden y con cero: el área
 * que no aparece es la que hay que perseguir. La tasa usa el `headcount` propio del área.
 */
export function buildByArea(
  rows: MonitoringRow[],
  areas: MonitoringArea[],
): MonitoringAreaRow[] {
  const counts = countByStatus(rows, (row) => row.ownArea);

  return areas.map((area) => {
    const count = counts.get(area.code) ?? { completed: 0, drafts: 0 };
    return {
      areaCode: area.code,
      areaName: area.name,
      procesoCode: area.procesoCode,
      procesoName: area.proceso?.name ?? null,
      completed: count.completed,
      drafts: count.drafts,
      headcount: area.headcount,
      participationRate: percent(count.completed, area.headcount),
    };
  });
}

/** Participación por cargo, en el orden de `RESPONDENT_ROLES` y con cero. */
export function buildByRole(rows: MonitoringRow[]): MonitoringRoleRow[] {
  const counts = countByStatus(rows, (row) => row.respondentRole);

  return RESPONDENT_ROLES.map((role) => ({
    value: role.value,
    label: role.label,
    completed: counts.get(role.value)?.completed ?? 0,
    drafts: counts.get(role.value)?.drafts ?? 0,
  }));
}

/** El payload completo del monitoreo. */
export function buildMonitoring(input: MonitoringInput): MonitoringPayload {
  const { rows, components, areas, population, now } = input;

  return {
    timezone: MONITORING_TIMEZONE,
    totals: buildMonitoringTotals(rows, population, now),
    timeline: buildTimeline(rows, now),
    heatmap: buildHeatmap(rows),
    funnel: buildFunnel(rows, components),
    dropOff: buildDropOff(rows, components),
    durations: buildDurationHistogram(rows),
    byArea: buildByArea(rows, areas),
    byRole: buildByRole(rows),
    // Abrieron la encuesta pero aún no declaran área: no caben en `byArea` y se reportan
    // aparte para que la suma por área no parezca perder respuestas.
    unidentified: rows.filter((row) => row.ownArea === null).length,
  };
}
