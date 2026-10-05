import { ROLE_GROUPS } from '../src/common/constants';
import { AREAS } from './catalog';
import {
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

  it(`genera ${TOTAL_SIMULADAS} respuestas`, () => {
    expect(respuestas).toHaveLength(TOTAL_SIMULADAS);
  });

  it('cada una pasa las reglas del instrumento y está completa', () => {
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
    expect(respuestas.filter((r) => !vigentes.has(r.ownArea))).toEqual([]);
  });

  it('cada grupo de cargos alcanza la cohorte, para que haya brecha jerárquica', () => {
    for (const grupo of ROLE_GROUPS) {
      const enGrupo = respuestas.filter((r) =>
        (grupo.roles as readonly string[]).includes(r.respondentRole),
      );
      expect(enGrupo.length).toBeGreaterThanOrEqual(4);
    }
  });

  it('al menos una pareja de subprocesos alcanza la cohorte en el mapa', () => {
    const parejas = new Map<string, number>();
    for (const respuesta of respuestas) {
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
    const rapidas = respuestas.filter((r) => r.durationSeconds < 300);
    expect(rapidas).toHaveLength(2);
    expect(
      respuestas.every(
        (r) =>
          r.submittedAt.getTime() - r.startedAt.getTime() ===
          r.durationSeconds * 1000,
      ),
    ).toBe(true);
  });

  it('se envían en horario laboral de Bogotá, en días hábiles', () => {
    for (const { submittedAt } of respuestas) {
      const bogota = new Date(submittedAt.getTime() - 5 * 3600 * 1000);
      expect(bogota.getUTCHours()).toBeGreaterThanOrEqual(8);
      expect(bogota.getUTCHours()).toBeLessThan(18);
      expect([0, 6]).not.toContain(bogota.getUTCDay());
    }
  });
});
