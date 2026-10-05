import { filterCohortRows } from '../cohort.util';
import { QUESTION_CODES_BY_INDICATOR } from '../indicators/question-codes.constant';
import { scaleBattery, scaleRow } from '../indicators/indicators.fixture';
import type { RawAnswerRow } from '../indicators/indicator.types';
import { buildRoleIndices } from './roles.kpi';

/** Los pesos sembrados del IMC. */
const WEIGHTS = new Map([
  ['IREL', 0.2],
  ['ICOM', 0.15],
  ['ISI', 0.15],
  ['IAG', 0.15],
  ['IINT', 0.15],
  ['ICOL', 0.1],
  ['IINN', 0.1],
]);

/**
 * Una respuesta que califica los 5 ítems del C3 con la misma nota y, si se indica, una
 * área en el NPS. Con un solo índice con dato, el IMC reescala los pesos y vale lo mismo
 * que el ICOM, lo que simplifica la aritmética.
 */
function respondent(
  responseId: string,
  role: string | null | undefined,
  icom: number,
  nps?: number,
): RawAnswerRow[] {
  const rows = scaleBattery(responseId, QUESTION_CODES_BY_INDICATOR.ICOM, [
    icom,
    icom,
    icom,
    icom,
    icom,
  ]);
  if (nps !== undefined) rows.push(scaleRow(responseId, 'c9_nps', nps, 'PMO'));
  return role === undefined
    ? rows
    : rows.map((row) => ({ ...row, respondentRole: role }));
}

describe('buildRoleIndices', () => {
  it('calcula los índices de cada cargo en el orden declarado, no en el de llegada', () => {
    const rows = [
      ...respondent('r1', 'ANALISTA', 4, 3),
      ...respondent('r2', 'ANALISTA', 6, 8),
      ...respondent('r3', 'DIRECTOR', 8, 10),
    ];
    const { roles } = buildRoleIndices(rows, WEIGHTS);

    // solo los cargos con respuestas; DIRECTOR va antes que ANALISTA en RESPONDENT_ROLES
    expect(roles.map((row) => row.key)).toEqual(['DIRECTOR', 'ANALISTA']);
    // DIRECTOR: ICOM 8 -> 80; IMC = ICOM; NPS: 1 promotor de 1 -> 100
    expect(roles[0]).toMatchObject({
      key: 'DIRECTOR',
      label: 'Director',
      respondents: 1,
      imc: 80,
      nps: 100,
    });
    // ANALISTA: ICOM (4×5 + 6×5) / 10 = 5.0 -> 50; IMC = 50
    // NPS: 3 es detractor y 8 pasivo -> (0 − 1) / 2 × 100 = −50
    expect(roles[1]).toMatchObject({
      label: 'Analista',
      respondents: 2,
      imc: 50,
      nps: -50,
    });
    // los 10 indicadores, con null donde no hay dato
    expect(Object.keys(roles[1].indicators)).toHaveLength(10);
    expect(roles[1].indicators.ICOM).toBe(50);
    expect(roles[1].indicators.IREL).toBeNull();
  });

  it('agrupa los cargos en su nivel, en el orden de los grupos', () => {
    const rows = [
      ...respondent('r1', 'ANALISTA', 4),
      ...respondent('r2', 'DIRECTOR', 8),
      ...respondent('r3', 'GERENTE', 6),
    ];
    const { groups } = buildRoleIndices(rows, WEIGHTS);

    // MANDOS_MEDIOS no tiene a nadie y no sale
    expect(groups.map((row) => row.key)).toEqual(['DIRECCION', 'EQUIPOS']);
    // DIRECCION = DIRECTOR + GERENTE: ICOM (8×5 + 6×5) / 10 = 7.0 -> 70
    expect(groups[0]).toMatchObject({
      label: 'Dirección',
      respondents: 2,
      roles: ['DIRECTOR', 'GERENTE', 'HEAD'],
      imc: 70,
    });
    expect(groups[0].indicators.ICOM).toBe(70);
    // EQUIPOS = solo el analista: 40
    expect(groups[1]).toMatchObject({ respondents: 1, imc: 40 });
  });

  it('deja fuera las respuestas sin cargo y los cargos fuera de la lista', () => {
    const rows = [
      ...respondent('r1', null, 10),
      // las filas del fixture no traen cargo
      ...respondent('r2', undefined, 0),
      ...respondent('r3', 'PASANTE', 2),
      ...respondent('r4', 'DIRECTOR', 5),
    ];
    const { roles, groups } = buildRoleIndices(rows, WEIGHTS);

    // solo cuenta r4: ICOM 50, sin que el 10, el 0 ni el 2 lo muevan
    expect(roles).toHaveLength(1);
    expect(roles[0]).toMatchObject({
      key: 'DIRECTOR',
      respondents: 1,
      imc: 50,
    });
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ key: 'DIRECCION', respondents: 1 });
  });

  it('con la cohorte, suprime cargos chicos y conserva el nivel que los suma', () => {
    // DIRECTOR 1, GERENTE 2, HEAD 1, COORDINADOR 1, ANALISTA 4; nadie de LIDER ni PROFESIONAL
    const roleOf = [
      'DIRECTOR',
      'GERENTE',
      'GERENTE',
      'HEAD',
      'COORDINADOR',
      'ANALISTA',
      'ANALISTA',
      'ANALISTA',
      'ANALISTA',
    ];
    const rows = roleOf.flatMap((role, index) =>
      respondent(`r${index + 1}`, role, 7),
    );
    const { roles, groups } = buildRoleIndices(rows, WEIGHTS);

    // Con cohorte 4 solo ANALISTA pasa. Se suprimen 4 cargos, no 6: LIDER y PROFESIONAL no
    // tienen respuestas, así que no hay nada que suprimir.
    const keptRoles = filterCohortRows(roles, 4, (row) => row.respondents);
    expect(keptRoles.rows.map((row) => row.key)).toEqual(['ANALISTA']);
    expect(keptRoles.suppressed).toBe(4);

    // DIRECCION = 1 + 2 + 1 = 4 y pasa; MANDOS_MEDIOS = 1 y se suprime; EQUIPOS = 4 y pasa
    const keptGroups = filterCohortRows(groups, 4, (row) => row.respondents);
    expect(keptGroups.rows.map((row) => row.key)).toEqual([
      'DIRECCION',
      'EQUIPOS',
    ]);
    expect(keptGroups.suppressed).toBe(1);
  });

  it('sin respuestas no devuelve filas', () => {
    expect(buildRoleIndices([], WEIGHTS)).toEqual({ roles: [], groups: [] });
  });
});
