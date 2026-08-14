import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

export const API_PREFIX = 'api/v1';

export function configureApp(
  app: Awaited<ReturnType<typeof NestFactory.create>>,
) {
  const config = app.get(ConfigService);

  app.setGlobalPrefix(API_PREFIX);
  app.use(helmet());
  app.use(cookieParser());

  // `origin` explícito y no '*': la sesión del admin viaja en cookie, y los navegadores
  // rechazan credenciales contra un comodín.
  app.enableCors({
    origin: (config.get<string>('CORS_ORIGINS') ?? '')
      .split(',')
      .filter(Boolean),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  return app;
}

async function bootstrap() {
  const app = configureApp(await NestFactory.create(AppModule));
  const port = app.get(ConfigService).get<number>('PORT', 3001);
  await app.listen(port);
  new Logger('Bootstrap').log(
    `API escuchando en http://localhost:${port}/${API_PREFIX}`,
  );
}

// `api/index.ts` importa `configureApp` y `API_PREFIX` de este módulo, y ese import ejecuta
// el cuerpo del archivo. Sin esta guarda, cada instancia fría en Vercel levantaba una
// SEGUNDA app de Nest y llamaba a `listen()` dentro del lambda: doble arranque de módulos y
// un segundo pool de Prisma contra el pooler, sumados a la latencia del primer request.
// Fuera de Vercel (`npm run start:dev`, `start:prod`) nada cambia.
if (!process.env.VERCEL) {
  void bootstrap();
}
