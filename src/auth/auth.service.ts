import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { CookieOptions } from 'express';
import { hashWithSalt, secretsMatch } from '../common/utils/hash.util';
import { AuditService } from './audit.service';

export interface AdminJwtPayload {
  sub: 'admin';
  role: 'admin';
}

/** Valor por defecto del token, tal como lo pidió LinkTIC para el arranque. */
const DEFAULT_TOKEN = 'Admin123!@';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  onModuleInit() {
    if (this.config.get<string>('ADMIN_ACCESS_TOKEN') === DEFAULT_TOKEN) {
      this.logger.warn(
        'ADMIN_ACCESS_TOKEN sigue siendo el valor inicial. Rótelo por una cadena ' +
          'aleatoria larga antes de exponer datos reales.',
      );
    }
  }

  /**
   * Valida el token de acceso y devuelve un JWT de sesión.
   *
   * El token compartido no da trazabilidad por persona ni revocación individual; el JWT
   * es lo que el guard valida, así que migrar a cuentas por usuario más adelante no
   * obliga a tocar los controladores.
   */
  async login(candidate: string, ip: string | undefined) {
    const ipHash = this.hashIp(ip);
    await this.assertNotRateLimited(ipHash);

    const expected = this.config.getOrThrow<string>('ADMIN_ACCESS_TOKEN');
    if (!secretsMatch(candidate, expected)) {
      await this.audit.record('LOGIN_FAIL', ipHash);
      throw new UnauthorizedException('Token de acceso incorrecto.');
    }

    await this.audit.record('LOGIN_OK', ipHash);
    const payload: AdminJwtPayload = { sub: 'admin', role: 'admin' };
    return {
      token: await this.jwt.signAsync(payload),
      expiresIn: this.config.get<string>('JWT_EXPIRES_IN', '8h'),
    };
  }

  async logout(ip: string | undefined) {
    await this.audit.record('LOGOUT', this.hashIp(ip));
  }

  get cookieName(): string {
    return this.config.get<string>('COOKIE_NAME', 'linktic_admin_session');
  }

  /** Opciones de la cookie de sesión. `httpOnly` para que JavaScript no pueda leerla. */
  cookieOptions(): CookieOptions {
    // `VERCEL` además de NODE_ENV: cualquier despliegue sirve solo por HTTPS, y basta con
    // que alguien deje NODE_ENV=development entre las variables del proyecto para que la
    // cookie de sesión del admin salga sin `Secure` y viaje en claro. La bandera no debe
    // depender de una variable que se copia a mano.
    const isDeployed =
      this.config.get<string>('NODE_ENV') === 'production' ||
      this.config.get<string>('VERCEL') === '1';
    const domain = this.config.get<string>('COOKIE_DOMAIN');
    return {
      httpOnly: true,
      secure: isDeployed,
      // 'lax' y no 'none': el navegador nunca llama a esta API desde otro sitio. El front
      // la expone bajo su propio dominio con el rewrite de `next.config.ts`, así que la
      // cookie es first-party y 'lax' la protege de CSRF sin estorbar.
      sameSite: 'lax',
      path: '/',
      ...(domain ? { domain } : {}),
    };
  }

  hashIp(ip: string | undefined): string | null {
    if (!ip) return null;
    return hashWithSalt(ip, this.config.getOrThrow<string>('HASH_SALT'));
  }

  /**
   * Rate limit respaldado en `admin_audit_log`. Se usa esa tabla en vez de un contador
   * aparte porque cada intento ya se audita: una sola fuente de verdad, y los límites
   * quedan configurables por entorno sin tocar código.
   */
  private async assertNotRateLimited(ipHash: string | null) {
    if (!ipHash) return;

    const limit = Number(this.config.get<string>('LOGIN_RATE_LIMIT', '5'));
    const windowMinutes = Number(
      this.config.get<string>('LOGIN_RATE_WINDOW_MINUTES', '15'),
    );

    const failures = await this.audit.countRecent(
      'LOGIN_FAIL',
      ipHash,
      windowMinutes,
    );
    if (failures >= limit) {
      await this.audit.record('LOGIN_RATE_LIMITED', ipHash, { failures });
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Demasiados intentos fallidos. Espere ${windowMinutes} minutos.`,
          retryAfterSeconds: windowMinutes * 60,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
