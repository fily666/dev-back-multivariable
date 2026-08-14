import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { CreateCampaignDto } from './dto/create-campaign.dto';

@Injectable()
export class CampaignsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const campaigns = await this.prisma.campaign.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        isOpen: true,
        startsAt: true,
        endsAt: true,
        createdAt: true,
      },
    });

    // Solo se cuentan las completadas: los borradores no son resultados del diagnóstico.
    const counts = await this.prisma.surveyResponse.groupBy({
      by: ['campaignId'],
      where: { status: 'COMPLETED' },
      _count: { _all: true },
    });
    const byCampaign = new Map(
      counts.map((row) => [row.campaignId, row._count._all]),
    );

    return campaigns.map((campaign) => ({
      ...campaign,
      completedResponses: byCampaign.get(campaign.id) ?? 0,
    }));
  }

  /**
   * Crea una campaña. Si nace abierta, cierra las demás en la misma transacción.
   *
   * `GET /survey/schema` sirve la campaña abierta más reciente, así que dos abiertas a la
   * vez repartirían las respuestas de un mismo corte entre dos campañas sin que nadie lo note.
   */
  async create(dto: CreateCampaignDto) {
    const open = dto.open ?? true;

    return this.prisma.$transaction(async (tx) => {
      if (open) {
        await tx.campaign.updateMany({
          where: { isOpen: true },
          data: { isOpen: false, endsAt: new Date() },
        });
      }

      return tx.campaign.create({
        data: {
          name: dto.name,
          isOpen: open,
          endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
        },
      });
    });
  }

  async close(id: string) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException('La campaña no existe.');

    return this.prisma.campaign.update({
      where: { id },
      data: { isOpen: false, endsAt: campaign.endsAt ?? new Date() },
    });
  }
}
