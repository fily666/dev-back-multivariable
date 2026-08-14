import type { Rule, RuleViolation } from './rule.types';

/**
 * Una opción marcada como excluyente en el catálogo (p. ej. "Ninguna" en 8.1) no puede
 * convivir con otras selecciones.
 */
export const exclusiveOptionRule: Rule = ({ questions, answers }) => {
  const violations: RuleViolation[] = [];

  for (const answer of answers) {
    const question = questions.get(answer.questionCode);
    if (!question || question.type !== 'MULTI') continue;

    const selected = answer.valueOptions ?? [];
    if (selected.length < 2) continue;

    const exclusives = question.options
      .filter((option) => option.exclusive)
      .map((option) => option.value);

    const chosenExclusive = selected.filter((value) =>
      exclusives.includes(value),
    );
    if (chosenExclusive.length > 0) {
      const labels = question.options
        .filter((option) => chosenExclusive.includes(option.value))
        .map((option) => `"${option.label}"`)
        .join(', ');
      violations.push({
        questionCode: answer.questionCode,
        message: `${labels} no se puede combinar con otras opciones.`,
      });
    }
  }

  return violations;
};
