import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const FRECUENCIAS = [
  'DIARIA',
  'VARIAS_SEMANA',
  'SEMANAL',
  'MENSUAL',
  'ESPORADICA',
];
const TIPOS = ['OPERATIVA', 'TACTICA', 'ESTRATEGICA', 'COMERCIAL', 'SOPORTE'];

export class AnalyticsFiltersDto {
  @IsOptional()
  @IsUUID()
  campaignId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  ownArea?: string;

  @IsOptional()
  @IsIn(FRECUENCIAS)
  frecuencia?: string;

  @IsOptional()
  @IsIn(TIPOS)
  tipoInteraccion?: string;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;
}

export class PaginatedFiltersDto extends AnalyticsFiltersDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number;
}

export class UpdateWeightsDto {
  @IsString({ each: true })
  indicatorCodes!: string[];
}

export class UpdateThemeDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  theme?: string | null;
}
