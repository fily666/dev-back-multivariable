import {
  IsBoolean,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateCampaignDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsISO8601()
  endsAt?: string;

  /** Al abrirla se cierra la anterior: solo puede haber una campaña recibiendo respuestas. */
  @IsOptional()
  @IsBoolean()
  open?: boolean;
}
