import { GLOBAL_AREA_CODE } from '../../common/constants';
import type { CatalogQuestion, IncomingAnswer } from './rule.types';

export interface MissingItem {
  questionCode: string;
  componentId: number;
  targetArea?: string;
}

/**
 * Verifica que estén todas las respuestas obligatorias antes de cerrar la encuesta.
 * Devuelve la lista de faltantes con su componente, para que el front pueda llevar al
 * encuestado directo al paso incompleto en vez de mostrarle un error genérico.
 *
 * Las preguntas `perArea` se exigen una vez por cada área evaluada.
 */
export function findMissingAnswers(
  questions: CatalogQuestion[],
  answers: IncomingAnswer[],
  evaluableAreas: string[],
): MissingItem[] {
  const answered = new Set(
    answers
      .filter((answer) => hasValue(answer))
      .map((answer) =>
        key(answer.questionCode, answer.targetArea ?? GLOBAL_AREA_CODE),
      ),
  );

  const missing: MissingItem[] = [];

  for (const question of questions) {
    if (!question.required || !question.active) continue;

    const targets = question.perArea ? evaluableAreas : [GLOBAL_AREA_CODE];
    for (const targetArea of targets) {
      if (!answered.has(key(question.code, targetArea))) {
        missing.push({
          questionCode: question.code,
          componentId: question.componentId,
          ...(question.perArea ? { targetArea } : {}),
        });
      }
    }
  }

  return missing;
}

function key(questionCode: string, targetArea: string): string {
  return `${questionCode}__${targetArea}`;
}

function hasValue(answer: IncomingAnswer): boolean {
  return (
    answer.valueNumber != null ||
    answer.valueOption != null ||
    (answer.valueOptions?.length ?? 0) > 0 ||
    (answer.valueText?.trim().length ?? 0) > 0
  );
}
