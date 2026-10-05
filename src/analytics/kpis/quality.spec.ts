import {
  IINN_SCALE_CODES,
  QUESTION_CODES_BY_INDICATOR,
} from '../indicators/question-codes.constant';
import { scaleBattery, scaleRow } from '../indicators/indicators.fixture';
import type { RawAnswerRow } from '../indicators/indicator.types';
import {
  STRAIGHT_LINE_MIN_ITEMS,
  SPEEDER_THRESHOLD_SECONDS,
  buildQuality,
} from './quality.kpi';
import type {
  QualityComponent,
  QualityInput,
  QualityResponse,
  QualityScaleItem,
  QualityTextAnswer,
} from './quality.kpi';

const { ICOM, ISI, IAG, IINT, ICOL } = QUESTION_CODES_BY_INDICATOR;

/** Los 27 ítems 0-10 de los componentes 3 a 8, más uno por área del C2 y el NPS del C9. */
const SCALE_ITEMS: QualityScaleItem[] = [
  { code: 'c2_facilidad', componentId: 2 },
  ...ICOM.map((code) => ({ code, componentId: 3 })),
  ...ISI.map((code) => ({ code, componentId: 4 })),
  ...IAG.map((code) => ({ code, componentId: 5 })),
  ...IINT.map((code) => ({ code, componentId: 6 })),
  ...ICOL.map((code) => ({ code, componentId: 7 })),
  ...IINN_SCALE_CODES.map((code) => ({ code, componentId: 8 })),
  { code: 'c9_nps', componentId: 9 },
];

/** Desordenados y con C2 y C9 a propósito: solo deben salir 3 a 8, en su orden. */
const COMPONENTS: QualityComponent[] = [
  { id: 9, title: 'Experiencia de servicio interno' },
  { id: 4, title: 'Servicio interno' },
  { id: 3, title: 'Comunicación organizacional' },
  { id: 2, title: 'Red de colaboración' },
  { id: 5, title: 'Agilidad organizacional' },
  { id: 6, title: 'Integración de procesos' },
  { id: 7, title: 'Cultura colaborativa' },
  { id: 8, title: 'Innovación organizacional' },
];

function completed(id: string, durationSeconds: number | null = 900) {
  return { id, durationSeconds } satisfies QualityResponse;
}

function quality(overrides: Partial<QualityInput>) {
  return buildQuality({
    responses: [],
    scaleRows: [],
    scaleItems: SCALE_ITEMS,
    components: COMPONENTS,
    textAnswers: [],
    textOptions: [],
    ...overrides,
  });
}

/** La misma nota en todas las preguntas dadas. */
function same(
  responseId: string,
  codes: readonly string[],
  value: number,
): RawAnswerRow[] {
  return scaleBattery(
    responseId,
    codes,
    codes.map(() => value),
  );
}

function text(
  responseId: string,
  questionCode: string,
  valueText: string | null,
  selection: { valueOption?: string; valueOptions?: string[] } = {},
): QualityTextAnswer {
  return {
    responseId,
    questionCode,
    valueOption: selection.valueOption ?? null,
    valueOptions: selection.valueOptions ?? [],
    valueText,
  };
}

describe('buildQuality · velocidad', () => {
  it('marca a quien tardó menos de 300 s; justo 300 s no es apresurado', () => {
    const result = quality({
      responses: [
        completed('r1', 120),
        completed('r2', 299),
        completed('r3', 300),
        completed('r4', 301),
        // sin duración: cuenta como completada pero no entra al % de velocidad
        completed('r5', null),
      ],
    });

    // apresurados: 120 y 299 -> 2 de 4 con duración = 50%
    expect(result.completed).toBe(5);
    expect(result.speeders).toEqual({
      thresholdSeconds: SPEEDER_THRESHOLD_SECONDS,
      count: 2,
      share: 50,
    });
  });
});

describe('buildQuality · línea recta', () => {
  it('exige al menos 10 notas globales idénticas', () => {
    const tenSame = [...same('r1', ICOM, 7), ...same('r1', ISI, 7)];
    const nineSame = [
      ...same('r2', ICOM, 7),
      ...same('r2', ISI.slice(0, 4), 7),
    ];
    const oneDifferent = [
      ...same('r3', ICOM, 7),
      ...scaleBattery('r3', ISI, [7, 7, 7, 7, 8]),
    ];
    const allSame = SCALE_ITEMS.filter(
      (item) => item.componentId >= 3 && item.componentId <= 8,
    ).map((item) => scaleRow('r4', item.code, 5));

    const result = quality({
      responses: ['r1', 'r2', 'r3', 'r4'].map((id) => completed(id)),
      scaleRows: [...tenSame, ...nineSame, ...oneDifferent, ...allSame],
    });

    // r1: 10 idénticas -> sí. r2: 9 -> no llega al mínimo. r3: 10 con una distinta -> no.
    // r4: los 28 ítems en 5 -> sí. 2 de 4 completadas = 50%
    expect(result.straightLining).toEqual({
      count: 2,
      share: 50,
      minItems: STRAIGHT_LINE_MIN_ITEMS,
    });
  });

  it('no cuenta las notas por área ni a quien está fuera del corte', () => {
    const perArea = [
      ...same('r1', ICOM, 9),
      ...same('r1', ISI.slice(0, 4), 9),
      // la misma nota por área: C2 y C9 no son de 3 a 8, y la décima del C4 llega con un
      // área evaluada en vez del centinela global
      scaleRow('r1', 'c2_facilidad', 9, 'TECNOLOGIA'),
      scaleRow('r1', 'c9_nps', 9, 'TECNOLOGIA'),
      scaleRow('r1', ISI[4], 9, 'TECNOLOGIA'),
    ];
    // r2 dio 10 notas iguales pero no está entre las completadas del corte
    const outside = [...same('r2', ICOM, 3), ...same('r2', ISI, 3)];

    const result = quality({
      responses: [completed('r1')],
      scaleRows: [...perArea, ...outside],
    });

    // r1 solo tiene 9 globales: las tres por área no completan las 10
    expect(result.straightLining.count).toBe(0);
  });
});

describe('buildQuality · componentes planos', () => {
  it('marca el componente con al menos 3 notas idénticas, en el orden de 3 a 8', () => {
    const result = quality({
      responses: ['r1', 'r2', 'r3', 'r4'].map((id) => completed(id)),
      scaleRows: [
        // r1: 3 respondidas en 5, las otras dos en blanco -> C3 plano
        ...scaleBattery('r1', ICOM, [5, 5, 5, null, null]),
        // r2: solo 2 respondidas -> no alcanza
        ...scaleBattery('r2', ICOM, [5, 5, null, null, null]),
        // r3: una distinta -> no
        ...scaleBattery('r3', ICOM, [5, 5, 6, 5, 5]),
        // r4: las 5 del C4 en 9 -> C4 plano
        ...same('r4', ISI, 9),
      ],
    });

    // C3: 1 de 4 = 25%; C4: 1 de 4 = 25%; C5 a C8: 0. C2 y C9 no salen.
    expect(result.flatComponents).toEqual([
      {
        componentId: 3,
        title: 'Comunicación organizacional',
        count: 1,
        share: 25,
      },
      { componentId: 4, title: 'Servicio interno', count: 1, share: 25 },
      { componentId: 5, title: 'Agilidad organizacional', count: 0, share: 0 },
      { componentId: 6, title: 'Integración de procesos', count: 0, share: 0 },
      { componentId: 7, title: 'Cultura colaborativa', count: 0, share: 0 },
      {
        componentId: 8,
        title: 'Innovación organizacional',
        count: 0,
        share: 0,
      },
    ]);
  });
});

describe('buildQuality · texto', () => {
  it('cuenta las respuestas abiertas con texto real, no las de puros espacios', () => {
    const result = quality({
      responses: ['r1', 'r2', 'r3', 'r4', 'r5'].map((id) => completed(id)),
      textAnswers: [
        text('r1', 'c10_cambio_unico', 'Más reuniones entre áreas'),
        text('r2', 'c10_cambio_unico', '   '),
        text('r3', 'c10_cambio_unico', '\n\t'),
        text('r4', 'c10_cambio_unico', ''),
        text('r5', 'c10_cambio_unico', null),
        // fuera del corte
        text('r9', 'c10_cambio_unico', 'Otra idea'),
      ],
    });

    // solo r1: 1 de 5 = 20%
    expect(result.openAnswers).toEqual({ count: 1, share: 20 });
  });

  it('cuenta "Otro" con texto solo si la opción elegida lo admite', () => {
    const result = quality({
      responses: ['r1', 'r2', 'r3', 'r4'].map((id) => completed(id)),
      textOptions: [
        { questionCode: 'c9_motivos', value: 'OTRO' },
        { questionCode: 'c10_proceso_reprocesos', value: 'OTRO' },
      ],
      textAnswers: [
        // múltiple con OTRO y texto -> sí
        text('r1', 'c9_motivos', 'La actitud del equipo', {
          valueOptions: ['RAPIDEZ', 'OTRO'],
        }),
        // única con OTRO y texto -> sí
        text('r2', 'c10_proceso_reprocesos', 'Compras', {
          valueOption: 'OTRO',
        }),
        // texto que quedó de antes en una opción que no lo pide -> no
        text('r3', 'c10_proceso_reprocesos', 'Residuo', {
          valueOption: 'GERENCIA',
        }),
        // OTRO con puros espacios -> no
        text('r4', 'c9_motivos', '  ', { valueOptions: ['OTRO'] }),
        // la abierta final no tiene opciones -> no
        text('r1', 'c10_cambio_unico', 'Algo'),
      ],
    });

    expect(result.otherSpecified).toBe(2);
  });
});

describe('buildQuality · sin respuestas', () => {
  it('deja los porcentajes en null, nunca en un 0% inventado', () => {
    const result = quality({});

    expect(result.completed).toBe(0);
    expect(result.speeders.share).toBeNull();
    expect(result.straightLining.share).toBeNull();
    expect(result.openAnswers.share).toBeNull();
    expect(result.flatComponents).toHaveLength(6);
    expect(result.flatComponents.every((row) => row.share === null)).toBe(true);
    expect(result.otherSpecified).toBe(0);
  });
});
