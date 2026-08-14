import { OTHER_AREA_CODE } from '../../common/constants';
import type { Rule, RuleViolation } from './rule.types';

const PIVOT_QUESTION = 'c1_areas_interaccion';

/**
 * El área propia no puede figurar entre las áreas con las que se interactúa: el mapa de
 * relacionamiento mide relaciones entre áreas distintas, y un auto-bucle distorsionaría
 * tanto el grafo como los promedios de C2.
 *
 * `OTRA` se exceptúa porque no identifica un área concreta del catálogo.
 */
export const ownAreaExclusionRule: Rule = ({ answers, ownArea }) => {
  const violations: RuleViolation[] = [];
  if (!ownArea || ownArea === OTHER_AREA_CODE) return violations;

  const pivot = answers.find(
    (answer) => answer.questionCode === PIVOT_QUESTION,
  );
  if (!pivot) return violations;

  if ((pivot.valueOptions ?? []).includes(ownArea)) {
    violations.push({
      questionCode: PIVOT_QUESTION,
      message:
        'No incluya su propia área entre las áreas con las que interactúa.',
    });
  }

  return violations;
};
