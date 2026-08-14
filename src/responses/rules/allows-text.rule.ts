import { OTHER_TEXT_MAX_LENGTH } from '../../common/constants';
import type { Rule, RuleViolation } from './rule.types';

/**
 * Las opciones tipo "Otra: ____" exigen texto. Sin esto se pierde la respuesta: quedaría
 * un `OTRA` sin contenido que no dice nada en los reportes.
 */
export const allowsTextRule: Rule = ({ questions, answers }) => {
  const violations: RuleViolation[] = [];

  for (const answer of answers) {
    const question = questions.get(answer.questionCode);
    if (!question) continue;

    const selected =
      question.type === 'MULTI'
        ? (answer.valueOptions ?? [])
        : answer.valueOption
          ? [answer.valueOption]
          : [];

    const needsText = question.options.some(
      (option) => option.allowsText && selected.includes(option.value),
    );
    if (!needsText) continue;

    const text = answer.valueText?.trim() ?? '';
    if (text.length === 0) {
      violations.push({
        questionCode: answer.questionCode,
        message: 'Indique cuál al elegir esta opción.',
      });
    } else if (text.length > OTHER_TEXT_MAX_LENGTH) {
      violations.push({
        questionCode: answer.questionCode,
        message: `El texto no puede exceder ${OTHER_TEXT_MAX_LENGTH} caracteres.`,
      });
    }
  }

  return violations;
};
