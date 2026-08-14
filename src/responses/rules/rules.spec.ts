import { GLOBAL_AREA_CODE } from '../../common/constants';
import { answer, context, question } from './rules.fixture';
import { findMissingAnswers } from './completeness.rule';
import {
  allowsTextRule,
  exclusiveOptionRule,
  multiSelectBoundsRule,
  ownAreaExclusionRule,
  perAreaSubsetRule,
  runRules,
  scaleRangeRule,
  singleSelectRule,
  textLengthRule,
} from './index';

describe('scaleRangeRule', () => {
  const q = question('c3_claridad', { type: 'SCALE_0_10' });

  it.each([0, 5, 10])('acepta el entero %i', (value) => {
    expect(
      scaleRangeRule(context([q], [answer(q.code, { valueNumber: value })])),
    ).toEqual([]);
  });

  it.each([-1, 11, 7.5])('rechaza %p', (value) => {
    expect(
      scaleRangeRule(context([q], [answer(q.code, { valueNumber: value })])),
    ).toHaveLength(1);
  });

  it('ignora una escala sin responder, que es asunto de la regla de completitud', () => {
    expect(scaleRangeRule(context([q], [answer(q.code)]))).toEqual([]);
  });
});

describe('singleSelectRule', () => {
  const q = question('c1_frecuencia', {
    type: 'SINGLE',
    options: [{ value: 'DIARIA' }, { value: 'SEMANAL' }],
  });

  it('acepta una opción del catálogo', () => {
    expect(
      singleSelectRule(
        context([q], [answer(q.code, { valueOption: 'DIARIA' })]),
      ),
    ).toEqual([]);
  });

  it('rechaza una opción inventada', () => {
    expect(
      singleSelectRule(
        context([q], [answer(q.code, { valueOption: 'CADA_LUNA_LLENA' })]),
      ),
    ).toHaveLength(1);
  });
});

describe('multiSelectBoundsRule', () => {
  const pivot = question('c1_areas_interaccion', {
    type: 'MULTI',
    minSelect: 1,
    maxSelect: 5,
    options: [
      { value: 'COMERCIAL' },
      { value: 'TECNOLOGIA' },
      { value: 'PMO' },
      { value: 'INNOVACION' },
      { value: 'JURIDICA' },
      { value: 'FINANCIERA' },
    ],
  });

  it('acepta exactamente cinco áreas', () => {
    const options = [
      'COMERCIAL',
      'TECNOLOGIA',
      'PMO',
      'INNOVACION',
      'JURIDICA',
    ];
    expect(
      multiSelectBoundsRule(
        context([pivot], [answer(pivot.code, { valueOptions: options })]),
      ),
    ).toEqual([]);
  });

  it('rechaza seis áreas, que es el límite que sostiene los 15 minutos', () => {
    const options = [
      'COMERCIAL',
      'TECNOLOGIA',
      'PMO',
      'INNOVACION',
      'JURIDICA',
      'FINANCIERA',
    ];
    const violations = multiSelectBoundsRule(
      context([pivot], [answer(pivot.code, { valueOptions: options })]),
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain('máximo 5');
  });

  it('rechaza una selección vacía cuando el mínimo es 1', () => {
    expect(
      multiSelectBoundsRule(
        context([pivot], [answer(pivot.code, { valueOptions: [] })]),
      ),
    ).toHaveLength(1);
  });

  it('rechaza opciones repetidas', () => {
    const violations = multiSelectBoundsRule(
      context([pivot], [answer(pivot.code, { valueOptions: ['PMO', 'PMO'] })]),
    );
    expect(violations.some((v) => v.message.includes('repetir'))).toBe(true);
  });

  it('rechaza opciones que no están en el catálogo', () => {
    const violations = multiSelectBoundsRule(
      context([pivot], [answer(pivot.code, { valueOptions: ['MARKETING'] })]),
    );
    expect(violations.some((v) => v.message.includes('no válidas'))).toBe(true);
  });
});

describe('exclusiveOptionRule', () => {
  const q = question('c8_areas_iniciativas', {
    type: 'MULTI',
    options: [
      { value: 'PMO' },
      { value: 'TECNOLOGIA' },
      { value: 'NINGUNA', label: 'Ninguna', exclusive: true },
    ],
  });

  it('acepta NINGUNA sola', () => {
    expect(
      exclusiveOptionRule(
        context([q], [answer(q.code, { valueOptions: ['NINGUNA'] })]),
      ),
    ).toEqual([]);
  });

  it('rechaza NINGUNA combinada con áreas', () => {
    const violations = exclusiveOptionRule(
      context([q], [answer(q.code, { valueOptions: ['NINGUNA', 'PMO'] })]),
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain('Ninguna');
  });

  it('acepta varias áreas sin la excluyente', () => {
    expect(
      exclusiveOptionRule(
        context([q], [answer(q.code, { valueOptions: ['PMO', 'TECNOLOGIA'] })]),
      ),
    ).toEqual([]);
  });
});

describe('allowsTextRule', () => {
  const single = question('c1_area_propia', {
    type: 'SINGLE',
    options: [{ value: 'PMO' }, { value: 'OTRA', allowsText: true }],
  });

  it('exige texto al elegir OTRA', () => {
    expect(
      allowsTextRule(
        context([single], [answer(single.code, { valueOption: 'OTRA' })]),
      ),
    ).toHaveLength(1);
  });

  it('acepta OTRA con texto', () => {
    expect(
      allowsTextRule(
        context(
          [single],
          [answer(single.code, { valueOption: 'OTRA', valueText: 'Compras' })],
        ),
      ),
    ).toEqual([]);
  });

  it('no exige texto en una opción normal', () => {
    expect(
      allowsTextRule(
        context([single], [answer(single.code, { valueOption: 'PMO' })]),
      ),
    ).toEqual([]);
  });

  it('rechaza un texto de OTRA que excede 200 caracteres', () => {
    const violations = allowsTextRule(
      context(
        [single],
        [
          answer(single.code, {
            valueOption: 'OTRA',
            valueText: 'x'.repeat(201),
          }),
        ],
      ),
    );
    expect(violations).toHaveLength(1);
  });
});

describe('textLengthRule', () => {
  const q = question('c10_cambio_unico', {
    type: 'TEXT',
    maxLength: 1000,
    required: false,
  });

  it('acepta un texto dentro del límite', () => {
    expect(
      textLengthRule(
        context([q], [answer(q.code, { valueText: 'x'.repeat(1000) })]),
      ),
    ).toEqual([]);
  });

  it('rechaza un texto que excede el límite del catálogo', () => {
    expect(
      textLengthRule(
        context([q], [answer(q.code, { valueText: 'x'.repeat(1001) })]),
      ),
    ).toHaveLength(1);
  });
});

describe('perAreaSubsetRule', () => {
  const perArea = question('c2_confianza', {
    type: 'MATRIX_AREA',
    perArea: true,
    componentId: 2,
  });
  const global = question('c3_claridad', { type: 'SCALE_0_10' });

  it('acepta una calificación sobre un área declarada en 1.2', () => {
    expect(
      perAreaSubsetRule(
        context(
          [perArea],
          [answer(perArea.code, { targetArea: 'PMO', valueNumber: 8 })],
          {
            evaluableAreas: ['PMO', 'TECNOLOGIA'],
          },
        ),
      ),
    ).toEqual([]);
  });

  it('rechaza calificar un área que el encuestado nunca seleccionó', () => {
    const violations = perAreaSubsetRule(
      context(
        [perArea],
        [answer(perArea.code, { targetArea: 'JURIDICA', valueNumber: 3 })],
        {
          evaluableAreas: ['PMO'],
        },
      ),
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain('JURIDICA');
  });

  it('rechaza una pregunta por área enviada como global', () => {
    expect(
      perAreaSubsetRule(
        context(
          [perArea],
          [
            answer(perArea.code, {
              targetArea: GLOBAL_AREA_CODE,
              valueNumber: 5,
            }),
          ],
          {
            evaluableAreas: ['PMO'],
          },
        ),
      ),
    ).toHaveLength(1);
  });

  it('rechaza una pregunta global enviada con área', () => {
    expect(
      perAreaSubsetRule(
        context(
          [global],
          [answer(global.code, { targetArea: 'PMO', valueNumber: 5 })],
        ),
      ),
    ).toHaveLength(1);
  });
});

describe('ownAreaExclusionRule', () => {
  const pivot = question('c1_areas_interaccion', { type: 'MULTI' });

  it('rechaza incluir el área propia entre las de interacción', () => {
    expect(
      ownAreaExclusionRule(
        context(
          [pivot],
          [answer(pivot.code, { valueOptions: ['PMO', 'TECNOLOGIA'] })],
          {
            ownArea: 'PMO',
          },
        ),
      ),
    ).toHaveLength(1);
  });

  it('acepta áreas distintas de la propia', () => {
    expect(
      ownAreaExclusionRule(
        context(
          [pivot],
          [answer(pivot.code, { valueOptions: ['TECNOLOGIA'] })],
          {
            ownArea: 'PMO',
          },
        ),
      ),
    ).toEqual([]);
  });

  it('no aplica cuando el área propia es OTRA, que no identifica un área del catálogo', () => {
    expect(
      ownAreaExclusionRule(
        context([pivot], [answer(pivot.code, { valueOptions: ['OTRA'] })], {
          ownArea: 'OTRA',
        }),
      ),
    ).toEqual([]);
  });
});

describe('runRules', () => {
  it('acumula violaciones de varias reglas a la vez', () => {
    const q = question('c2_confianza', { type: 'MATRIX_AREA', perArea: true });
    const violations = runRules(
      context(
        [q],
        [answer(q.code, { targetArea: 'JURIDICA', valueNumber: 42 })],
        {
          evaluableAreas: ['PMO'],
        },
      ),
    );
    // Fuera de rango y área no evaluable.
    expect(violations.length).toBeGreaterThanOrEqual(2);
  });
});

describe('findMissingAnswers', () => {
  const scale = question('c3_claridad', { type: 'SCALE_0_10', componentId: 3 });
  const perArea = question('c9_nps', {
    type: 'SCALE_0_10',
    perArea: true,
    componentId: 9,
  });
  const optional = question('c10_cambio_unico', {
    type: 'TEXT',
    required: false,
    componentId: 10,
  });

  it('reporta una obligatoria sin responder, con su componente', () => {
    expect(findMissingAnswers([scale], [], [])).toEqual([
      { questionCode: 'c3_claridad', componentId: 3 },
    ]);
  });

  it('no reporta las opcionales', () => {
    expect(findMissingAnswers([optional], [], [])).toEqual([]);
  });

  it('exige el NPS una vez por cada área evaluada', () => {
    const missing = findMissingAnswers(
      [perArea],
      [answer('c9_nps', { targetArea: 'PMO', valueNumber: 9 })],
      ['PMO', 'TECNOLOGIA'],
    );
    expect(missing).toEqual([
      { questionCode: 'c9_nps', componentId: 9, targetArea: 'TECNOLOGIA' },
    ]);
  });

  it('trata el cero como respondido, no como vacío', () => {
    expect(
      findMissingAnswers(
        [scale],
        [answer('c3_claridad', { valueNumber: 0 })],
        [],
      ),
    ).toEqual([]);
  });

  it('trata un texto en blanco como sin responder', () => {
    const required = question('c10_texto', { type: 'TEXT', componentId: 10 });
    expect(
      findMissingAnswers(
        [required],
        [answer('c10_texto', { valueText: '   ' })],
        [],
      ),
    ).toEqual([{ questionCode: 'c10_texto', componentId: 10 }]);
  });
});
