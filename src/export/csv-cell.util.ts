const FORMULA_TRIGGERS = ['=', '+', '-', '@', '\t', '\r'];

/**
 * Neutraliza la inyección de fórmulas en hojas de cálculo.
 *
 * El instrumento recoge texto libre que escribieron terceros. Una celda que empieza con
 * `=` o `@` la evalúa Excel al abrir el archivo, y eso convierte una respuesta abierta en
 * un vector de ejecución contra la máquina de quien descarga el reporte. El apóstrofo
 * inicial fuerza a Excel a tratarla como texto.
 */
export function neutralizeFormula(value: string): string {
  if (value.length === 0) return value;
  return FORMULA_TRIGGERS.some((trigger) => value.startsWith(trigger))
    ? `'${value}`
    : value;
}

/** Aplica la neutralización solo a valores de texto; deja pasar números y fechas. */
export function safeCell(
  value: string | number | Date | null | undefined,
): string | number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.toISOString();
  return neutralizeFormula(value);
}
