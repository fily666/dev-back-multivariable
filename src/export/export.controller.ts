import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import type { Request, Response } from 'express';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AuditService } from '../auth/audit.service';
import { AuthService } from '../auth/auth.service';
import { ExportService } from './export.service';

class ExportQueryDto {
  @IsOptional()
  @IsIn(['csv', 'xlsx'])
  format?: 'csv' | 'xlsx';

  @IsOptional()
  @IsUUID()
  campaignId?: string;
}

@Controller('admin')
@UseGuards(AdminGuard)
export class ExportController {
  constructor(
    private readonly exportService: ExportService,
    private readonly audit: AuditService,
    private readonly auth: AuthService,
  ) {}

  /** Cada descarga se audita: son datos de percepción de personas identificables por área. */
  @Get('export')
  async export(
    @Query() query: ExportQueryDto,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const format = query.format ?? 'csv';
    await this.audit.record(
      format === 'xlsx' ? 'EXPORT_XLSX' : 'EXPORT_CSV',
      this.auth.hashIp(request.ip),
      { campaignId: query.campaignId ?? null },
    );

    if (format === 'xlsx') {
      await this.exportService.streamXlsx(response, query.campaignId);
    } else {
      await this.exportService.streamCsv(response, query.campaignId);
    }
  }
}
