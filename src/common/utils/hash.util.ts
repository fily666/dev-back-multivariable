import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** SHA-256 con sal. Usado para IPs y user agents: nunca se persisten en claro. */
export function hashWithSalt(value: string, salt: string): string {
  return createHash('sha256').update(`${salt}:${value}`).digest('hex');
}

/**
 * Comparación de tiempo constante entre dos secretos.
 *
 * Se hashea antes de comparar para normalizar la longitud a 32 bytes: `timingSafeEqual`
 * lanza si los buffers difieren en tamaño, y ese throw filtraría la longitud del token
 * real al atacante.
 */
export function secretsMatch(candidate: string, expected: string): boolean {
  const a = createHash('sha256').update(candidate).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

/** Token opaco para retomar un borrador sin autenticación. */
export function generateDraftToken(): string {
  return randomBytes(32).toString('base64url');
}
