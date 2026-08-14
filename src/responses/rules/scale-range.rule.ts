import { SCALE_MAX, SCALE_MIN } from '../../common/constants';
import type { Rule, RuleViolation } from './rule.types';

/** Las escalas del instrumento son enteros de 0 a 10 inclusive. */
export const scaleRangeRule: Rule = ({ questions, answers }) => {
  const violations: RuleViolation[] = [];

  for (const answer of answers) {
    const question = questions.get(answer.questionCode);
    if (!question) continue;
    if (question.type !== 'SCALE_0_10' && question.type !== 'MATRIX_AREA')
      continue;
    if (answer.valueNumber == null) continue;

    const value = answer.valueNumber;
    if (!Number.isInteger(value) || value < SCALE_MIN || value > SCALE_MAX) {
      violations.push({
        questionCode: answer.questionCode,
        targetArea: answer.targetArea,
        message: `El valor debe ser un número entero entre ${SCALE_MIN} y ${SCALE_MAX}.`,
      });
    }
  }

  return violations;
};
