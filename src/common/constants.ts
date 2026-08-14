/** Centinela de `answers.target_area` para respuestas globales (no evaluadas por área). */
export const GLOBAL_AREA_CODE = '__GLOBAL__';

/** Código de área/opción de texto libre. No agrega en la matriz de relacionamiento. */
export const OTHER_AREA_CODE = 'OTRA';

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
 */
export const RESPONSE_TIME_SCORES: Record<string, number> = {
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
