import { GLOBAL_AREA_CODE } from '../../common/constants';
import type { Rule, RuleViolation } from './rule.types';

/**
 * Las respuestas por área (C2 y el NPS) solo se aceptan para áreas que el encuestado
 * declaró en 1.2. Y a la inversa: una pregunta global no puede llegar con un área.
 *
 * Sin esta regla un cliente podría inyectar calificaciones sobre áreas que el encuestado
 * nunca evaluó, contaminando la matriz de relacionamiento.
 */
export const perAreaSubsetRule: Rule = ({
  questions,
  answers,
  evaluableAreas,
}) => {
  const violations: RuleViolation[] = [];

  for (const answer of answers) {
    const question = questions.get(answer.questionCode);
    if (!question) continue;

    const targetArea = answer.targetArea ?? GLOBAL_AREA_CODE;

    if (question.perArea) {
      if (targetArea === GLOBAL_AREA_CODE) {
        violations.push({
          questionCode: answer.questionCode,
          message: 'Esta pregunta se responde por área evaluada.',
        });
      } else if (!evaluableAreas.includes(targetArea)) {
        violations.push({
          questionCode: answer.questionCode,
          targetArea,
          message: `El área "${targetArea}" no está entre las que seleccionó como de interacción frecuente.`,
        });
      }
    } else if (targetArea !== GLOBAL_AREA_CODE) {
      violations.push({
        questionCode: answer.questionCode,
        targetArea,
        message: 'Esta pregunta no se responde por área.',
      });
    }
  }

  return violations;
};
