import { ConfigService } from '@nestjs/config';
import { SurveyService } from './survey.service';
import type { PrismaService } from '../database/prisma.service';

/**
 * Regresión de un bug encontrado solo al correr el flujo real contra la base de datos.
 *
 * `getSchema` resolvía las opciones de catálogo (áreas, procesos) pero `getQuestionIndex`
 * —que es de donde el motor de reglas saca las opciones válidas— devolvía únicamente las
 * estáticas de `question_options`. El resultado: el servidor ofrecía "Innovación" como
 * opción y luego rechazaba esa misma respuesta con "La opción no es válida".
 *
 * Los tests de las reglas no lo detectaron porque sus fixtures traen las opciones ya
 * puestas: el fallo estaba en quién alimenta al motor, no en el motor.
 */
describe('SurveyService.getQuestionIndex', () => {
  const areas = [
    { code: 'COMERCIAL', name: 'Comercial' },
    { code: 'PMO', name: 'PMO' },
  ];
  const procesos = [{ code: 'PROYECTOS', name: 'Gestión de proyectos' }];

  function build() {
    const prisma = {
      question: {
        findMany: jest.fn().mockResolvedValue([
          {
            code: 'c8_areas_iniciativas',
            optionSource: 'AREAS',
            options: [
              {
                id: 1n,
                questionCode: 'c8_areas_iniciativas',
                value: 'NINGUNA',
                label: 'Ninguna',
                allowsText: true,
                exclusive: false,
                sortOrder: 1,
              },
            ],
          },
          {
            code: 'c10_proceso_reprocesos',
            optionSource: 'PROCESOS',
            options: [],
          },
          {
            code: 'c1_frecuencia',
            optionSource: 'STATIC',
            options: [
              {
                id: 2n,
                questionCode: 'c1_frecuencia',
                value: 'DIARIA',
                label: 'Diaria',
                allowsText: false,
                exclusive: false,
                sortOrder: 1,
              },
            ],
          },
        ]),
      },
      area: { findMany: jest.fn().mockResolvedValue(areas) },
      proceso: { findMany: jest.fn().mockResolvedValue(procesos) },
    } as unknown as PrismaService;

    const config = { get: () => undefined } as unknown as ConfigService;
    return new SurveyService(prisma, config);
  }

  it('resuelve las áreas como opciones válidas de una pregunta AREAS', async () => {
    const index = await build().getQuestionIndex();
    const values = index
      .get('c8_areas_iniciativas')!
      .options.map((o) => o.value);

    expect(values).toContain('COMERCIAL');
    expect(values).toContain('PMO');
  });

  it('conserva además las opciones estáticas, como "Otra"', async () => {
    const index = await build().getQuestionIndex();
    const ninguna = index
      .get('c8_areas_iniciativas')!
      .options.find((o) => o.value === 'NINGUNA');

    expect(ninguna).toMatchObject({ allowsText: true });
  });

  it('resuelve los procesos en una pregunta PROCESOS', async () => {
    const index = await build().getQuestionIndex();
    expect(
      index.get('c10_proceso_reprocesos')!.options.map((o) => o.value),
    ).toEqual(['PROYECTOS']);
  });

  it('no inventa opciones en una pregunta estática', async () => {
    const index = await build().getQuestionIndex();
    expect(index.get('c1_frecuencia')!.options.map((o) => o.value)).toEqual([
      'DIARIA',
    ]);
  });

  it('excluye el centinela global del catálogo de áreas', async () => {
    // El mock se tipa para poder inspeccionar el filtro que recibió la consulta.
    type AreaQuery = {
      where: { active?: boolean; isEvaluable?: boolean; code?: unknown };
    };
    const areaFindMany = jest.fn((_args: AreaQuery) => Promise.resolve([]));

    const prisma = {
      question: { findMany: jest.fn().mockResolvedValue([]) },
      area: { findMany: areaFindMany },
      proceso: { findMany: jest.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;

    const service = new SurveyService(prisma, {
      get: () => undefined,
    } as unknown as ConfigService);
    await service.getQuestionIndex();

    // El centinela nunca es una opción para el encuestado: es un detalle de almacenamiento.
    const { where } = areaFindMany.mock.calls[0][0];
    expect(where.active).toBe(true);
    expect(where.isEvaluable).toBe(true);
    expect(where.code).toBeDefined();
  });
});
