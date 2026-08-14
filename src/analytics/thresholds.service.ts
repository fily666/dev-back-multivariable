import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { ThresholdBand } from './indicators/indicator.types';

@Injectable()
export class ThresholdsService {
  private cache: ThresholdBand[] | null = null;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Bandas de semaforización. Viven en la base (`indicator_thresholds`) y no en el front
   * para que LinkTIC pueda ajustar rangos y colores sin desplegar.
   */
  async getBands(): Promise<ThresholdBand[]> {
    if (this.cache) return this.cache;

    const rows = await this.prisma.indicatorThreshold.findMany({
      orderBy: { sortOrder: 'asc' },
    });

    this.cache = rows.map((row) => ({
      label: row.label,
      minValue: Number(row.minValue),
      maxValue: Number(row.maxValue),
      color: row.color,
    }));
    return this.cache;
  }

  /** Clasifica un índice 0-100. Un valor nulo no tiene banda: no hay dato que calificar. */
  async classify(value: number | null): Promise<ThresholdBand | null> {
    if (value === null) return null;
    const bands = await this.getBands();
    return (
      bands.find((band) => value >= band.minValue && value <= band.maxValue) ??
      null
    );
  }

  /** Versión sincrónica para clasificar muchos valores sin releer la base. */
  classifyWith(
    bands: ThresholdBand[],
    value: number | null,
  ): ThresholdBand | null {
    if (value === null) return null;
    return (
      bands.find((band) => value >= band.minValue && value <= band.maxValue) ??
      null
    );
  }
}
