import { HttpException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuditService } from './audit.service';
import { secretsMatch } from '../common/utils/hash.util';

const ENV: Record<string, string> = {
  ADMIN_ACCESS_TOKEN: 'Admin123!@',
  JWT_SECRET: 'x'.repeat(64),
  JWT_EXPIRES_IN: '8h',
  HASH_SALT: 'sal-de-prueba',
  LOGIN_RATE_LIMIT: '5',
  LOGIN_RATE_WINDOW_MINUTES: '15',
  NODE_ENV: 'test',
};

function build(failures = 0) {
  const config = {
    get: (key: string, fallback?: string) => ENV[key] ?? fallback,
    getOrThrow: (key: string) => {
      const value = ENV[key];
      if (value == null) throw new Error(`falta ${key}`);
      return value;
    },
  } as unknown as ConfigService;

  const record = jest.fn().mockResolvedValue(undefined);
  const audit = {
    record,
    countRecent: jest.fn().mockResolvedValue(failures),
  } as unknown as AuditService;

  const jwt = {
    signAsync: jest.fn().mockResolvedValue('jwt-firmado'),
  } as unknown as JwtService;

  return { service: new AuthService(config, jwt, audit), record, jwt };
}

describe('AuthService.login', () => {
  it('acepta el token correcto y firma un JWT', async () => {
    const { service, record } = build();
    await expect(
      service.login('Admin123!@', '10.0.0.1'),
    ).resolves.toMatchObject({
      token: 'jwt-firmado',
    });
    expect(record).toHaveBeenCalledWith('LOGIN_OK', expect.any(String));
  });

  it('rechaza un token incorrecto de la misma longitud', async () => {
    const { service, record } = build();
    await expect(service.login('Admin123!X', '10.0.0.1')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(record).toHaveBeenCalledWith('LOGIN_FAIL', expect.any(String));
  });

  it('rechaza un token de longitud distinta sin lanzar por tamaño de buffer', async () => {
    const { service } = build();
    await expect(service.login('a', '10.0.0.1')).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(service.login('x'.repeat(500), '10.0.0.1')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rechaza un token vacío', async () => {
    const { service } = build();
    await expect(service.login('', '10.0.0.1')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('bloquea con 429 tras alcanzar el límite de intentos fallidos', async () => {
    const { service } = build(5);
    await expect(service.login('Admin123!@', '10.0.0.1')).rejects.toThrow(
      HttpException,
    );
  });

  it('no aplica rate limit cuando no hay IP que atribuir', async () => {
    const { service } = build(99);
    await expect(service.login('Admin123!@', undefined)).resolves.toMatchObject(
      {
        token: 'jwt-firmado',
      },
    );
  });
});

describe('AuthService.cookieOptions', () => {
  it('marca la cookie httpOnly para que JavaScript no la pueda leer', () => {
    const { service } = build();
    expect(service.cookieOptions()).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    });
  });

  it('no exige Secure fuera de producción, para poder probar por HTTP', () => {
    const { service } = build();
    expect(service.cookieOptions().secure).toBe(false);
  });
});

describe('secretsMatch', () => {
  it('compara por igualdad exacta', () => {
    expect(secretsMatch('Admin123!@', 'Admin123!@')).toBe(true);
    expect(secretsMatch('Admin123!@', 'admin123!@')).toBe(false);
  });

  it('tolera longitudes distintas sin lanzar, porque hashea antes de comparar', () => {
    expect(() => secretsMatch('a', 'x'.repeat(1000))).not.toThrow();
    expect(secretsMatch('a', 'x'.repeat(1000))).toBe(false);
  });
});
