import { GLOBAL_AREA_CODE } from '../../common/constants';
import type { RawAnswerRow } from '../indicators/indicator.types';
import {
  buildAreaRanking,
  buildAspectMatrix,
  buildPerceptionGap,
  buildRelationshipMap,
} from './relationship.kpi';
import {
  buildInnovationNetwork,
  buildResponseTimeDistribution,
  countMultiOptions,
  countSingleOptions,
} from './distribution.kpi';

const AREAS = new Map([
  ['PMO', 'PMO'],
  ['TECNOLOGIA', 'Tecnología'],
  ['COMERCIAL', 'Comercial'],
]);

/** Califica los 5 aspectos del C2 con el mismo valor, para simplificar la aritmética. */
function c2(
  responseId: string,
  ownArea: string,
  targetArea: string,
  value: number,
): RawAnswerRow[] {
  return [
    'c2_facilidad',
    'c2_comunicacion',
    'c2_confianza',
    'c2_cumplimiento',
    'c2_valor',
  ].map((questionCode) => ({
    responseId,
    ownArea,
    targetArea,
    questionCode,
    valueNumber: value,
    valueOption: null,
    valueOptions: [],
  }));
}

function option(
  responseId: string,
  questionCode: string,
  valueOption: string,
  ownArea = 'PMO',
): RawAnswerRow {
  return {
    responseId,
    ownArea,
    targetArea: GLOBAL_AREA_CODE,
    questionCode,
    valueNumber: null,
    valueOption,
    valueOptions: [],
  };
}

function multi(
  responseId: string,
  questionCode: string,
  valueOptions: string[],
  ownArea = 'PMO',
): RawAnswerRow {
  return {
    responseId,
    ownArea,
    targetArea: GLOBAL_AREA_CODE,
    questionCode,
    valueNumber: null,
    valueOption: null,
    valueOptions,
  };
}

describe('buildRelationshipMap', () => {
  it('crea una celda por par evaluador-evaluada', () => {
    const rows = [
      ...c2('r1', 'PMO', 'TECNOLOGIA', 8),
      ...c2('r1', 'PMO', 'COMERCIAL', 6),
    ];
    const map = buildRelationshipMap(rows, AREAS);

    expect(map.cells).toHaveLength(2);
    expect(map.cells.find((c) => c.targetArea === 'TECNOLOGIA')?.irel).toBe(80);
    expect(map.cells.find((c) => c.targetArea === 'COMERCIAL')?.irel).toBe(60);
  });

  it('promedia varias personas de la misma área evaluadora', () => {
    // r1 califica 10 y r2 califica 0 -> promedio 5.0 -> 50
    const rows = [
      ...c2('r1', 'PMO', 'TECNOLOGIA', 10),
      ...c2('r2', 'PMO', 'TECNOLOGIA', 0),
    ];
    const cell = buildRelationshipMap(rows, AREAS).cells[0];

    expect(cell.irel).toBe(50);
    expect(cell.respondents).toBe(2);
  });

  it('pondera el peso de la arista por la frecuencia de interacción', () => {
    // DIARIA = 100 para una persona -> peso 100
    const rows = [
      ...c2('r1', 'PMO', 'TECNOLOGIA', 8),
      option('r1', 'c1_frecuencia', 'DIARIA'),
    ];
    expect(buildRelationshipMap(rows, AREAS).cells[0].weight).toBe(100);
  });

  it('da peso cero cuando no se declaró frecuencia', () => {
    const rows = c2('r1', 'PMO', 'TECNOLOGIA', 8);
    expect(buildRelationshipMap(rows, AREAS).cells[0].weight).toBe(0);
  });

  it('excluye OTRA de la matriz, porque no identifica un área del catálogo', () => {
    const rows = [
      ...c2('r1', 'PMO', 'OTRA', 9),
      ...c2('r1', 'PMO', 'TECNOLOGIA', 7),
    ];
    const map = buildRelationshipMap(rows, AREAS);

    expect(map.cells).toHaveLength(1);
    expect(map.cells[0].targetArea).toBe('TECNOLOGIA');
  });

  it('calcula grado entrante y saliente por separado', () => {
    const rows = [
      ...c2('r1', 'PMO', 'TECNOLOGIA', 8),
      option('r1', 'c1_frecuencia', 'DIARIA'),
      ...c2('r2', 'TECNOLOGIA', 'PMO', 6),
      option('r2', 'c1_frecuencia', 'SEMANAL'),
    ];
    const degrees = buildRelationshipMap(rows, AREAS).degrees;

    expect(degrees.find((d) => d.areaCode === 'PMO')).toMatchObject({
      outbound: 100,
      inbound: 60,
    });
  });
});

describe('buildAreaRanking', () => {
  it('ordena las áreas por el relacionamiento que reciben, de mayor a menor', () => {
    const rows = [
      ...c2('r1', 'PMO', 'TECNOLOGIA', 9),
      ...c2('r1', 'PMO', 'COMERCIAL', 4),
    ];
    const ranking = buildAreaRanking(rows, AREAS);

    expect(ranking.map((row) => row.areaCode)).toEqual([
      'TECNOLOGIA',
      'COMERCIAL',
    ]);
    expect(ranking[0].irel).toBe(90);
  });

  it('agrega evaluaciones de distintas áreas evaluadoras sobre la misma evaluada', () => {
    // PMO da 10 y COMERCIAL da 6 -> promedio 8.0 -> 80
    const rows = [
      ...c2('r1', 'PMO', 'TECNOLOGIA', 10),
      ...c2('r2', 'COMERCIAL', 'TECNOLOGIA', 6),
    ];
    expect(buildAreaRanking(rows, AREAS)[0]).toMatchObject({
      irel: 80,
      respondents: 2,
    });
  });
});

describe('buildPerceptionGap', () => {
  it('separa lo que un área recibe de lo que otorga', () => {
    // TECNOLOGIA recibe 9 (de PMO) y otorga 5 (a PMO): brecha +40
    const rows = [
      ...c2('r1', 'PMO', 'TECNOLOGIA', 9),
      ...c2('r2', 'TECNOLOGIA', 'PMO', 5),
    ];
    const gap = buildPerceptionGap(rows, AREAS);
    const tecnologia = gap.find((row) => row.areaCode === 'TECNOLOGIA');

    expect(tecnologia).toMatchObject({ received: 90, granted: 50, gap: 40 });
  });

  it('detecta el área exigente con brecha negativa', () => {
    // PMO recibe 5 y otorga 9: brecha -40
    const rows = [
      ...c2('r1', 'PMO', 'TECNOLOGIA', 9),
      ...c2('r2', 'TECNOLOGIA', 'PMO', 5),
    ];
    expect(
      buildPerceptionGap(rows, AREAS).find((r) => r.areaCode === 'PMO')?.gap,
    ).toBe(-40);
  });

  it('deja la brecha en null cuando falta uno de los dos lados', () => {
    const rows = c2('r1', 'PMO', 'TECNOLOGIA', 8);
    expect(
      buildPerceptionGap(rows, AREAS).find((r) => r.areaCode === 'TECNOLOGIA'),
    ).toMatchObject({ granted: null, gap: null });
  });
});

describe('buildAspectMatrix', () => {
  it('desglosa los 5 aspectos por área evaluada', () => {
    const rows: RawAnswerRow[] = [
      {
        responseId: 'r1',
        ownArea: 'PMO',
        targetArea: 'TECNOLOGIA',
        questionCode: 'c2_comunicacion',
        valueNumber: 3,
        valueOption: null,
        valueOptions: [],
      },
      {
        responseId: 'r1',
        ownArea: 'PMO',
        targetArea: 'TECNOLOGIA',
        questionCode: 'c2_cumplimiento',
        valueNumber: 9,
        valueOption: null,
        valueOptions: [],
      },
    ];
    const matrix = buildAspectMatrix(rows, AREAS);

    // Distingue el aspecto flojo del fuerte, que es lo que el IREL agregado esconde.
    expect(matrix[0].aspects.c2_comunicacion).toBe(30);
    expect(matrix[0].aspects.c2_cumplimiento).toBe(90);
    expect(matrix[0].aspects.c2_confianza).toBeNull();
  });
});

describe('countMultiOptions', () => {
  it('cuenta marcas y calcula el porcentaje sobre encuestados, no sobre marcas', () => {
    // 2 encuestados. COMUNICACION la marcan los dos -> 100%, PROCESOS solo uno -> 50%
    const rows = [
      multi('r1', 'c10_obstaculo', ['COMUNICACION', 'PROCESOS']),
      multi('r2', 'c10_obstaculo', ['COMUNICACION']),
    ];
    const counts = countMultiOptions(rows, 'c10_obstaculo');

    expect(counts[0]).toMatchObject({
      value: 'COMUNICACION',
      count: 2,
      share: 100,
    });
    expect(counts[1]).toMatchObject({ value: 'PROCESOS', count: 1, share: 50 });
  });

  it('ordena de más a menos mencionado', () => {
    const rows = [
      multi('r1', 'c10_obstaculo', ['CULTURA']),
      multi('r2', 'c10_obstaculo', ['ROLES']),
      multi('r3', 'c10_obstaculo', ['ROLES']),
    ];
    expect(countMultiOptions(rows, 'c10_obstaculo')[0].value).toBe('ROLES');
  });

  it('usa las etiquetas del catálogo cuando se le pasan', () => {
    const rows = [multi('r1', 'c10_obstaculo', ['COMUNICACION'])];
    const labels = new Map([['COMUNICACION', 'Comunicación']]);
    expect(countMultiOptions(rows, 'c10_obstaculo', labels)[0].label).toBe(
      'Comunicación',
    );
  });

  it('devuelve vacío cuando nadie respondió', () => {
    expect(countMultiOptions([], 'c10_obstaculo')).toEqual([]);
  });
});

describe('countSingleOptions', () => {
  it('cuenta y ordena las opciones únicas', () => {
    const rows = [
      option('r1', 'c10_area_mayor_valor', 'TECNOLOGIA'),
      option('r2', 'c10_area_mayor_valor', 'TECNOLOGIA'),
      option('r3', 'c10_area_mayor_valor', 'PMO'),
    ];
    const counts = countSingleOptions(rows, 'c10_area_mayor_valor');

    expect(counts[0]).toMatchObject({ value: 'TECNOLOGIA', count: 2 });
    expect(counts[0].share).toBeCloseTo(66.7, 1);
  });
});

describe('buildResponseTimeDistribution', () => {
  it('conserva el orden temporal del instrumento e incluye los tramos vacíos', () => {
    const rows = [
      option('r1', 'c5_tiempo_respuesta', 'MENOS_2H'),
      option('r2', 'c5_tiempo_respuesta', 'MAS_3_DIAS'),
    ];
    const dist = buildResponseTimeDistribution(rows);

    expect(dist.map((row) => row.value)).toEqual([
      'MENOS_2H',
      'MISMO_DIA',
      'H24',
      'H48',
      'MAS_3_DIAS',
    ]);
    expect(dist.find((row) => row.value === 'MISMO_DIA')?.count).toBe(0);
    expect(dist.find((row) => row.value === 'MENOS_2H')?.share).toBe(50);
  });
});

describe('buildInnovationNetwork', () => {
  it('cuenta iniciativas conjuntas por par de áreas', () => {
    const rows = [
      multi('r1', 'c8_areas_iniciativas', ['TECNOLOGIA'], 'PMO'),
      multi('r2', 'c8_areas_iniciativas', ['TECNOLOGIA'], 'PMO'),
    ];
    expect(buildInnovationNetwork(rows)[0]).toMatchObject({
      sourceArea: 'PMO',
      targetArea: 'TECNOLOGIA',
      initiatives: 2,
    });
  });

  it('no crea aristas para NINGUNA, que es ausencia de colaboración', () => {
    const rows = [multi('r1', 'c8_areas_iniciativas', ['NINGUNA'], 'PMO')];
    expect(buildInnovationNetwork(rows)).toEqual([]);
  });
});
