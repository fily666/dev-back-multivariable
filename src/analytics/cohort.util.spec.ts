import { applyCohort, filterCohortRows } from './cohort.util';

describe('applyCohort', () => {
  it('oculta el dato cuando el corte no alcanza la cohorte mínima', () => {
    const result = applyCohort(3, 4, { imc: 82 });
    expect(result.data).toBeNull();
    expect(result.meta.insufficient).toBe(true);
  });

  it('muestra el dato cuando el corte iguala la cohorte mínima', () => {
    const result = applyCohort(4, 4, { imc: 82 });
    expect(result.data).toEqual({ imc: 82 });
    expect(result.meta.insufficient).toBe(false);
  });

  it('reporta el n real incluso cuando oculta el dato, para que el panel lo explique', () => {
    expect(applyCohort(1, 4, { imc: 99 }).meta.n).toBe(1);
  });

  it('oculta el dato con cero respuestas', () => {
    expect(applyCohort(0, 4, { imc: 0 }).data).toBeNull();
  });

  it('incluye el umbral en el meta para que el front no lo duplique', () => {
    expect(applyCohort(10, 4, {}).meta.minCohortSize).toBe(4);
  });
});

describe('filterCohortRows', () => {
  const rows = [
    { area: 'PMO', respondents: 8 },
    { area: 'TECNOLOGIA', respondents: 4 },
    { area: 'JURIDICA', respondents: 2 },
    { area: 'COMERCIAL', respondents: 0 },
  ];

  it('retira las filas por debajo del umbral aunque el total sí lo alcance', () => {
    const result = filterCohortRows(rows, 4, (row) => row.respondents);
    expect(result.rows.map((row) => row.area)).toEqual(['PMO', 'TECNOLOGIA']);
    expect(result.suppressed).toBe(2);
  });

  it('no retira nada cuando todas las filas alcanzan el umbral', () => {
    const result = filterCohortRows(rows, 0, (row) => row.respondents);
    expect(result.rows).toHaveLength(4);
    expect(result.suppressed).toBe(0);
  });
});
