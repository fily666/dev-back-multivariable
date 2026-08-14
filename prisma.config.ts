import 'dotenv/config';
import type { PrismaConfig } from 'prisma';
import { env } from 'prisma/config';

export default {
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // El CLI usa la conexion en modo SESION: `migrate` toma locks que el pooler en modo
    // transaccion no conserva entre sentencias, y la migracion se queda colgada.
    // El runtime de la app no pasa por aqui: usa DATABASE_URL (pooler) en prisma.service.ts.
    url: env('DIRECT_URL'),
  },
} satisfies PrismaConfig;
