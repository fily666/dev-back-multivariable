import {
  AREAS,
  COMPONENTS,
  INDICATOR_THRESHOLDS,
  INDICATOR_WEIGHTS,
  PROCESOS,
  QUESTIONS,
} from './catalog';

/**
 * Guarda de regresión sobre la transcripción del instrumento en PDF.
 * Los conteos por componente vienen del documento, no del código.
 */
describe('catálogo del instrumento', () => {
  it('no tiene códigos de pregunta duplicados', () => {
    const codes = QUESTIONS.map((q) => q.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('todas las preguntas apuntan a un componente existente', () => {
    const ids = new Set(COMPONENTS.map((c) => c.id));
    const huerfanas = QUESTIONS.filter((q) => !ids.has(q.componentId)).map(
      (q) => q.code,
    );
    expect(huerfanas).toEqual([]);
  });

  it('tiene el número de preguntas que declara el PDF en cada componente', () => {
    const esperado: Record<number, number> = {
      1: 4,
      2: 5,
      3: 5,
      4: 5,
      5: 5,
      6: 5,
      7: 5,
      8: 5,
      9: 2,
      10: 5,
    };
    const real = Object.fromEntries(
      COMPONENTS.map((c) => [
        c.id,
        QUESTIONS.filter((q) => q.componentId === c.id).length,
      ]),
    );
    expect(real).toEqual(esperado);
  });

  it('las preguntas de selección tienen opciones estáticas o de catálogo', () => {
    const sinOpciones = QUESTIONS.filter(
      (q) =>
        (q.type === 'SINGLE' || q.type === 'MULTI') &&
        !q.options?.length &&
        (!q.optionSource || q.optionSource === 'STATIC'),
    ).map((q) => q.code);
    expect(sinOpciones).toEqual([]);
  });

  it('las escalas no declaran opciones ni límites de selección', () => {
    const malFormadas = QUESTIONS.filter(
      (q) =>
        (q.type === 'SCALE_0_10' || q.type === 'MATRIX_AREA') &&
        (q.options?.length || q.minSelect || q.maxSelect),
    ).map((q) => q.code);
    expect(malFormadas).toEqual([]);
  });

  it('solo el componente 2 y el NPS se evalúan por área', () => {
    const perArea = QUESTIONS.filter((q) => q.perArea)
      .map((q) => q.code)
      .sort();
    expect(perArea).toEqual(
      [
        'c2_comunicacion',
        'c2_confianza',
        'c2_cumplimiento',
        'c2_facilidad',
        'c2_valor',
        'c9_nps',
      ].sort(),
    );
  });

  it('limita a cinco las áreas de interacción, que es lo que sostiene los 15 minutos', () => {
    const pivote = QUESTIONS.find((q) => q.code === 'c1_areas_interaccion');
    expect(pivote).toMatchObject({ type: 'MULTI', minSelect: 1, maxSelect: 5 });
  });

  it('marca NINGUNA como opción excluyente en las iniciativas de innovación', () => {
    const ninguna = QUESTIONS.find(
      (q) => q.code === 'c8_areas_iniciativas',
    )?.options?.find((o) => o.value === 'NINGUNA');
    expect(ninguna?.exclusive).toBe(true);
  });

  it('los pesos del IMC suman 1', () => {
    const suma = INDICATOR_WEIGHTS.reduce((total, w) => total + w.weight, 0);
    expect(suma).toBeCloseTo(1, 3);
  });

  it('los umbrales cubren 0 a 100 sin huecos ni solapes', () => {
    const orden = [...INDICATOR_THRESHOLDS].sort(
      (a, b) => a.minValue - b.minValue,
    );
    expect(orden[0].minValue).toBe(0);
    expect(orden[orden.length - 1].maxValue).toBe(100);
    orden.slice(0, -1).forEach((banda, i) => {
      expect(orden[i + 1].minValue).toBeGreaterThan(banda.maxValue);
      expect(orden[i + 1].minValue - banda.maxValue).toBeCloseTo(0.01, 4);
    });
  });

  it('cada área cuelga de una gestión existente', () => {
    const gestiones = new Set(PROCESOS.map((p) => p.code));
    const huerfanas = AREAS.filter((a) => !gestiones.has(a.procesoCode)).map(
      (a) => a.code,
    );
    expect(huerfanas).toEqual([]);
  });

  it('no repite códigos de área ni de gestión', () => {
    expect(new Set(AREAS.map((a) => a.code)).size).toBe(AREAS.length);
    expect(new Set(PROCESOS.map((p) => p.code)).size).toBe(PROCESOS.length);
  });

  it('cubre las 12 gestiones del organigrama con sus 24 subprocesos', () => {
    const porGestion = Object.fromEntries(
      PROCESOS.map((p) => [
        p.code,
        AREAS.filter((a) => a.procesoCode === p.code).length,
      ]),
    );
    expect(porGestion).toEqual({
      GERENCIA: 5,
      TALENTO_HUMANO: 3,
      MEJORAMIENTO_CONTINUO: 1,
      SERVICIOS: 1,
      COMERCIAL: 2,
      PROYECTOS: 1,
      CONTRATACION_PUBLICA: 1,
      FABRICA_SOFTWARE: 2,
      MARKETING: 2,
      ADMIN_FIN_CONTABLE: 3,
      TI: 2,
      LEGAL: 1,
    });
  });

  it('el área propia no es una pregunta: se pide en la identificación', () => {
    expect(QUESTIONS.some((q) => q.code === 'c1_area_propia')).toBe(false);
  });

  it('la relación principal se elige entre las áreas del catálogo', () => {
    expect(QUESTIONS.find((q) => q.code === 'c1_area_principal')).toMatchObject(
      {
        componentId: 1,
        type: 'SINGLE',
        optionSource: 'AREAS',
      },
    );
  });

  it('cada componente conserva el texto introductorio del instrumento', () => {
    const sinIntro = COMPONENTS.filter((c) => !c.intro?.trim()).map(
      (c) => c.id,
    );
    expect(sinIntro).toEqual([]);
  });
});
