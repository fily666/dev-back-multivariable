/** Centinela de `answers.target_area` para respuestas globales (no evaluadas por área). */
export const GLOBAL_AREA_CODE = '__GLOBAL__';

/** Código de área/opción de texto libre. No agrega en la matriz de relacionamiento. */
export const OTHER_AREA_CODE = 'OTRA';

/**
 * Niveles de cargo. Lista cerrada: se pide en la identificación junto con el área y se
 * guarda como código, para que los cortes del panel no dependan de cómo lo escriba cada
 * persona. Es la misma lista que el front recibe en `GET /survey/schema`.
 */
export const RESPONDENT_ROLES = [
  { value: 'DIRECTOR', label: 'Director' },
  { value: 'GERENTE', label: 'Gerente' },
  { value: 'HEAD', label: 'Head' },
  { value: 'COORDINADOR', label: 'Coordinador' },
  { value: 'LIDER', label: 'Líder' },
  { value: 'PROFESIONAL', label: 'Profesional' },
  { value: 'ANALISTA', label: 'Analista' },
] as const;

export const RESPONDENT_ROLE_VALUES: string[] = RESPONDENT_ROLES.map(
  (role) => role.value,
);

/** Etiqueta legible de un cargo. El código sin traducir no se muestra nunca. */
export const RESPONDENT_ROLE_LABELS: Record<string, string> =
  Object.fromEntries(RESPONDENT_ROLES.map((role) => [role.value, role.label]));

/** Longitud máxima del texto de una opción "Otra". */
export const OTHER_TEXT_MAX_LENGTH = 200;

/** Escala del instrumento: enteros de 0 a 10 inclusive. */
export const SCALE_MIN = 0;
export const SCALE_MAX = 10;

/** Umbrales del NPS: promotores 9-10, pasivos 7-8, detractores 0-6. */
export const NPS_PROMOTER_MIN = 9;
export const NPS_PASSIVE_MIN = 7;

/**
 * Scores de las opciones del tiempo de respuesta percibido (C5.1), normalizados a 0-100
 * para poder mezclarlos con las escalas en el Índice de Agilidad.
 *
 * Cumplir el ANS puntúa 80, el piso de "Fortaleza" en la semaforización: cumplir lo
 * pactado es lo esperado. "No conoce el ANS / No aplica" (NO_CONOCE_ANS) no puntúa a
 * propósito: no dice nada de la agilidad, e imputarle un valor movería el índice con una
 * opinión que nadie dio.
 */
export const RESPONSE_TIME_SCORES: Record<string, number> = {
  SUPERA_ANS: 100,
  CUMPLE_ANS: 80,
  CUMPLE_PARCIAL_ANS: 50,
  NO_CUMPLE_ANS: 0,
  // Tramos de horas que el instrumento usó hasta el 1-oct-2026. Se conservan para que las
  // respuestas ya enviadas no pierdan su mitad de tiempo en el IAG.
  MENOS_2H: 100,
  MISMO_DIA: 80,
  H24: 60,
  H48: 40,
  MAS_3_DIAS: 10,
};

/** Scores de frecuencia de interacción (C1.3), normalizados a 0-100. */
export const FREQUENCY_SCORES: Record<string, number> = {
  DIARIA: 100,
  VARIAS_SEMANA: 80,
  SEMANAL: 60,
  MENSUAL: 40,
  ESPORADICA: 20,
};

/** Número de tipos de interacción posibles (C1.4), denominador del score de diversidad. */
export const INTERACTION_TYPE_COUNT = 5;

/** Áreas con iniciativas conjuntas que se consideran "colaboración plena" en el IINN. */
export const INNOVATION_PARTNER_TARGET = 3;
