import type {
  OptionSource,
  QuestionType,
} from '../../generated/prisma/enums.ts';

export interface AreaDto {
  code: string;
  name: string;
  isEvaluable: boolean;
  /** Gestión a la que pertenece el subproceso. `null` solo en el centinela y en OTRA. */
  procesoCode: string | null;
}

export interface ProcesoDto {
  code: string;
  name: string;
}

export interface QuestionOptionDto {
  value: string;
  label: string;
  allowsText: boolean;
  exclusive: boolean;
  /**
   * Agrupación con la que se presenta la opción. Las preguntas de área la traen con la
   * gestión correspondiente, para que el front pinte los subprocesos agrupados sin
   * conocer el organigrama.
   */
  group: { code: string; label: string } | null;
}

export interface RespondentRoleDto {
  value: string;
  label: string;
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
  procesos: ProcesoDto[];
  roles: RespondentRoleDto[];
  components: ComponentDto[];
  settings: {
    maxAreasInteraccion: number;
  };
}

export type { OptionSource, QuestionType };
