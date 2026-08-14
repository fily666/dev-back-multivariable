import type { Prisma } from '../../generated/prisma/client.ts';

export type CatalogQuestion = Prisma.QuestionModel & {
  options: Prisma.QuestionOptionModel[];
};

/** Una respuesta entrante, antes de persistirse. */
export interface IncomingAnswer {
  questionCode: string;
  targetArea?: string;
  valueNumber?: number | null;
  valueOption?: string | null;
  valueOptions?: string[] | null;
  valueText?: string | null;
}

export interface RuleViolation {
  questionCode: string;
  targetArea?: string;
  message: string;
}

/**
 * Contexto que toda regla recibe. `evaluableAreas` son las áreas que el encuestado
 * seleccionó en 1.2 — la pregunta pivote que define qué se evalúa en C2 y C9.
 */
export interface RuleContext {
  questions: Map<string, CatalogQuestion>;
  answers: IncomingAnswer[];
  ownArea: string | null;
  evaluableAreas: string[];
  maxAreasInteraccion: number;
}

export type Rule = (context: RuleContext) => RuleViolation[];
