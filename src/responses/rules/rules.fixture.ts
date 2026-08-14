import { GLOBAL_AREA_CODE } from '../../common/constants';
import type {
  CatalogQuestion,
  IncomingAnswer,
  RuleContext,
} from './rule.types';

type QuestionOverrides = Partial<Omit<CatalogQuestion, 'options'>> & {
  options?: {
    value: string;
    label?: string;
    allowsText?: boolean;
    exclusive?: boolean;
  }[];
};

/** Construye una pregunta de catálogo con los defaults del instrumento. */
export function question(
  code: string,
  overrides: QuestionOverrides = {},
): CatalogQuestion {
  const { options = [], ...rest } = overrides;
  return {
    code,
    componentId: 1,
    label: code,
    helpText: null,
    type: 'SCALE_0_10',
    required: true,
    minSelect: null,
    maxSelect: null,
    perArea: false,
    optionSource: 'STATIC',
    maxLength: null,
    sortOrder: 1,
    active: true,
    ...rest,
    options: options.map((option, index) => ({
      id: BigInt(index + 1),
      questionCode: code,
      value: option.value,
      label: option.label ?? option.value,
      allowsText: option.allowsText ?? false,
      exclusive: option.exclusive ?? false,
      sortOrder: index + 1,
    })),
  };
}

export function answer(
  questionCode: string,
  overrides: Partial<IncomingAnswer> = {},
): IncomingAnswer {
  return {
    questionCode,
    targetArea: GLOBAL_AREA_CODE,
    valueNumber: null,
    valueOption: null,
    valueOptions: [],
    valueText: null,
    ...overrides,
  };
}

export function context(
  questions: CatalogQuestion[],
  answers: IncomingAnswer[],
  overrides: Partial<
    Pick<RuleContext, 'ownArea' | 'evaluableAreas' | 'maxAreasInteraccion'>
  > = {},
): RuleContext {
  return {
    questions: new Map(questions.map((q) => [q.code, q])),
    answers,
    ownArea: null,
    evaluableAreas: [],
    maxAreasInteraccion: 5,
    ...overrides,
  };
}
