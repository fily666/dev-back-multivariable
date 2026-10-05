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

  /**
   * Áreas activas del catálogo, en su orden y sin el centinela global. Incluye las no
   * evaluables como OTRA: quien filtra por `isEvaluable` es cada consumidor. Trae su gestión
   * para que el monitoreo pueda agrupar sin otro viaje a la base.
   */
  async fetchAreas() {
    return this.prisma.area.findMany({
      where: { active: true, code: { not: GLOBAL_AREA_CODE } },
      orderBy: { sortOrder: 'asc' },
      select: {
        code: true,
        name: true,
        isEvaluable: true,
        headcount: true,
        procesoCode: true,
        proceso: { select: { name: true } },
      },
    });
  }

  /**
   * Respuestas de cualquier estado para el monitoreo: aquí los borradores son el dato, no
   * ruido. Solo columnas de participación — ni respuestas ni huellas.
   *
   * Solo se honra `campaignId`. `from`/`to` cortan por `submittedAt`, que los borradores no
   * tienen, así que aplicarlos borraría justo lo que se quiere ver; frecuencia y tipo de
   * interacción dependen de lo que se respondió, y el corte por área ya viene en `byArea`.
   */
  async fetchMonitoringRows(filters: AnalyticsFilters) {
    return this.prisma.surveyResponse.findMany({
      where: filters.campaignId ? { campaignId: filters.campaignId } : {},
      select: {
        status: true,
        ownArea: true,
        respondentRole: true,
        startedAt: true,
        submittedAt: true,
        updatedAt: true,
        durationSeconds: true,
        lastStep: true,
      },
    });
  }

  /** Componentes del instrumento en su orden, para el embudo del monitoreo. */
  async fetchComponents() {
    return this.prisma.component.findMany({
      orderBy: { sortOrder: 'asc' },
      select: { id: true, title: true, sortOrder: true },
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
          respondentRole: true,
          submittedAt: true,
          durationSeconds: true,
          area: { select: { name: true } },
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
