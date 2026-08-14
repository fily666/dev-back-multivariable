import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.ts';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private readonly isProduction: boolean;

  constructor(config: ConfigService) {
    super({
      adapter: new PrismaPg({
        connectionString: config.getOrThrow<string>('DATABASE_URL'),
      }),
    });
    this.isProduction = config.get<string>('NODE_ENV') === 'production';
  }

  async onModuleInit() {
    await this.$connect();

    // El driver adapter abre la conexión de forma diferida, así que `$connect` no prueba
    // nada por sí solo. Se lanza una consulta trivial para que una DATABASE_URL mal puesta
    // falle aquí y no en el primer request de un usuario.
    //
    // Fuera de producción solo se advierte: conviene poder levantar la API para trabajar en
    // el frontend aunque la base no esté disponible. En producción es un fallo de arranque.
    try {
      await this.$queryRaw`SELECT 1`;
      this.logger.log('Conexión a PostgreSQL verificada');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (this.isProduction) throw error;
      this.logger.warn(
        `No se pudo verificar la conexión a PostgreSQL: ${message}. ` +
          'La API arranca, pero cualquier endpoint que lea datos fallará.',
      );
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
