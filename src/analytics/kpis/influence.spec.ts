import { GLOBAL_AREA_CODE, OTHER_AREA_CODE } from '../../common/constants';
import type { RawAnswerRow } from '../indicators/indicator.types';
import {
  buildInfluence,
  strengthThresholds,
  type InfluenceArea,
} from './influence.kpi';

const AREAS: InfluenceArea[] = [
  { code: 'PMO', name: 'PMO', groupCode: 'G_PROY', groupName: 'Proyectos' },
  {
    code: 'CALIDAD',
    name: 'Calidad',
    groupCode: 'G_PROY',
    groupName: 'Proyectos',
  },
  {
    code: 'TEC',
    name: 'Tecnología',
    groupCode: 'G_TEC',
    groupName: 'Tecnología',
  },
  {
    code: 'COM',
    name: 'Comercial',
    groupCode: 'G_COM',
    groupName: 'Comercial',
  },
  {
    code: 'FIN',
    name: 'Financiera',
    groupCode: 'G_ADM',
    groupName: 'Administrativa',
  },
];

/** Una persona de `ownArea` califica a `targetArea` con la misma nota en los cinco aspectos. */
function c2(
  responseId: string,
  ownArea: string,
  targetArea: string,
  value = 8,
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

function frequency(
  responseId: string,
  ownArea: string,
  value: string,
): RawAnswerRow {
  return {
    responseId,
    ownArea,
    targetArea: GLOBAL_AREA_CODE,
    questionCode: 'c1_frecuencia',
    valueNumber: null,
    valueOption: value,
    valueOptions: [],
  };
}

describe('strengthThresholds', () => {
  it('parte los pesos en tercios', () => {
    expect(strengthThresholds([10, 20, 30, 40, 50, 60])).toEqual({
      media: 30,
      fuerte: 50,
    });
  });

  it('no inventa diferencias cuando todas las relaciones pesan igual', () => {
    expect(strengthThresholds([40, 40, 40])).toBeNull();
    expect(strengthThresholds([])).toBeNull();
  });
});

describe('buildInfluence', () => {
  it('la evaluada mueve a la evaluadora, no al revés', () => {
    // Alguien de PMO califica a Tecnología: PMO depende de lo que Tecnología le entrega.
    const { areas } = buildInfluence(c2('r1', 'PMO', 'TEC'), AREAS);

    expect(areas.edges).toEqual([
      expect.objectContaining({
        from: 'TEC',
        to: 'PMO',
        respondents: 1,
        irel: 80,
      }),
    ]);
    const tec = areas.nodes.find((node) => node.code === 'TEC');
    const pmo = areas.nodes.find((node) => node.code === 'PMO');
    expect(tec).toMatchObject({ motricidad: 2, dependencia: 0, clients: 1 });
    expect(pmo).toMatchObject({ motricidad: 0, dependencia: 2, providers: 1 });
  });

  it('da la fuerza por tercios del peso: personas por frecuencia', () => {
    const rows = [
      // TEC → PMO: dos personas a diario (peso 200).
      ...c2('r1', 'PMO', 'TEC'),
      frequency('r1', 'PMO', 'DIARIA'),
      ...c2('r2', 'PMO', 'TEC'),
      frequency('r2', 'PMO', 'DIARIA'),
      // COM → FIN: una persona semanal (peso 60).
      ...c2('r3', 'FIN', 'COM'),
      frequency('r3', 'FIN', 'SEMANAL'),
      // FIN → COM: una persona esporádica (peso 20).
      ...c2('r4', 'COM', 'FIN'),
      frequency('r4', 'COM', 'ESPORADICA'),
    ];
    const { areas } = buildInfluence(rows, AREAS);
    const strength = (from: string, to: string) =>
      areas.edges.find((edge) => edge.from === from && edge.to === to)
        ?.strength;

    expect(strength('TEC', 'PMO')).toBe(3);
    expect(strength('COM', 'FIN')).toBe(2);
    expect(strength('FIN', 'COM')).toBe(1);
    expect(areas.edges[0]).toMatchObject({ from: 'TEC', weight: 200 });
  });

  it('clasifica cada nodo por las medias de motricidad y dependencia', () => {
    // Tecnología provee a tres áreas y no depende de nadie: motriz. PMO depende de dos y no
    // provee: dependiente. Comercial provee a PMO y depende de Tecnología: de enlace.
    const rows = [
      ...c2('r1', 'PMO', 'TEC'),
      ...c2('r1', 'PMO', 'COM'),
      ...c2('r2', 'COM', 'TEC'),
      ...c2('r3', 'FIN', 'TEC'),
    ];
    const { areas } = buildInfluence(rows, AREAS);
    const zone = (code: string) =>
      areas.nodes.find((node) => node.code === code)?.zone;

    // Todas pesan igual (sin frecuencia): fuerza 2 cada una, total 8 entre 4 nodos.
    expect(areas.mean).toBe(2);
    expect(zone('TEC')).toBe('MOTRIZ');
    expect(zone('COM')).toBe('ENLACE');
    expect(zone('PMO')).toBe('DEPENDIENTE');
    expect(zone('FIN')).toBe('DEPENDIENTE');
    // Ordenados por zona: primero las motrices.
    expect(areas.nodes.map((node) => node.code)).toEqual([
      'TEC',
      'COM',
      'PMO',
      'FIN',
    ]);
  });

  it('suma la motricidad igual que la dependencia: las dos medias coinciden', () => {
    const rows = [
      ...c2('r1', 'PMO', 'TEC'),
      ...c2('r2', 'COM', 'TEC'),
      ...c2('r2', 'COM', 'FIN'),
    ];
    const { areas } = buildInfluence(rows, AREAS);
    const moves = areas.nodes.reduce((sum, node) => sum + node.motricidad, 0);
    const moved = areas.nodes.reduce((sum, node) => sum + node.dependencia, 0);
    expect(moves).toBe(moved);
  });

  it('agrupa por gestión, cuenta a cada persona una vez y aparta las relaciones internas', () => {
    const rows = [
      // r1, de Tecnología, califica a dos áreas de Proyectos: un solo par gestión-gestión.
      ...c2('r1', 'TEC', 'PMO', 6),
      ...c2('r1', 'TEC', 'CALIDAD', 8),
      // r2, de PMO, califica a Calidad: las dos son de Proyectos.
      ...c2('r2', 'PMO', 'CALIDAD'),
    ];
    const { gestiones } = buildInfluence(rows, AREAS);

    expect(gestiones.edges).toEqual([
      expect.objectContaining({
        from: 'G_PROY',
        to: 'G_TEC',
        respondents: 1,
        irel: 70,
      }),
    ]);
    expect(gestiones.internalPairs).toBe(1);
    expect(gestiones.nodes.map((node) => node.name).sort()).toEqual([
      'Proyectos',
      'Tecnología',
    ]);
    expect(gestiones.nodes[0].groupCode).toBeNull();
  });

  it('lleva en cada área el nombre de su gestión', () => {
    const { areas } = buildInfluence(c2('r1', 'PMO', 'TEC'), AREAS);
    expect(areas.nodes.find((node) => node.code === 'PMO')).toMatchObject({
      groupCode: 'G_PROY',
      groupName: 'Proyectos',
    });
  });

  it('calcula el IREL que cada nodo recibe y el que otorga, con quiénes lo sostienen', () => {
    const rows = [
      ...c2('r1', 'PMO', 'TEC', 9),
      ...c2('r2', 'PMO', 'TEC', 7),
      ...c2('r2', 'PMO', 'COM', 3),
    ];
    const { areas } = buildInfluence(rows, AREAS);
    const tec = areas.nodes.find((node) => node.code === 'TEC');
    const pmo = areas.nodes.find((node) => node.code === 'PMO');

    expect(tec).toMatchObject({
      irelReceived: 80,
      receivedFrom: 2,
      irelGranted: null,
      grantedBy: 0,
    });
    expect(pmo?.grantedBy).toBe(2);
    expect(pmo?.irelGranted).not.toBeNull();
  });

  it('deja fuera OTRA y las preguntas globales, que no son un área del catálogo', () => {
    const rows = [
      ...c2('r1', 'PMO', OTHER_AREA_CODE),
      ...c2('r2', OTHER_AREA_CODE, 'TEC'),
      ...c2('r3', 'PMO', GLOBAL_AREA_CODE),
    ];
    const { areas, gestiones } = buildInfluence(rows, AREAS);
    expect(areas.edges).toHaveLength(0);
    expect(areas.nodes).toHaveLength(0);
    expect(gestiones.edges).toHaveLength(0);
  });

  it('ignora áreas que no están en el catálogo activo', () => {
    const { areas } = buildInfluence(c2('r1', 'PMO', 'INACTIVA'), AREAS);
    expect(areas.edges).toHaveLength(0);
  });
});
