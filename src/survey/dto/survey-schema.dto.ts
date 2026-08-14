import type {
  OptionSource,
  QuestionType,
} from '../../generated/prisma/enums.ts';

export interface AreaDto {
  code: string;
  name: string;
  isEvaluable: boolean;
}

export interface QuestionOptionDto {
  value: string;
  label: string;
  allowsText: boolean;
  exclusive: boolean;
}

export interface QuestionDto {
  code: string;
  componentId: number;
  label: string;
  helpText: string | null;
  type: QuestionType;
  required: boolean;
  minSelect: number | null;
  maxSelect: number | null;
  perArea: boolean;
  maxLength: number | null;
  /** Opciones ya resueltas: catálogo (áreas/procesos) + extras estáticas. */
  options: QuestionOptionDto[];
}

export interface ComponentDto {
  id: number;
  code: string;
  title: string;
  intro: string | null;
  questions: QuestionDto[];
}

export interface CampaignDto {
  id: string;
  name: string;
  isOpen: boolean;
}

export interface SurveySchemaDto {
  campaign: CampaignDto;
  areas: AreaDto[];
  components: ComponentDto[];
  settings: {
    maxAreasInteraccion: number;
    requireIdentity: boolean;
  };
}

export type { OptionSource, QuestionType };
