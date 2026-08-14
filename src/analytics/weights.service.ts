import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { IMC_COMPONENT_CODES } from './indicators/question-codes.constant';

const WEIGHT_SUM_TOLERANCE = 0.0005;

@Injectable()
export class WeightsService {
  private readonly logger = new Logger(WeightsService.name);
  private cache: Map<string, number> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Pesos del IMC. Se cachean porque se leen en cada request del dashboard y solo cambian
   * cuando un admin los edita explícitamente.
   */
  async getWeights(): Promise<Map<string, number>> {
    if (this.cache) return this.cache;

    const rows = await this.prisma.indicatorWeight.findMany();
    const weights = new Map(
      rows.map((row) => [row.indicatorCode, Number(row.weight)]),
    );

    // Un peso faltante desbalancea el compuesto en silencio: se avisa, y `computeImc`
    // reescala sobre los que sí existen.
    const missing = IMC_COMPONENT_CODES.filter((code) => !weights.has(code));
    if (missing.length > 0) {
      this.logger.warn(
        `Faltan pesos del IMC en la base: ${missing.join(', ')}`,
      );
    }

    this.cache = weights;
    return weights;
  }

  async listWeights() {
    const weights = await this.getWeights();
    return [...weights.entries()].map(([indicatorCode, weight]) => ({
      indicatorCode,
      weight,
    }));
  }

  /**
   * Actualiza los pesos. Valida que sumen 1 ANTES de escribir: dejar pasar una suma
   * distinta haría que el IMC deje de ser comparable entre cortes sin que nadie lo note.
   */
  async updateWeights(input: { indicatorCode: string; weight: number }[]) {
    const unknown = input.filter(
      (entry) => !IMC_COMPONENT_CODES.includes(entry.indicatorCode as never),
    );
    if (unknown.length > 0) {
      throw new BadRequestException(
        `Estos indicadores no componen el IMC: ${unknown.map((e) => e.indicatorCode).join(', ')}.`,
      );
    }

    const sum = input.reduce((total, entry) => total + entry.weight, 0);
    if (Math.abs(sum - 1) > WEIGHT_SUM_TOLERANCE) {
      throw new BadRequestException(
        `Los pesos deben sumar 1.000; la propuesta suma ${sum.toFixed(3)}.`,
      );
    }

    await this.prisma.$transaction(
      input.map((entry) =>
        this.prisma.indicatorWeight.upsert({
          where: { indicatorCode: entry.indicatorCode },
          update: { weight: entry.weight },
          create: { indicatorCode: entry.indicatorCode, weight: entry.weight },
        }),
      ),
    );

    this.cache = null;
    return this.listWeights();
  }
}
