import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { AdminGuard } from './guards/admin.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /**
   * Cambia el token por una cookie de sesión.
   *
   * Doble límite a propósito: el `Throttle` corta ráfagas rápidas, y el rate limit del
   * servicio (respaldado en la auditoría) corta intentos sostenidos de fuerza bruta.
   */
  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { token, expiresIn } = await this.auth.login(dto.token, request.ip);
    response.cookie(this.auth.cookieName, token, this.auth.cookieOptions());
    return { authenticated: true, expiresIn };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.auth.logout(request.ip);
    response.clearCookie(this.auth.cookieName, this.auth.cookieOptions());
    return { authenticated: false };
  }

  /** El front lo usa para saber si la sesión sigue viva antes de pintar el panel. */
  @Get('me')
  @UseGuards(AdminGuard)
  me() {
    return { authenticated: true, role: 'admin' as const };
  }
}
