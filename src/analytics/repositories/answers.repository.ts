import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { RawAnswerRow } from '../indicators/indicator.types';
import type { AnalyticsFilters } from '../dto/analytics.dto';

@Injectable()
export class AnswersRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Trae las respuestas crudas de un conjunto de preguntas.
   *
   * Es la única lectura que casi toda la analítica necesita: los indicadores y los KPIs
   * piden aquí todos los códigos que van a usar y luego agrupan en memoria, en vez de
   * hacer un viaje a la base por cada cálculo.
   *
   * Solo cuenta lo COMPLETADO: los borradores a medio llenar sesgarían los promedios.
   */
  async fetchAnswers(
    questionCodes: readonly string[],
    filters: AnalyticsFilters = {},
  ): Promise<RawAnswerRow[]> {
    const rows = await this.prisma.answer.findMany({
      where: {
        questionCode: { in: [...questionCodes] },
        response: this.responseWhere(filters),
      },
      select: {
        responseId: true,
        targetArea: true,
        questionCode: true,
        valueNumber: true,
        valueOption: true,
        valueOptions: true,
        response: { select: { ownArea: true } },
      },
    });

    return rows.map((row) => ({
      responseId: row.responseId,
      ownArea: row.response.ownArea,
      targetArea: row.targetArea,
      questionCode: row.questionCode,
      valueNumber: row.valueNumber === null ? null : Number(row.valueNumber),
      valueOption: row.valueOption,
      valueOptions: row.valueOptions,
    }));
  }

  /** Respuestas abiertas con su tema, para el KPI 19. */
  async fetchOpenAnswers(
    questionCode: string,
    filters: AnalyticsFilters,
    limit = 500,
  ) {
    return this.prisma.answer.findMany({
      where: {
        questionCode,
        valueText: { not: null },
        response: this.responseWhere(filters),
      },
      select: {
        id: true,
        valueText: true,
        theme: true,
        response: { select: { ownArea: true, submittedAt: true } },
      },
      orderBy: { id: 'desc' },
      take: limit,
    });
  }

  async updateTheme(answerId: bigint, theme: string | null) {
    return this.prisma.answer.update({
      where: { id: answerId },
      data: { theme },
      select: { id: true, theme: true },
    });
  }

  /**
   * Filtro compartido sobre `survey_responses`.
   *
   * Los filtros por frecuencia y tipo de interacción son sobre respuestas del propio
   * encuestado, así que se expresan como una condición sobre sus otras `answers`.
   */
  private responseWhere(filters: AnalyticsFilters) {
    const conditions: Record<string, unknown> = {
      status: 'COMPLETED' as const,
    };

    if (filters.campaignId) conditions.campaignId = filters.campaignId;
    if (filters.ownArea) conditions.ownArea = filters.ownArea;

    if (filters.from || filters.to) {
      conditions.submittedAt = {
        ...(filters.from ? { gte: new Date(filters.from) } : {}),
        ...(filters.to ? { lte: new Date(filters.to) } : {}),
      };
    }

    const answerFilters: unknown[] = [];
    if (filters.frecuencia) {
      answerFilters.push({
        some: {
          questionCode: 'c1_frecuencia',
          valueOption: filters.frecuencia,
        },
      });
    }
    if (filters.tipoInteraccion) {
      answerFilters.push({
        some: {
          questionCode: 'c1_tipo_interaccion',
          valueOptions: { has: filters.tipoInteraccion },
        },
      });
    }
    if (answerFilters.length === 1) {
      conditions.answers = answerFilters[0];
    } else if (answerFilters.length > 1) {
      conditions.AND = answerFilters.map((answers) => ({ answers }));
    }

    return conditions;
  }
}
