import {
  QUESTION_CODES_BY_INDICATOR,
  IAG_SCALE_CODES,
  IINN_SCALE_CODES,
  RADAR_INDICES,
  computeIag,
  computeIcom,
  computeIconf,
  computeIinn,
  computeImc,
  computeIrel,
  computeIval,
  computeNio,
  computeNps,
  computeNpsMotives,
} from './index';
import {
  multiRow,
  optionRow,
  scaleBattery,
  scaleRow,
} from './indicators.fixture';
import type { IndicatorResult } from './indicator.types';

/**
 * Sin base de datos, estos tests SON la única validación de las fórmulas del instrumento.
 * Cada valor esperado está calculado a mano en el comentario que lo acompaña.
 */

describe('índices de promedio simple', () => {
  it('IREL promedia los 5 aspectos del C2 y escala a 0-100', () => {
    // (8 + 6 + 10 + 7 + 9) / 5 = 8.0  ->  80
    const rows = scaleBattery(
      'r1',
      QUESTION_CODES_BY_INDICATOR.IREL,
      [8, 6, 10, 7, 9],
    );
    expect(computeIrel(rows)).toMatchObject({
      code: 'IREL',
      value: 80,
      observations: 5,
    });
  });

  it('ICOM promedia los 5 ítems del C3', () => {
    // (5 + 5 + 6 + 4 + 5) / 5 = 5.0  ->  50
    const rows = scaleBattery(
      'r1',
      QUESTION_CODES_BY_INDICATOR.ICOM,
      [5, 5, 6, 4, 5],
    );
    expect(computeIcom(rows).value).toBe(50);
  });

  it('ICONF aísla solo la confianza, no el promedio de C2', () => {
    // Solo c2_confianza = 10  ->  100, aunque los demás aspectos sean bajos.
    const rows = scaleBattery(
      'r1',
      QUESTION_CODES_BY_INDICATOR.IREL,
      [2, 2, 10, 2, 2],
    );
    expect(computeIconf(rows).value).toBe(100);
    expect(computeIval(rows).value).toBe(20);
  });

  it('promedia entre respuestas distintas, no dentro de cada una', () => {
    // r1: (10,10,10,10,10) y r2: (0,0,0,0,0) -> promedio global 5.0 -> 50
    const rows = [
      ...scaleBattery(
        'r1',
        QUESTION_CODES_BY_INDICATOR.IREL,
        [10, 10, 10, 10, 10],
      ),
      ...scaleBattery('r2', QUESTION_CODES_BY_INDICATOR.IREL, [0, 0, 0, 0, 0]),
    ];
    expect(computeIrel(rows)).toMatchObject({
      value: 50,
      respondents: 2,
      observations: 10,
    });
  });

  it('devuelve null sin datos, no 0', () => {
    expect(computeIrel([]).value).toBeNull();
  });

  it('ignora los nulos en vez de imputarlos como 0', () => {
    // (8 + 8) / 2 = 8.0 -> 80. Si imputara 0 los tres nulos daría 32.
    const rows = scaleBattery('r1', QUESTION_CODES_BY_INDICATOR.IREL, [
      8,
      8,
      null,
      null,
      null,
    ]);
    expect(computeIrel(rows)).toMatchObject({ value: 80, observations: 2 });
  });

  it('cuenta el 0 como calificación real y no como ausencia', () => {
    // (0 + 10) / 2 = 5.0 -> 50
    const rows = scaleBattery('r1', QUESTION_CODES_BY_INDICATOR.IREL, [
      0,
      10,
      null,
      null,
      null,
    ]);
    expect(computeIrel(rows)).toMatchObject({ value: 50, observations: 2 });
  });

  it('ignora preguntas ajenas al indicador', () => {
    const rows = [
      ...scaleBattery(
        'r1',
        QUESTION_CODES_BY_INDICATOR.IREL,
        [10, 10, 10, 10, 10],
      ),
      scaleRow('r1', 'c3_claridad', 0),
    ];
    expect(computeIrel(rows).value).toBe(100);
  });
});

describe('NIO', () => {
  it('pondera frecuencia, amplitud y diversidad al 50/30/20', () => {
    // F: DIARIA = 100 ; A: 5/5 = 100 ; D: 5/5 = 100
    // 0.5*100 + 0.3*100 + 0.2*100 = 100
    const rows = [
      optionRow('r1', 'c1_frecuencia', 'DIARIA'),
      multiRow('r1', 'c1_areas_interaccion', ['A', 'B', 'C', 'D', 'E']),
      multiRow('r1', 'c1_tipo_interaccion', [
        'OPERATIVA',
        'TACTICA',
        'ESTRATEGICA',
        'COMERCIAL',
        'SOPORTE',
      ]),
    ];
    expect(computeNio(rows).value).toBe(100);
  });

  it('calcula la ponderación con valores mixtos', () => {
    // F: SEMANAL = 60 ; A: 2/5 = 40 ; D: 1/5 = 20
    // 0.5*60 + 0.3*40 + 0.2*20 = 30 + 12 + 4 = 46
    const rows = [
      optionRow('r1', 'c1_frecuencia', 'SEMANAL'),
      multiRow('r1', 'c1_areas_interaccion', ['A', 'B']),
      multiRow('r1', 'c1_tipo_interaccion', ['OPERATIVA']),
    ];
    expect(computeNio(rows).value).toBe(46);
  });

  it('no cuenta OTRA como área, porque no identifica un área del catálogo', () => {
    // A: solo 1 área real de 5 = 20, no 40.
    // F: DIARIA = 100 ; D: 1/5 = 20
    // 0.5*100 + 0.3*20 + 0.2*20 = 50 + 6 + 4 = 60
    const rows = [
      optionRow('r1', 'c1_frecuencia', 'DIARIA'),
      multiRow('r1', 'c1_areas_interaccion', ['A', 'OTRA']),
      multiRow('r1', 'c1_tipo_interaccion', ['OPERATIVA']),
    ];
    expect(computeNio(rows).value).toBe(60);
  });

  it('reescala los pesos cuando falta un componente', () => {
    // Solo F: DIARIA = 100. Peso disponible 0.5 -> 100/1 = 100, no 50.
    const rows = [optionRow('r1', 'c1_frecuencia', 'DIARIA')];
    expect(computeNio(rows).value).toBe(100);
  });

  it('promedia por respuesta y no mezcla los componentes entre personas', () => {
    // r1 = 100 (todo al máximo) ; r2: F ESPORADICA=20, A 1/5=20, D 1/5=20 -> 20
    // (100 + 20) / 2 = 60
    const rows = [
      optionRow('r1', 'c1_frecuencia', 'DIARIA'),
      multiRow('r1', 'c1_areas_interaccion', ['A', 'B', 'C', 'D', 'E']),
      multiRow('r1', 'c1_tipo_interaccion', ['A', 'B', 'C', 'D', 'E']),
      optionRow('r2', 'c1_frecuencia', 'ESPORADICA'),
      multiRow('r2', 'c1_areas_interaccion', ['A']),
      multiRow('r2', 'c1_tipo_interaccion', ['OPERATIVA']),
    ];
    expect(computeNio(rows)).toMatchObject({ value: 60, respondents: 2 });
  });

  it('devuelve null cuando no hay nada que medir', () => {
    expect(computeNio([]).value).toBeNull();
  });
});

describe('IAG', () => {
  it('pondera las escalas al 75% y el tiempo de respuesta al 25%', () => {
    // Escalas: (8,8,8,8) -> 8.0 -> 80 ; Tiempo: MISMO_DIA = 80
    // 0.75*80 + 0.25*80 = 80
    const rows = [
      ...scaleBattery('r1', IAG_SCALE_CODES, [8, 8, 8, 8]),
      optionRow('r1', 'c5_tiempo_respuesta', 'MISMO_DIA'),
    ];
    expect(computeIag(rows).value).toBe(80);
  });

  it('separa el efecto de cada mitad', () => {
    // Escalas: (10,10,10,10) -> 100 ; Tiempo: MAS_3_DIAS = 10
    // 0.75*100 + 0.25*10 = 75 + 2.5 = 77.5
    const rows = [
      ...scaleBattery('r1', IAG_SCALE_CODES, [10, 10, 10, 10]),
      optionRow('r1', 'c5_tiempo_respuesta', 'MAS_3_DIAS'),
    ];
    expect(computeIag(rows).value).toBe(77.5);
  });

  it('reescala al 100% las escalas si no hay tiempo declarado', () => {
    // Escalas -> 60. Sin tiempo, el peso 0.25 se redistribuye: resultado 60, no 45.
    const rows = scaleBattery('r1', IAG_SCALE_CODES, [6, 6, 6, 6]);
    expect(computeIag(rows).value).toBe(60);
  });

  it('funciona con solo el tiempo declarado', () => {
    const rows = [optionRow('r1', 'c5_tiempo_respuesta', 'MENOS_2H')];
    expect(computeIag(rows).value).toBe(100);
  });

  it('promedia el tiempo por respuesta, no por fila de escala', () => {
    // r1 tiene 4 escalas y r2 solo 1, pero cada uno aporta UN tiempo.
    // Escalas: (10,10,10,10, 0) -> 40/5 = 8.0 -> 80
    // Tiempos: MENOS_2H=100 y MAS_3_DIAS=10 -> 55
    // 0.75*80 + 0.25*55 = 60 + 13.75 = 73.75
    const rows = [
      ...scaleBattery('r1', IAG_SCALE_CODES, [10, 10, 10, 10]),
      optionRow('r1', 'c5_tiempo_respuesta', 'MENOS_2H'),
      scaleRow('r2', IAG_SCALE_CODES[0], 0),
      optionRow('r2', 'c5_tiempo_respuesta', 'MAS_3_DIAS'),
    ];
    expect(computeIag(rows).value).toBe(73.75);
  });

  it('devuelve null sin datos', () => {
    expect(computeIag([]).value).toBeNull();
  });
});

describe('IINN', () => {
  it('pondera las escalas al 80% y la colaboración al 20%', () => {
    // Escalas: (7,7,7,7) -> 7.0 -> 70 ; R: 3 áreas / 3 = 100
    // 0.8*70 + 0.2*100 = 56 + 20 = 76
    const rows = [
      ...scaleBattery('r1', IINN_SCALE_CODES, [7, 7, 7, 7]),
      multiRow('r1', 'c8_areas_iniciativas', [
        'PMO',
        'TECNOLOGIA',
        'COMERCIAL',
      ]),
    ];
    expect(computeIinn(rows).value).toBe(76);
  });

  it('trata NINGUNA como cero colaboración, no como dato ausente', () => {
    // Escalas -> 100 ; R: 0 áreas -> 0
    // 0.8*100 + 0.2*0 = 80  (si NINGUNA se leyera como ausencia, daría 100)
    const rows = [
      ...scaleBattery('r1', IINN_SCALE_CODES, [10, 10, 10, 10]),
      multiRow('r1', 'c8_areas_iniciativas', ['NINGUNA']),
    ];
    expect(computeIinn(rows).value).toBe(80);
  });

  it('topa la colaboración en 3 áreas', () => {
    // R con 5 áreas sigue siendo 100, no 166.
    // Escalas -> 50 ; 0.8*50 + 0.2*100 = 40 + 20 = 60
    const rows = [
      ...scaleBattery('r1', IINN_SCALE_CODES, [5, 5, 5, 5]),
      multiRow('r1', 'c8_areas_iniciativas', ['A', 'B', 'C', 'D', 'E']),
    ];
    expect(computeIinn(rows).value).toBe(60);
  });

  it('reescala cuando no se respondió la pregunta de iniciativas', () => {
    const rows = scaleBattery('r1', IINN_SCALE_CODES, [9, 9, 9, 9]);
    expect(computeIinn(rows).value).toBe(90);
  });
});

describe('NPS', () => {
  const nps = (values: number[]) =>
    computeNps(
      values.map((value, index) =>
        scaleRow(`r${index}`, 'c9_nps', value, 'PMO'),
      ),
    );

  it('da +100 con solo promotores', () => {
    expect(nps([9, 10, 10])).toMatchObject({
      value: 100,
      promoters: 3,
      detractors: 0,
    });
  });

  it('da -100 con solo detractores', () => {
    expect(nps([0, 3, 6])).toMatchObject({
      value: -100,
      promoters: 0,
      detractors: 3,
    });
  });

  it('da 0 con solo pasivos, que no suman ni restan', () => {
    expect(nps([7, 8])).toMatchObject({ value: 0, passives: 2 });
  });

  it('calcula una mezcla', () => {
    // 10 respuestas: 5 promotores (50%), 2 pasivos, 3 detractores (30%)
    // 50 - 30 = 20
    expect(nps([9, 9, 10, 10, 10, 7, 8, 0, 5, 6])).toMatchObject({
      value: 20,
      promoters: 5,
      passives: 2,
      detractors: 3,
      total: 10,
    });
  });

  it('respeta los cortes 9-10 / 7-8 / 0-6', () => {
    expect(nps([8]).promoters).toBe(0);
    expect(nps([9]).promoters).toBe(1);
    expect(nps([6]).detractors).toBe(1);
    expect(nps([7]).detractors).toBe(0);
  });

  it('cuenta cada par encuestado-área, no cada encuestado', () => {
    // Una sola persona califica 4 áreas: 4 observaciones.
    const rows = ['PMO', 'TECNOLOGIA', 'COMERCIAL', 'JURIDICA'].map((area) =>
      scaleRow('r1', 'c9_nps', 10, area),
    );
    expect(computeNps(rows).total).toBe(4);
  });

  it('devuelve null sin datos', () => {
    expect(computeNps([]).value).toBeNull();
  });
});

describe('computeNpsMotives', () => {
  it('atribuye los motivos según el promedio de calificaciones del encuestado', () => {
    const rows = [
      scaleRow('r1', 'c9_nps', 10, 'PMO'),
      scaleRow('r1', 'c9_nps', 10, 'TECNOLOGIA'),
      multiRow('r1', 'c9_motivos', ['SERVICIO', 'RAPIDEZ']),
      scaleRow('r2', 'c9_nps', 2, 'PMO'),
      multiRow('r2', 'c9_motivos', ['COMUNICACION']),
    ];
    const { promoters, detractors } = computeNpsMotives(rows);
    expect(promoters.get('SERVICIO')).toBe(1);
    expect(promoters.get('RAPIDEZ')).toBe(1);
    expect(detractors.get('COMUNICACION')).toBe(1);
  });

  it('descarta a los pasivos, cuyos motivos no explican ni recomendación ni rechazo', () => {
    const rows = [
      scaleRow('r1', 'c9_nps', 7, 'PMO'),
      multiRow('r1', 'c9_motivos', ['ACTITUD']),
    ];
    const { promoters, detractors } = computeNpsMotives(rows);
    expect(promoters.size).toBe(0);
    expect(detractors.size).toBe(0);
  });

  it('usa el promedio y no una sola área para clasificar', () => {
    // (10 + 0) / 2 = 5  ->  detractor
    const rows = [
      scaleRow('r1', 'c9_nps', 10, 'PMO'),
      scaleRow('r1', 'c9_nps', 0, 'TECNOLOGIA'),
      multiRow('r1', 'c9_motivos', ['CONOCIMIENTO']),
    ];
    expect(computeNpsMotives(rows).detractors.get('CONOCIMIENTO')).toBe(1);
  });

  it('ignora motivos sin ninguna calificación asociada', () => {
    const rows = [multiRow('r1', 'c9_motivos', ['SERVICIO'])];
    const { promoters, detractors } = computeNpsMotives(rows);
    expect(promoters.size + detractors.size).toBe(0);
  });
});

describe('IMC', () => {
  const weights = new Map([
    ['IREL', 0.2],
    ['ICOM', 0.15],
    ['ISI', 0.15],
    ['IAG', 0.15],
    ['IINT', 0.15],
    ['ICOL', 0.1],
    ['IINN', 0.1],
  ]);

  const indicator = (code: string, value: number | null): IndicatorResult =>
    ({ code, value, respondents: 4, observations: 20 }) as IndicatorResult;

  it('aplica los pesos de Contexto.md §4.4', () => {
    // 0.2*80 + 0.15*60 + 0.15*70 + 0.15*50 + 0.15*90 + 0.1*40 + 0.1*100
    // = 16 + 9 + 10.5 + 7.5 + 13.5 + 4 + 10 = 70.5
    const result = computeImc(
      [
        indicator('IREL', 80),
        indicator('ICOM', 60),
        indicator('ISI', 70),
        indicator('IAG', 50),
        indicator('IINT', 90),
        indicator('ICOL', 40),
        indicator('IINN', 100),
      ],
      weights,
    );
    expect(result).toMatchObject({ code: 'IMC', value: 70.5 });
  });

  it('devuelve el mismo valor si todos los índices coinciden', () => {
    const all = ['IREL', 'ICOM', 'ISI', 'IAG', 'IINT', 'ICOL', 'IINN'].map(
      (code) => indicator(code, 75),
    );
    expect(computeImc(all, weights).value).toBe(75);
  });

  it('redistribuye el peso de un índice sin datos en vez de tratarlo como 0', () => {
    // Solo IREL (0.2) e ICOM (0.15) tienen dato: (0.2*100 + 0.15*50) / 0.35
    // = (20 + 7.5) / 0.35 = 27.5 / 0.35 = 78.571... -> 78.57
    const result = computeImc(
      [indicator('IREL', 100), indicator('ICOM', 50)],
      weights,
    );
    expect(result.value).toBeCloseTo(78.57, 2);
  });

  it('no deja que un índice nulo hunda el resultado', () => {
    const conNulo = computeImc(
      [indicator('IREL', 80), indicator('ICOM', null)],
      weights,
    );
    expect(conNulo.value).toBe(80);
  });

  it('excluye NIO y NPS_INT del compuesto', () => {
    // NIO en 0 no debe mover un IMC construido solo con IREL.
    const result = computeImc(
      [indicator('IREL', 90), indicator('NIO', 0), indicator('NPS_INT', -100)],
      weights,
    );
    expect(result.value).toBe(90);
  });

  it('devuelve null si ningún componente tiene valor', () => {
    expect(computeImc([indicator('IREL', null)], weights).value).toBeNull();
  });

  it('devuelve null con la lista vacía', () => {
    expect(computeImc([], weights).value).toBeNull();
  });
});

describe('RADAR_INDICES', () => {
  it('lleva los 7 del IMC más NIO, sin ICONF, IVAL ni NPS_INT', () => {
    const codes = RADAR_INDICES.map((entry) => entry.code);
    expect(codes).toHaveLength(8);
    expect(codes).toContain('NIO');
    expect(codes).not.toContain('ICONF');
    expect(codes).not.toContain('IVAL');
    expect(codes).not.toContain('NPS_INT');
  });
});
