import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AuditService } from '../auth/audit.service';
import { AuthService } from '../auth/auth.service';
import { AnalyticsService } from './analytics.service';
import { WeightsService } from './weights.service';
import {
  AnalyticsFiltersDto,
  PaginatedFiltersDto,
  UpdateThemeDto,
} from './dto/analytics-filters.dto';

/** Todo el panel exige sesión de admin. La cohorte mínima se aplica en el servicio. */
@Controller('admin')
@UseGuards(AdminGuard)
export class AnalyticsController {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly weights: WeightsService,
    private readonly audit: AuditService,
    private readonly auth: AuthService,
  ) {}

  @Get('overview')
  getOverview(@Query() filters: AnalyticsFiltersDto) {
    return this.analytics.getOverview(filters);
  }

  @Get('indicators')
  getIndicators(@Query() filters: AnalyticsFiltersDto) {
    return this.analytics.getIndicators(filters);
  }

  @Get('components')
  getComponents(@Query() filters: AnalyticsFiltersDto) {
    return this.analytics.getComponents(filters);
  }

  @Get('relationship-map')
  getRelationshipMap(@Query() filters: AnalyticsFiltersDto) {
    return this.analytics.getRelationshipMap(filters);
  }

  @Get('nps')
  getNps(@Query() filters: AnalyticsFiltersDto) {
    return this.analytics.getNps(filters);
  }

  @Get('indices-by-area')
  getIndicesByArea(@Query() filters: AnalyticsFiltersDto) {
    return this.analytics.getIndicesByArea(filters);
  }

  @Get('qualitative')
  getQualitative(@Query() filters: AnalyticsFiltersDto) {
    return this.analytics.getQualitative(filters);
  }

  @Get('areas/:code')
  getArea(@Param('code') code: string, @Query() filters: AnalyticsFiltersDto) {
    return this.analytics.getAreaDetail(code, filters);
  }

  @Get('responses')
  getResponses(@Query() query: PaginatedFiltersDto) {
    const { page = 1, pageSize = 50, ...filters } = query;
    return this.analytics.getResponsesPage(filters, page, pageSize);
  }

  @Get('weights')
  listWeights() {
    return this.weights.listWeights();
  }

  /** Los pesos del IMC son auditables: cambiarlos altera el KPI titular de la organización. */
  @Put('weights')
  async updateWeights(
    @Body() body: { weights: { indicatorCode: string; weight: number }[] },
    @Req() request: Request,
  ) {
    const updated = await this.weights.updateWeights(body.weights);
    await this.audit.record('WEIGHTS_UPDATE', this.auth.hashIp(request.ip), {
      weights: body.weights,
    });
    return updated;
  }

  /** Agrupación temática manual de las respuestas abiertas (KPI 19). */
  @Patch('qualitative/answers/:id/theme')
  async updateTheme(
    @Param('id') id: string,
    @Body() dto: UpdateThemeDto,
    @Req() request: Request,
  ) {
    const updated = await this.analytics.updateTheme(id, dto.theme ?? null);
    await this.audit.record('THEME_UPDATE', this.auth.hashIp(request.ip), {
      answerId: id,
      theme: dto.theme ?? null,
    });
    return { id: String(updated.id), theme: updated.theme };
  }
}
