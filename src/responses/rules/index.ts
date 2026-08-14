import { allowsTextRule } from './allows-text.rule';
import { exclusiveOptionRule } from './exclusive-option.rule';
import { multiSelectBoundsRule } from './multi-select-bounds.rule';
import { ownAreaExclusionRule } from './own-area-exclusion.rule';
import { perAreaSubsetRule } from './per-area-subset.rule';
import { scaleRangeRule } from './scale-range.rule';
import { singleSelectRule } from './single-select.rule';
import { textLengthRule } from './text-length.rule';
import type { Rule, RuleContext, RuleViolation } from './rule.types';

/**
 * Reglas que se aplican al guardar cada paso. Todas leen del catálogo, así que añadir una
 * pregunta al instrumento no obliga a tocar código de validación.
 */
export const STEP_RULES: Rule[] = [
  scaleRangeRule,
  singleSelectRule,
  multiSelectBoundsRule,
  exclusiveOptionRule,
  allowsTextRule,
  textLengthRule,
  perAreaSubsetRule,
  ownAreaExclusionRule,
];

export function runRules(
  context: RuleContext,
  rules: Rule[] = STEP_RULES,
): RuleViolation[] {
  return rules.flatMap((rule) => rule(context));
}

export * from './rule.types';
export {
  allowsTextRule,
  exclusiveOptionRule,
  multiSelectBoundsRule,
  ownAreaExclusionRule,
  perAreaSubsetRule,
  scaleRangeRule,
  singleSelectRule,
  textLengthRule,
};
