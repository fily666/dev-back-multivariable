import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import type { AdminJwtPayload } from '../auth.service';

/** Lee el JWT de la cookie httpOnly. Nunca del header ni de la URL. */
/** `Request.cookies` es `any` en los tipos de express; se estrecha aquí una sola vez. */
function extractCookie(request: Request, name: string): string | null {
  const cookies = request.cookies as Record<string, string> | undefined;
  return cookies?.[name] ?? null;
}

@Injectable()
export class JwtCookieStrategy extends PassportStrategy(Strategy, 'admin-jwt') {
  constructor(config: ConfigService) {
    const cookieName = config.get<string>(
      'COOKIE_NAME',
      'linktic_admin_session',
    );
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => extractCookie(request, cookieName),
      ]),
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
      algorithms: ['HS256'],
    });
  }

  validate(payload: AdminJwtPayload): AdminJwtPayload {
    return payload;
  }
}
