import { scaleRow } from '../indicators/indicators.fixture';
import { buildItemStats, indicatorCodeOf, summarizeScale } from './items.kpi';
import type { ScaleQuestion } from './items.kpi';

/**
 * Cada valor esperado está calculado a mano en el comentario que lo acompaña, como en los
 * tests de indicadores.
 */

function question(
  code: string,
  componentId: number,
  sortOrder: number,
  title = `Componente ${componentId}`,
): ScaleQuestion {
  // En el catálogo el `sortOrder` del componente coincide con su id.
  return {
    code,
    label: `Etiqueta de ${code}`,
    componentId,
    sortOrder,
    component: { title, sortOrder: componentId },
  };
}

describe('summarizeScale', () => {
  it('[0, 10]: promedio 5 con la dispersión máxima, consenso 0', () => {
    // media (0 + 10) / 2 = 5; varianza ((0 − 5)² + (10 − 5)²) / 2 = 25; sd = 5
    // consenso 100 × (1 − 5 / 5) = 0
    expect(summarizeScale([0, 10])).toEqual({
      mean: 5,
      index: 50,
      sd: 5,
      consensus: 0,
      distribution: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    });
  });

  it('[7, 7, 7]: sin dispersión, consenso 100', () => {
    // media 7, todos los desvíos 0 -> sd 0; consenso 100 × (1 − 0 / 5) = 100
    expect(summarizeScale([7, 7, 7])).toEqual({
      mean: 7,
      index: 70,
      sd: 0,
      consensus: 100,
      distribution: [0, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0],
    });
  });

  it('usa la desviación poblacional, no la muestral', () => {
    // [6, 8, 10]: media 8; desvíos² 4, 0, 4 -> varianza 8 / 3 = 2.6667; sd = 1.63299 -> 1.63
    // (la muestral dividiría por 2: varianza 4, sd 2)
    // consenso 100 × (1 − 1.63299 / 5) = 67.34 -> 67.3
    expect(summarizeScale([6, 8, 10])).toMatchObject({
      mean: 8,
      index: 80,
      sd: 1.63,
      consensus: 67.3,
    });
  });

  it('redondea la media a 2 decimales y el índice a 1', () => {
    // [7, 7, 8]: 22 / 3 = 7.3333 -> 7.33; índice 73.333 -> 73.3
    expect(summarizeScale([7, 7, 8])).toMatchObject({
      mean: 7.33,
      index: 73.3,
    });
  });

  it('reparte cada nota en el entero más cercano', () => {
    // 7.4 -> 7 y 7.5 -> 8
    expect(summarizeScale([7.4, 7.5]).distribution).toEqual([
      0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0,
    ]);
  });

  it('sin notas deja todo en null y el reparto en 11 ceros', () => {
    expect(summarizeScale([])).toEqual({
      mean: null,
      index: null,
      sd: null,
      consensus: null,
      distribution: new Array(11).fill(0),
    });
  });
});

describe('indicatorCodeOf', () => {
  it('asigna cada pregunta al índice que alimenta', () => {
    expect(indicatorCodeOf('c3_oportunidad')).toBe('ICOM');
    expect(indicatorCodeOf('c4_valor')).toBe('ISI');
    expect(indicatorCodeOf('c5_seguimiento')).toBe('IAG');
    expect(indicatorCodeOf('c6_roles')).toBe('IINT');
    expect(indicatorCodeOf('c7_confianza')).toBe('ICOL');
    expect(indicatorCodeOf('c8_disposicion')).toBe('IINN');
  });

  it('resuelve la pregunta que está en dos índices por el orden del IMC', () => {
    // c2_confianza está en IREL y en ICONF; IREL va primero en el IMC
    expect(indicatorCodeOf('c2_confianza')).toBe('IREL');
    expect(indicatorCodeOf('c2_valor')).toBe('IREL');
  });

  it('marca la recomendación como NPS_INT', () => {
    expect(indicatorCodeOf('c9_nps')).toBe('NPS_INT');
  });

  it('deja vacío lo que no alimenta ningún índice', () => {
    expect(indicatorCodeOf('c99_nueva')).toBe('');
  });
});

describe('buildItemStats', () => {
  it('ordena por componente y luego por pregunta, aunque lleguen desordenadas', () => {
    const questions = [
      question('c9_nps', 9, 40),
      question('c3_claridad', 3, 12),
      question('c2_facilidad', 2, 5),
      question('c3_oportunidad', 3, 11),
    ];

    expect(buildItemStats([], questions).map((item) => item.code)).toEqual([
      'c2_facilidad',
      'c3_oportunidad',
      'c3_claridad',
      'c9_nps',
    ]);
  });

  it('cuenta una observación por área evaluada y un encuestado por respuesta', () => {
    const rows = [
      scaleRow('r1', 'c2_facilidad', 8, 'TECNOLOGIA'),
      scaleRow('r1', 'c2_facilidad', 6, 'COMERCIAL'),
      scaleRow('r2', 'c2_facilidad', 10, 'TECNOLOGIA'),
      // un nulo no es una nota: ni observación ni encuestado
      scaleRow('r3', 'c2_facilidad', null, 'TECNOLOGIA'),
      // una pregunta que no está en el catálogo pedido no aparece
      scaleRow('r1', 'c3_oportunidad', 2),
    ];
    const [item] = buildItemStats(rows, [
      question('c2_facilidad', 2, 5, 'Red de colaboración'),
    ]);

    // [8, 6, 10]: media 8; varianza (0 + 4 + 4) / 3 = 2.6667; sd 1.63; consenso 67.3
    expect(item).toEqual({
      code: 'c2_facilidad',
      label: 'Etiqueta de c2_facilidad',
      componentId: 2,
      componentTitle: 'Red de colaboración',
      indicatorCode: 'IREL',
      respondents: 2,
      observations: 3,
      mean: 8,
      index: 80,
      sd: 1.63,
      consensus: 67.3,
      distribution: [0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 1],
    });
  });

  it('incluye la pregunta sin respuestas, con ceros y nulos', () => {
    const [item] = buildItemStats([], [question('c3_canales', 3, 14)]);

    expect(item).toMatchObject({
      indicatorCode: 'ICOM',
      respondents: 0,
      observations: 0,
      mean: null,
      sd: null,
      consensus: null,
    });
    expect(item.distribution).toHaveLength(11);
  });
});
