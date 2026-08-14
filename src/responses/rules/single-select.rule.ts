import type { Rule, RuleViolation } from './rule.types';

/** La opción elegida en una pregunta de selección única debe existir en el catálogo. */
export const singleSelectRule: Rule = ({ questions, answers }) => {
  const violations: RuleViolation[] = [];

  for (const answer of answers) {
    const question = questions.get(answer.questionCode);
    if (!question || question.type !== 'SINGLE') continue;
    if (answer.valueOption == null) continue;

    const exists = question.options.some(
      (option) => option.value === answer.valueOption,
    );
    if (!exists) {
      violations.push({
        questionCode: answer.questionCode,
        message: `La opción "${answer.valueOption}" no es válida.`,
      });
    }
  }

  return violations;
};
