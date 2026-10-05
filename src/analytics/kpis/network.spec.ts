import {
  multiRow,
  optionRow,
  scaleRow,
} from '../indicators/indicators.fixture';
import type { RawAnswerRow } from '../indicators/indicator.types';
import {
  buildDemand,
  buildFrequency,
  buildImportance,
  buildInnovationSummary,
  buildInteractionTypes,
  buildNetwork,
  buildValueVsStrengthen,
} from './network.kpi';
import type { NetworkArea, NetworkOption } from './network.kpi';

/** En el orden del catálogo, con OTRA al final como en la base. */
const AREAS: NetworkArea[] = [
  {
    code: 'PMO',
    name: 'PMO',
    isEvaluable: true,
    proceso: { name: 'Gestión de proyectos' },
  },
  {
    code: 'TECNOLOGIA',
    name: 'Tecnología',
    isEvaluable: true,
    proceso: { name: 'Gestión TI' },
  },
  {
    code: 'COMERCIAL',
    name: 'Comercial',
    isEvaluable: true,
    proceso: { name: 'Gestión comercial' },
  },
  { code: 'LEGAL', name: 'Legal', isEvaluable: true, proceso: null },
  { code: 'OTRA', name: 'Otra', isEvaluable: false, proceso: null },
];

const FREQUENCY_LABELS = new Map([
  ['DIARIA', 'Diaria'],
  ['VARIAS_SEMANA', 'Varias veces por semana'],
  ['SEMANAL', 'Semanal'],
  ['MENSUAL', 'Mensual'],
  ['ESPORADICA', 'Esporádica'],
]);

/** Las 5 opciones del C1.4 en el orden del instrumento. */
const INTERACTION_TYPES = [
  { value: 'OPERATIVA', label: 'Operativa' },
  { value: 'TACTICA', label: 'Táctica' },
  { value: 'ESTRATEGICA', label: 'Estratégica' },
  { value: 'COMERCIAL', label: 'Comercial' },
  { value: 'SOPORTE', label: 'Soporte' },
];

const OPTIONS: NetworkOption[] = [
  ...[...FREQUENCY_LABELS].map(([value, label]) => ({
    questionCode: 'c1_frecuencia',
    value,
    label,
  })),
  ...INTERACTION_TYPES.map((option) => ({
    questionCode: 'c1_tipo_interaccion',
    ...option,
  })),
];

/** Las filas del fixture son de PMO; la red de innovación necesita otras áreas de origen. */
function from(ownArea: string, row: RawAnswerRow): RawAnswerRow {
  return { ...row, ownArea };
}

describe('buildDemand', () => {
  const rows = [
    multiRow('r1', 'c1_areas_interaccion', ['COMERCIAL', 'TECNOLOGIA']),
    optionRow('r1', 'c1_area_principal', 'TECNOLOGIA'),
    multiRow('r2', 'c1_areas_interaccion', ['TECNOLOGIA']),
    optionRow('r2', 'c1_area_principal', 'TECNOLOGIA'),
    // OTRA quedó de respuestas históricas: no es un área de la red, pero r3 sí respondió
    multiRow('r3', 'c1_areas_interaccion', ['COMERCIAL', 'LEGAL', 'OTRA']),
    optionRow('r3', 'c1_area_principal', 'LEGAL'),
  ];

  it('lista todas las áreas evaluables con ceros, de la más a la menos mencionada', () => {
    const demand = buildDemand(rows, AREAS);

    // TECNOLOGIA 2 y COMERCIAL 2 empatan: queda primero la que va antes en el catálogo.
    // PMO no la menciona nadie y sale igual, al final. OTRA no sale.
    expect(demand.map((row) => [row.areaCode, row.mentions])).toEqual([
      ['TECNOLOGIA', 2],
      ['COMERCIAL', 2],
      ['LEGAL', 1],
      ['PMO', 0],
    ]);
  });

  it('cuenta la relación principal y el % sobre quienes respondieron', () => {
    const byArea = new Map(
      buildDemand(rows, AREAS).map((row) => [row.areaCode, row]),
    );

    // 3 encuestados. TECNOLOGIA: 2 / 3 = 66.67% -> 66.7, principal de r1 y r2
    expect(byArea.get('TECNOLOGIA')).toEqual({
      areaCode: 'TECNOLOGIA',
      areaName: 'Tecnología',
      procesoName: 'Gestión TI',
      mentions: 2,
      principal: 2,
      mentionShare: 66.7,
    });
    // COMERCIAL: 66.7% de menciones pero nadie la tiene como principal
    expect(byArea.get('COMERCIAL')).toMatchObject({
      principal: 0,
      mentionShare: 66.7,
    });
    // LEGAL: 1 / 3 = 33.3%, principal de r3; sin gestión
    expect(byArea.get('LEGAL')).toMatchObject({
      procesoName: null,
      principal: 1,
      mentionShare: 33.3,
    });
    expect(byArea.get('PMO')).toMatchObject({
      mentions: 0,
      principal: 0,
      mentionShare: 0,
    });
  });
});

describe('buildImportance', () => {
  it('cruza las áreas mencionadas con el IREL que reciben', () => {
    const rows = [
      multiRow('r1', 'c1_areas_interaccion', ['TECNOLOGIA', 'COMERCIAL']),
      multiRow('r2', 'c1_areas_interaccion', ['TECNOLOGIA']),
      scaleRow('r1', 'c2_facilidad', 8, 'TECNOLOGIA'),
      scaleRow('r2', 'c2_facilidad', 6, 'TECNOLOGIA'),
      // PMO recibe evaluación pero nadie la mencionó en este corte
      scaleRow('r3', 'c2_facilidad', 9, 'PMO'),
    ];
    const importance = buildImportance(rows, buildDemand(rows, AREAS));

    // TECNOLOGIA: IREL (8 + 6) / 2 = 7.0 -> 70, sostenido por 2 personas.
    // COMERCIAL se menciona pero nadie la evaluó: sin IREL no hay punto que pintar.
    // PMO tiene IREL pero 0 menciones. La cohorte por área la aplica el servicio.
    expect(importance).toEqual([
      {
        areaCode: 'TECNOLOGIA',
        areaName: 'Tecnología',
        mentions: 2,
        irel: 70,
        respondents: 2,
      },
    ]);
  });
});

describe('buildFrequency', () => {
  it('sigue el orden de la escala con ceros y el % sobre respuestas', () => {
    const rows = [
      optionRow('r1', 'c1_frecuencia', 'SEMANAL'),
      optionRow('r2', 'c1_frecuencia', 'DIARIA'),
      optionRow('r3', 'c1_frecuencia', 'SEMANAL'),
      optionRow('r4', 'c1_frecuencia', 'ESPORADICA'),
    ];

    // 4 respuestas: DIARIA 1 (25%), SEMANAL 2 (50%), ESPORADICA 1 (25%), el resto 0
    expect(buildFrequency(rows, FREQUENCY_LABELS)).toEqual([
      { value: 'DIARIA', label: 'Diaria', count: 1, share: 25 },
      {
        value: 'VARIAS_SEMANA',
        label: 'Varias veces por semana',
        count: 0,
        share: 0,
      },
      { value: 'SEMANAL', label: 'Semanal', count: 2, share: 50 },
      { value: 'MENSUAL', label: 'Mensual', count: 0, share: 0 },
      { value: 'ESPORADICA', label: 'Esporádica', count: 1, share: 25 },
    ]);
  });
});

describe('buildInteractionTypes', () => {
  it('calcula el % sobre encuestados e incluye las opciones que nadie marcó', () => {
    const rows = [
      multiRow('r1', 'c1_tipo_interaccion', ['OPERATIVA', 'SOPORTE']),
      multiRow('r2', 'c1_tipo_interaccion', ['OPERATIVA']),
      multiRow('r3', 'c1_tipo_interaccion', [
        'OPERATIVA',
        'TACTICA',
        'SOPORTE',
      ]),
    ];
    const types = buildInteractionTypes(rows, INTERACTION_TYPES);

    // 3 encuestados: OPERATIVA 3 (100%), SOPORTE 2 (66.7%), TACTICA 1 (33.3%). Suman 200%:
    // es múltiple. Los ceros quedan al final en el orden del instrumento.
    expect(types.map((row) => [row.value, row.count, row.share])).toEqual([
      ['OPERATIVA', 3, 100],
      ['SOPORTE', 2, 66.7],
      ['TACTICA', 1, 33.3],
      ['ESTRATEGICA', 0, 0],
      ['COMERCIAL', 0, 0],
    ]);
    expect(types[2].label).toBe('Táctica');
  });
});

describe('buildValueVsStrengthen', () => {
  it('ordena por valor menos señalamientos y omite las áreas sin ninguno', () => {
    const rows = [
      optionRow('r1', 'c10_area_mayor_valor', 'TECNOLOGIA'),
      optionRow('r2', 'c10_area_mayor_valor', 'TECNOLOGIA'),
      optionRow('r3', 'c10_area_mayor_valor', 'PMO'),
      optionRow('r4', 'c10_area_mayor_valor', 'COMERCIAL'),
      optionRow('r1', 'c10_area_fortalecer', 'COMERCIAL'),
      optionRow('r2', 'c10_area_fortalecer', 'COMERCIAL'),
      optionRow('r3', 'c10_area_fortalecer', 'PMO'),
      optionRow('r4', 'c10_area_fortalecer', 'COMERCIAL'),
    ];

    // TECNOLOGIA 2 − 0 = +2; PMO 1 − 1 = 0; COMERCIAL 1 − 3 = −2; LEGAL 0 + 0 no sale
    expect(buildValueVsStrengthen(rows, AREAS)).toEqual([
      {
        areaCode: 'TECNOLOGIA',
        areaName: 'Tecnología',
        value: 2,
        strengthen: 0,
      },
      { areaCode: 'PMO', areaName: 'PMO', value: 1, strengthen: 1 },
      { areaCode: 'COMERCIAL', areaName: 'Comercial', value: 1, strengthen: 3 },
    ]);
  });
});

describe('buildInnovationSummary', () => {
  it('detecta las áreas aisladas sin contar las iniciativas consigo misma', () => {
    const rows = [
      from('PMO', multiRow('r1', 'c8_areas_iniciativas', ['TECNOLOGIA'])),
      // COMERCIAL se marca a sí misma: no es trabajo entre áreas
      from('COMERCIAL', multiRow('r2', 'c8_areas_iniciativas', ['COMERCIAL'])),
      from('LEGAL', multiRow('r3', 'c8_areas_iniciativas', ['NINGUNA'])),
      from('TECNOLOGIA', multiRow('r4', 'c8_areas_iniciativas', ['NINGUNA'])),
      // la 8.1 no es obligatoria: quien la dejó vacía no cuenta como respondente
      from('LEGAL', multiRow('r5', 'c8_areas_iniciativas', [])),
    ];

    // 4 respondieron; 2 marcaron NINGUNA -> 50%.
    // Conectadas: PMO (origen) y TECNOLOGIA (socia) -> 2. Aisladas: COMERCIAL (solo su
    // auto-arista) y LEGAL, en el orden del catálogo. OTRA no es un área de la red.
    expect(buildInnovationSummary(rows, AREAS)).toEqual({
      respondents: 4,
      noneShare: 50,
      connectedAreas: 2,
      isolated: [
        { areaCode: 'COMERCIAL', areaName: 'Comercial' },
        { areaCode: 'LEGAL', areaName: 'Legal' },
      ],
    });
  });
});

describe('buildNetwork', () => {
  it('cuenta como respondentes a quienes dijeron con qué áreas interactúan', () => {
    const rows = [
      multiRow('r1', 'c1_areas_interaccion', ['TECNOLOGIA']),
      multiRow('r2', 'c1_areas_interaccion', ['PMO']),
      // r3 solo respondió la frecuencia
      optionRow('r3', 'c1_frecuencia', 'DIARIA'),
    ];
    expect(
      buildNetwork({ rows, areas: AREAS, options: OPTIONS }).respondents,
    ).toBe(2);
  });

  it('con cero respuestas devuelve la estructura completa en cero', () => {
    const network = buildNetwork({ rows: [], areas: AREAS, options: OPTIONS });

    expect(network.respondents).toBe(0);
    // las 4 áreas evaluables, sin OTRA, con el % en 0 y no en NaN
    expect(network.demand.map((row) => row.mentionShare)).toEqual([0, 0, 0, 0]);
    expect(network.importance).toEqual([]);
    expect(network.frequency.map((row) => row.label)).toEqual([
      'Diaria',
      'Varias veces por semana',
      'Semanal',
      'Mensual',
      'Esporádica',
    ]);
    expect(network.interactionTypes.map((row) => row.count)).toEqual([
      0, 0, 0, 0, 0,
    ]);
    expect(network.valueVsStrengthen).toEqual([]);
    expect(network.innovation).toEqual({
      respondents: 0,
      noneShare: 0,
      connectedAreas: 0,
      isolated: [
        { areaCode: 'PMO', areaName: 'PMO' },
        { areaCode: 'TECNOLOGIA', areaName: 'Tecnología' },
        { areaCode: 'COMERCIAL', areaName: 'Comercial' },
        { areaCode: 'LEGAL', areaName: 'Legal' },
      ],
    });
  });
});
