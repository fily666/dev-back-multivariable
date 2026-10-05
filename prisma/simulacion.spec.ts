import { ROLE_GROUPS } from '../src/common/constants';
import { AREAS, QUESTIONS } from './catalog';
import {
  INCOMPLETAS,
  TOTAL_SIMULADAS,
  generarRespuestasSimuladas,
  validarRespuesta,
} from './simulacion';

/**
 * Las respuestas simuladas tienen que ser respuestas que la API habría aceptado, y tienen
 * que dejarle al panel algo que mostrar con la cohorte mínima de 4.
 */
describe('respuestas simuladas', () => {
  const respuestas = generarRespuestasSimuladas();
  const completas = respuestas.filter((r) => r.status === 'COMPLETED');
  const borradores = respuestas.filter((r) => r.status === 'DRAFT');

  it(`genera ${TOTAL_SIMULADAS} respuestas, ${INCOMPLETAS} de ellas sin enviar`, () => {
    expect(respuestas).toHaveLength(TOTAL_SIMULADAS);
    expect(borradores).toHaveLength(INCOMPLETAS);
  });

  it('cada una pasa las reglas del instrumento, y las enviadas están completas', () => {
    const invalidas = respuestas
      .map((respuesta, i) => ({ i, infracciones: validarRespuesta(respuesta) }))
      .filter(({ infracciones }) => infracciones.length > 0);
    expect(invalidas).toEqual([]);
  });

  it('es reproducible: la misma semilla da las mismas respuestas', () => {
    expect(JSON.stringify(generarRespuestasSimuladas())).toBe(
      JSON.stringify(respuestas),
    );
  });

  it('responden desde subprocesos vigentes del catálogo', () => {
    const vigentes = new Set(AREAS.map((area) => area.code));
    expect(
      respuestas.filter((r) => r.ownArea !== null && !vigentes.has(r.ownArea)),
    ).toEqual([]);
  });

  it('no responde ninguna pregunta que no esté en el instrumento', () => {
    const vigentes = new Set(QUESTIONS.map((q) => q.code));
    const ajenas = respuestas
      .flatMap((r) => r.answers)
      .filter((a) => !vigentes.has(a.questionCode));
    expect(ajenas).toEqual([]);
  });

  describe('las incompletas', () => {
    it('se quedan antes del componente 10 y sin fecha de envío', () => {
      for (const borrador of borradores) {
        expect(borrador.lastStep).toBeLessThan(10);
        expect(borrador.submittedAt).toBeNull();
        expect(borrador.durationSeconds).toBeNull();
      }
    });

    it('se abandonan en distintos puntos, no todas en el mismo', () => {
      expect(new Set(borradores.map((b) => b.lastStep)).size).toBeGreaterThan(
        3,
      );
    });

    it('quien no guardó ningún paso no dejó identificación ni respuestas', () => {
      for (const borrador of borradores.filter((b) => b.lastStep === 0)) {
        expect(borrador).toMatchObject({
          ownArea: null,
          respondentRole: null,
          answers: [],
        });
      }
    });

    it('su última actividad es posterior a la apertura', () => {
      for (const borrador of borradores) {
        expect(borrador.updatedAt.getTime()).toBeGreaterThan(
          borrador.startedAt.getTime(),
        );
      }
    });
  });

  it('cada grupo de cargos alcanza la cohorte entre las enviadas, para que haya brecha jerárquica', () => {
    for (const grupo of ROLE_GROUPS) {
      const enGrupo = completas.filter((r) =>
        (grupo.roles as readonly string[]).includes(r.respondentRole ?? ''),
      );
      expect(enGrupo.length).toBeGreaterThanOrEqual(4);
    }
  });

  it('al menos una pareja de subprocesos alcanza la cohorte en el mapa', () => {
    const parejas = new Map<string, number>();
    for (const respuesta of completas) {
      const evaluadas = new Set(
        respuesta.answers
          .filter((a) => a.questionCode === 'c2_facilidad')
          .map((a) => a.targetArea),
      );
      for (const area of evaluadas) {
        const clave = `${respuesta.ownArea}→${area}`;
        parejas.set(clave, (parejas.get(clave) ?? 0) + 1);
      }
    }
    expect(Math.max(...parejas.values())).toBeGreaterThanOrEqual(4);
  });

  it('incluye encuestas a la carrera para la vista de calidad, y solo esas bajan de 5 minutos', () => {
    const rapidas = completas.filter((r) => (r.durationSeconds ?? 0) < 300);
    expect(rapidas).toHaveLength(2);
    expect(
      completas.every(
        (r) =>
          r.submittedAt!.getTime() - r.startedAt.getTime() ===
          r.durationSeconds! * 1000,
      ),
    ).toBe(true);
  });

  it('se abren y se envían en horario laboral de Bogotá, en días hábiles', () => {
    for (const { startedAt, submittedAt, status } of respuestas) {
      const momento = status === 'COMPLETED' ? submittedAt! : startedAt;
      const bogota = new Date(momento.getTime() - 5 * 3600 * 1000);
      expect(bogota.getUTCHours()).toBeGreaterThanOrEqual(8);
      expect(bogota.getUTCHours()).toBeLessThan(18);
      expect([0, 6]).not.toContain(bogota.getUTCDay());
    }
  });
});
