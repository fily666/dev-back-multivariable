/**
 * Limpia texto libre antes de persistirlo: quita etiquetas, colapsa espacios y recorta.
 * El front escapa al renderizar, pero no se confía en el cliente y el texto también
 * viaja a exportaciones CSV/XLSX que se abren en otras herramientas.
 */
export function sanitizeText(
  value: string | null | undefined,
  maxLength: number,
): string | null {
  if (value == null) return null;
  const clean = value
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return clean.length === 0 ? null : clean.slice(0, maxLength);
}

const COMBINING_MARKS = /[\u0300-\u036f]/g;

/**
 * Normaliza un valor de texto libre de "Otra" para poder agruparlo en los reportes:
 * mayúsculas, sin tildes y sin espacios redundantes.
 */
export function normalizeOtherLabel(value: string): string {
  return value
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}
