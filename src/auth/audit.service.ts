import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { Prisma } from '../generated/prisma/client.ts';

export type AuditAction =
  | 'LOGIN_OK'
  | 'LOGIN_FAIL'
  | 'LOGIN_RATE_LIMITED'
  | 'LOGOUT'
  | 'EXPORT_CSV'
  | 'EXPORT_XLSX'
  | 'WEIGHTS_UPDATE'
  | 'CAMPAIGN_CREATE'
  | 'CAMPAIGN_CLOSE'
  | 'THEME_UPDATE';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registra una acción administrativa. No propaga errores: una falla de auditoría no
   * debe tumbar la operación que el admin está haciendo, pero sí queda en el log.
   */
  async record(
    action: AuditAction,
    ipHash: string | null,
    detail?: Prisma.InputJsonObject,
  ): Promise<void> {
    try {
      await this.prisma.adminAuditLog.create({
        data: { action, ipHash, detail: detail ?? undefined },
      });
    } catch (error) {
      this.logger.warn(`No se pudo auditar ${action}: ${String(error)}`);
    }
  }

  /** Cuenta intentos de una acción por IP dentro de una ventana, para el rate limit. */
  async countRecent(
    action: AuditAction,
    ipHash: string,
    windowMinutes: number,
  ) {
    const since = new Date(Date.now() - windowMinutes * 60_000);
    return this.prisma.adminAuditLog.count({
      where: { action, ipHash, createdAt: { gte: since } },
    });
  }
}
