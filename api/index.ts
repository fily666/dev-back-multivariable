/**
 * Punto de entrada de la API cuando corre en Vercel.
 *
 * En Vercel no hay un proceso persistente: cada request puede caer en una instancia nueva.
 * La app de Nest se construye una sola vez por instancia y se guarda en `ready`, porque
 * bootstrapear Nest en cada invocación sumaría el arranque completo (módulos + pool de
 * Prisma) a la latencia de cada llamada.
 *
 * `src/main.ts` sigue siendo el entrypoint para desarrollo local (`npm run start:dev`);
 * aquí se reutiliza su `configureApp` para no tener dos configuraciones de helmet, CORS,
 * cookies y validación que puedan divergir.
 */
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import type { Request, Response } from 'express';
import { AppModule } from '../src/app.module';
import { API_PREFIX, configureApp } from '../src/main';

/** Instancia de express compartida: es la que Vercel invoca en cada request. */
const server = express();

let ready: Promise<void> | null = null;

async function bootstrap(): Promise<void> {
  const app = configureApp(
    await NestFactory.create(AppModule, new ExpressAdapter(server)),
  );
  // `init` y no `listen`: el servidor HTTP lo provee Vercel. Solo hace falta que Nest
  // quede montado sobre `server`.
  await app.init();
}

export default async function handler(
  req: Request,
  res: Response,
): Promise<void> {
  ready ??= bootstrap();
  await ready;

  // Express llama a este callback cuando ninguna ruta coincide. Se responde en JSON para
  // que un 404 de la API no devuelva el HTML por defecto de express.
  server(req, res, () => {
    res.status(404).json({
      statusCode: 404,
      message: `Ruta no encontrada. Las rutas de la API viven bajo /${API_PREFIX}.`,
    });
  });
}
