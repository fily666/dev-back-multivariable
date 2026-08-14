import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { GLOBAL_AREA_CODE } from '../../common/constants';
import type { AnalyticsFilters } from '../dto/analytics.dto';

@Injectable()
export class ResponsesRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Conteos y duraciones que alimentan las tarjetas superiores (KPIs 3, 4, 5). */
  async fetchCompletionStats(filters: AnalyticsFilters) {
    const scope = {
      ...(filters.campaignId ? { campaignId: filters.campaignId } : {}),
      ...(filters.ownArea ? { ownArea: filters.ownArea } : {}),
    };

    const [completed, started, durations] = await Promise.all([
      this.prisma.surveyResponse.count({
        where: { ...scope, status: 'COMPLETED' },
      }),
      this.prisma.surveyResponse.count({ where: scope }),
      this.prisma.surveyResponse.findMany({
        where: {
          ...scope,
          status: 'COMPLETED',
          durationSeconds: { not: null },
        },
        select: { durationSeconds: true },
      }),
    ]);

    return {
      completed,
      started,
      durations: durations
        .map((row) => row.durationSeconds)
        .filter((value): value is number => value !== null),
    };
  }

  /**
   * Población por área para la tasa de participación (KPI 3).
   *
   * Si ningún área tiene `headcount`, devuelve null: inventar un denominador daría una
   * tasa falsa, y es mejor que el panel muestre "sin definir".
   */
  async fetchPopulation(ownArea?: string): Promise<number | null> {
    const areas = await this.prisma.area.findMany({
      where: {
        active: true,
        code: ownArea ? ownArea : { not: GLOBAL_AREA_CODE },
        headcount: { not: null },
      },
      select: { headcount: true },
    });

    if (areas.length === 0) return null;
    return areas.reduce((total, area) => total + (area.headcount ?? 0), 0);
  }

  /** Áreas activas y evaluables, en el orden del catálogo. */
  async fetchAreas() {
    return this.prisma.area.findMany({
      where: { active: true, code: { not: GLOBAL_AREA_CODE } },
      orderBy: { sortOrder: 'asc' },
      select: { code: true, name: true, isEvaluable: true, headcount: true },
    });
  }

  /** Áreas de origen con su conteo de respuestas, para el KPI 20. */
  async fetchRespondentsByOwnArea(filters: AnalyticsFilters) {
    const rows = await this.prisma.surveyResponse.groupBy({
      by: ['ownArea'],
      where: {
        status: 'COMPLETED',
        ...(filters.campaignId ? { campaignId: filters.campaignId } : {}),
      },
      _count: { _all: true },
    });

    return rows
      .filter(
        (row): row is typeof row & { ownArea: string } => row.ownArea !== null,
      )
      .map((row) => ({ areaCode: row.ownArea, respondents: row._count._all }));
  }

  /** Listado paginado del panel de respuestas. */
  async fetchPage(filters: AnalyticsFilters, page: number, pageSize: number) {
    const where = {
      status: 'COMPLETED' as const,
      ...(filters.campaignId ? { campaignId: filters.campaignId } : {}),
      ...(filters.ownArea ? { ownArea: filters.ownArea } : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.surveyResponse.count({ where }),
      this.prisma.surveyResponse.findMany({
        where,
        orderBy: { submittedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          ownArea: true,
          ownAreaOther: true,
          respondentName: true,
          respondentRole: true,
          submittedAt: true,
          durationSeconds: true,
          _count: { select: { answers: true } },
        },
      }),
    ]);

    return { total, rows };
  }

  async fetchCampaigns() {
    return this.prisma.campaign.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        isOpen: true,
        startsAt: true,
        endsAt: true,
        _count: { select: { responses: true } },
      },
    });
  }
}
