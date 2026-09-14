import { Injectable } from '@nestjs/common';
import { stringify } from 'csv-stringify';
import ExcelJS from 'exceljs';
import type { Response } from 'express';
import { PrismaService } from '../database/prisma.service';
import { GLOBAL_AREA_CODE, RESPONDENT_ROLE_LABELS } from '../common/constants';
import { safeCell } from './csv-cell.util';

export const EXPORT_COLUMNS = [
  'responseId',
  'campana',
  'enviadoEn',
  'duracionSegundos',
  'areaPropia',
  'areaPropiaOtra',
  'cargo',
  'componenteId',
  'preguntaCodigo',
  'preguntaTexto',
  'areaEvaluada',
  'valorNumerico',
  'valorOpcion',
  'valorOpciones',
  'valorTexto',
  'tema',
] as const;

/** Tamaño de lote: acota la memoria sin multiplicar los viajes a la base. */
const BATCH_SIZE = 500;

@Injectable()
export class ExportService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Exporta las respuestas en CSV escribiendo al response conforme llegan los lotes.
   *
   * Las funciones de Vercel cortan a los 10 segundos, así que el dataset no se materializa
   * en memoria: se pagina por cursor y cada lote sale por el stream.
   */
  async streamCsv(response: Response, campaignId?: string): Promise<void> {
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="diagnostico-linktic-${stamp()}.csv"`,
    );

    const csv = stringify({
      header: true,
      columns: [...EXPORT_COLUMNS],
      bom: true,
    });
    csv.pipe(response);

    for await (const row of this.iterateRows(campaignId)) {
      csv.write(row);
    }

    csv.end();
    await new Promise<void>((resolve) => csv.on('end', resolve));
  }

  /** Igual que el CSV pero en XLSX, con el writer por streaming de exceljs. */
  async streamXlsx(response: Response, campaignId?: string): Promise<void> {
    response.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="diagnostico-linktic-${stamp()}.xlsx"`,
    );

    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
      stream: response,
    });
    const sheet = workbook.addWorksheet('Respuestas');
    sheet.columns = EXPORT_COLUMNS.map((key) => ({
      header: key,
      key,
      width: 22,
    }));
    sheet.getRow(1).font = { bold: true };

    for await (const row of this.iterateRows(campaignId)) {
      sheet.addRow(row).commit();
    }

    sheet.commit();
    await workbook.commit();
  }

  /**
   * Recorre las respuestas por cursor sobre el id de `answers`.
   *
   * Se pagina por cursor y no por offset porque un `skip` grande obliga a Postgres a
   * recorrer y descartar las filas anteriores en cada lote.
   */
  private async *iterateRows(campaignId?: string) {
    let cursor: bigint | undefined;

    for (;;) {
      const batch = await this.prisma.answer.findMany({
        where: {
          response: {
            status: 'COMPLETED',
            ...(campaignId ? { campaignId } : {}),
          },
        },
        orderBy: { id: 'asc' },
        take: BATCH_SIZE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: {
          id: true,
          questionCode: true,
          targetArea: true,
          valueNumber: true,
          valueOption: true,
          valueOptions: true,
          valueText: true,
          theme: true,
          question: { select: { componentId: true, label: true } },
          response: {
            select: {
              id: true,
              submittedAt: true,
              durationSeconds: true,
              ownArea: true,
              ownAreaOther: true,
              respondentRole: true,
              campaign: { select: { name: true } },
            },
          },
        },
      });

      if (batch.length === 0) return;

      for (const answer of batch) {
        yield {
          responseId: answer.response.id,
          campana: safeCell(answer.response.campaign.name),
          enviadoEn: answer.response.submittedAt?.toISOString() ?? null,
          duracionSegundos: answer.response.durationSeconds,
          areaPropia: answer.response.ownArea,
          areaPropiaOtra: safeCell(answer.response.ownAreaOther),
          cargo: safeCell(
            answer.response.respondentRole
              ? (RESPONDENT_ROLE_LABELS[answer.response.respondentRole] ??
                  answer.response.respondentRole)
              : null,
          ),
          componenteId: answer.question.componentId,
          preguntaCodigo: answer.questionCode,
          preguntaTexto: safeCell(answer.question.label),
          // El centinela es un detalle de almacenamiento: en el reporte se deja vacío.
          areaEvaluada:
            answer.targetArea === GLOBAL_AREA_CODE ? '' : answer.targetArea,
          valorNumerico:
            answer.valueNumber === null ? null : Number(answer.valueNumber),
          valorOpcion: answer.valueOption,
          valorOpciones: answer.valueOptions.join('; '),
          valorTexto: safeCell(answer.valueText),
          tema: safeCell(answer.theme),
        };
      }

      cursor = batch[batch.length - 1].id;
    }
  }
}

function stamp(): string {
  return new Date().toISOString().slice(0, 10);
}
