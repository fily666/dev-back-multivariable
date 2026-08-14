import { GLOBAL_AREA_CODE } from '../../common/constants';
import type { RawAnswerRow } from './indicator.types';

let sequence = 0;

/** Fila de escala 0-10. */
export function scaleRow(
  responseId: string,
  questionCode: string,
  valueNumber: number | null,
  targetArea = GLOBAL_AREA_CODE,
): RawAnswerRow {
  return {
    responseId,
    ownArea: 'PMO',
    targetArea,
    questionCode,
    valueNumber,
    valueOption: null,
    valueOptions: [],
  };
}

/** Fila de selección única. */
export function optionRow(
  responseId: string,
  questionCode: string,
  valueOption: string,
): RawAnswerRow {
  return {
    responseId,
    ownArea: 'PMO',
    targetArea: GLOBAL_AREA_CODE,
    questionCode,
    valueNumber: null,
    valueOption,
    valueOptions: [],
  };
}

/** Fila de selección múltiple. */
export function multiRow(
  responseId: string,
  questionCode: string,
  valueOptions: string[],
): RawAnswerRow {
  return {
    responseId,
    ownArea: 'PMO',
    targetArea: GLOBAL_AREA_CODE,
    questionCode,
    valueNumber: null,
    valueOption: null,
    valueOptions,
  };
}

/** Reparte una lista de valores entre las preguntas dadas, en una sola respuesta. */
export function scaleBattery(
  responseId: string,
  questionCodes: readonly string[],
  values: (number | null)[],
): RawAnswerRow[] {
  return questionCodes.map((code, index) =>
    scaleRow(responseId, code, values[index] ?? null),
  );
}

export function nextResponseId(): string {
  sequence += 1;
  return `r${sequence}`;
}
