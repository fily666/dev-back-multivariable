import type { Rule, RuleViolation } from './rule.types';

/** Respeta el `max_length` del catálogo en las preguntas de texto abierto. */
export const textLengthRule: Rule = ({ questions, answers }) => {
  const violations: RuleViolation[] = [];

  for (const answer of answers) {
    const question = questions.get(answer.questionCode);
    if (!question || question.type !== 'TEXT') continue;
    if (question.maxLength == null || answer.valueText == null) continue;

    if (answer.valueText.length > question.maxLength) {
      violations.push({
        questionCode: answer.questionCode,
        message: `El texto no puede exceder ${question.maxLength} caracteres.`,
      });
    }
  }

  return violations;
};
