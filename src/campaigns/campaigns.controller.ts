import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AuditService } from '../auth/audit.service';
import { AuthService } from '../auth/auth.service';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';

@Controller('admin/campaigns')
@UseGuards(AdminGuard)
export class CampaignsController {
  constructor(
    private readonly campaigns: CampaignsService,
    private readonly audit: AuditService,
    private readonly auth: AuthService,
  ) {}

  @Get()
  list() {
    return this.campaigns.list();
  }

  @Post()
  async create(@Body() dto: CreateCampaignDto, @Req() request: Request) {
    const campaign = await this.campaigns.create(dto);
    await this.audit.record('CAMPAIGN_CREATE', this.auth.hashIp(request.ip), {
      campaignId: campaign.id,
      name: campaign.name,
    });
    return campaign;
  }

  /** Cerrar una campaña congela su corte: deja de aceptar respuestas nuevas. */
  @Patch(':id/close')
  async close(@Param('id') id: string, @Req() request: Request) {
    const campaign = await this.campaigns.close(id);
    await this.audit.record('CAMPAIGN_CLOSE', this.auth.hashIp(request.ip), {
      campaignId: id,
    });
    return campaign;
  }
}
