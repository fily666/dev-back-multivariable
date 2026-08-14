import type { Rule, RuleViolation } from './rule.types';

/** Aplica min_select / max_select del catálogo a las preguntas de selección múltiple. */
export const multiSelectBoundsRule: Rule = ({ questions, answers }) => {
  const violations: RuleViolation[] = [];

  for (const answer of answers) {
    const question = questions.get(answer.questionCode);
    if (!question || question.type !== 'MULTI') continue;

    const selected = answer.valueOptions ?? [];

    if (new Set(selected).size !== selected.length) {
      violations.push({
        questionCode: answer.questionCode,
        message: 'No se pueden repetir opciones.',
      });
    }

    const unknown = selected.filter(
      (value) => !question.options.some((option) => option.value === value),
    );
    if (unknown.length > 0) {
      violations.push({
        questionCode: answer.questionCode,
        message: `Opciones no válidas: ${unknown.join(', ')}.`,
      });
    }

    if (question.minSelect != null && selected.length < question.minSelect) {
      violations.push({
        questionCode: answer.questionCode,
        message: `Seleccione al menos ${question.minSelect} ${
          question.minSelect === 1 ? 'opción' : 'opciones'
        }.`,
      });
    }

    if (question.maxSelect != null && selected.length > question.maxSelect) {
      violations.push({
        questionCode: answer.questionCode,
        message: `Seleccione máximo ${question.maxSelect} opciones.`,
      });
    }
  }

  return violations;
};
