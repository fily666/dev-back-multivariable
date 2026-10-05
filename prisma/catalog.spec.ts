import { RESPONSE_TIME_SCORES } from '../src/common/constants';
import { RESPONSE_TIME_ORDER } from '../src/analytics/kpis/distribution.kpi';
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

  it('cada escala trae sus dos anclas, cortas para caber a los extremos de la regla', () => {
    const escalas = QUESTIONS.filter(
      (q) => q.type === 'SCALE_0_10' || q.type === 'MATRIX_AREA',
    );
    const sinAnclas = escalas
      .filter((q) => !q.scaleMinLabel?.trim() || !q.scaleMaxLabel?.trim())
      .map((q) => q.code);
    expect(sinAnclas).toEqual([]);

    const largas = escalas
      .flatMap((q) => [q.scaleMinLabel ?? '', q.scaleMaxLabel ?? ''])
      .filter((ancla) => ancla.length > 28);
    expect(largas).toEqual([]);

    const repetidas = escalas
      .filter((q) => q.scaleMinLabel === q.scaleMaxLabel)
      .map((q) => q.code);
    expect(repetidas).toEqual([]);
  });

  it('las anclas genéricas del PDF no vuelven a colarse en las escalas', () => {
    const genericas = QUESTIONS.filter(
      (q) =>
        (q.type === 'SCALE_0_10' || q.type === 'MATRIX_AREA') &&
        (/^muy deficiente$/i.test(q.scaleMinLabel ?? '') ||
          /^excelente$/i.test(q.scaleMaxLabel ?? '') ||
          /significa/i.test(q.helpText ?? '')),
    ).map((q) => q.code);
    expect(genericas).toEqual([]);
  });

  it('las preguntas que no son escala no declaran anclas', () => {
    const conAnclas = QUESTIONS.filter(
      (q) =>
        q.type !== 'SCALE_0_10' &&
        q.type !== 'MATRIX_AREA' &&
        (q.scaleMinLabel || q.scaleMaxLabel),
    ).map((q) => q.code);
    expect(conAnclas).toEqual([]);
  });

  it('el NPS conserva las anclas estándar de probabilidad', () => {
    expect(QUESTIONS.find((q) => q.code === 'c9_nps')).toMatchObject({
      scaleMinLabel: 'Nada probable',
      scaleMaxLabel: 'Totalmente probable',
    });
  });

  it('el tiempo de respuesta pregunta por el ANS y cada opción tiene su lugar en el panel', () => {
    const valores = QUESTIONS.find(
      (q) => q.code === 'c5_tiempo_respuesta',
    )?.options?.map((o) => o.value);

    // La distribución del panel sigue el mismo orden que ve el encuestado.
    expect(valores).toEqual([...RESPONSE_TIME_ORDER]);

    // Todas puntúan en el IAG menos "No conoce el ANS / No aplica".
    const sinScore = (valores ?? []).filter(
      (valor) => !(valor in RESPONSE_TIME_SCORES),
    );
    expect(sinScore).toEqual(['NO_CONOCE_ANS']);
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

  it('cubre las 16 gestiones del organigrama con sus 53 subprocesos', () => {
    const porGestion = Object.fromEntries(
      PROCESOS.map((p) => [
        p.code,
        AREAS.filter((a) => a.procesoCode === p.code).length,
      ]),
    );
    // La distribución que LinkTIC definió el 5-oct-2026, en su mismo orden.
    expect(porGestion).toEqual({
      TALENTO_HUMANO: 9,
      SOSTENIBILIDAD_REPUTACION: 3,
      COMERCIAL: 1,
      LA_FABRICA: 6,
      MARKETING: 6,
      TECNOLOGIA: 2,
      MEJORAMIENTO_CONTINUO: 1,
      ADMINISTRATIVO_COMPRAS: 3,
      CONTABLE_TRIBUTARIA: 2,
      FINANCIERA: 1,
      JURIDICA: 4,
      CIBERSEGURIDAD: 3,
      PREVENTA: 1,
      PROYECTOS: 3,
      COMUNICACIONES: 4,
      PLANEACION_ESTRATEGICA: 4,
    });
    expect(Object.keys(porGestion)).toEqual(PROCESOS.map((p) => p.code));
    expect(AREAS).toHaveLength(53);
  });

  it('ordena las áreas en una sola secuencia, agrupadas por gestión', () => {
    expect(AREAS.map((a) => a.sortOrder)).toEqual(
      AREAS.map((_, index) => index + 1),
    );
    const ordenGestiones = AREAS.map((a) => a.procesoCode).filter(
      (code, index, all) => code !== all[index - 1],
    );
    expect(ordenGestiones).toEqual(PROCESOS.map((p) => p.code));
  });

  it('una gestión y un subproceso solo comparten código si comparten nombre', () => {
    // El panel traduce códigos con un solo diccionario de áreas y gestiones: si un código
    // nombrara dos cosas distintas, una de las dos se mostraría con el nombre equivocado.
    const gestiones = new Map(PROCESOS.map((p) => [p.code, p.name]));
    const choques = AREAS.filter(
      (a) => gestiones.has(a.code) && gestiones.get(a.code) !== a.name,
    ).map((a) => a.code);
    expect(choques).toEqual([]);
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
