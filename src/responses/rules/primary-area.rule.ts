import type { Rule, RuleViolation } from './rule.types';

const PRIMARY_AREA_QUESTION = 'c1_area_principal';

/**
 * El área con la que más se relaciona tiene que estar entre las que el encuestado
 * declaró en 1.1. Sin esta regla se podría marcar como principal un área que no se
 * evalúa en ningún componente, y esa marca quedaría colgada: pesaría en el mapa de
 * relacionamiento sin ninguna calificación detrás.
 */
export const primaryAreaRule: Rule = ({ answers, evaluableAreas }) => {
  const violations: RuleViolation[] = [];

  const primary = answers.find(
    (answer) => answer.questionCode === PRIMARY_AREA_QUESTION,
  );
  if (!primary?.valueOption) return violations;

  if (!evaluableAreas.includes(primary.valueOption)) {
    violations.push({
      questionCode: PRIMARY_AREA_QUESTION,
      message:
        'Marque como principal una de las áreas que seleccionó como de interacción frecuente.',
    });
  }

  return violations;
};
