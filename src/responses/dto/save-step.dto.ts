import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { SCALE_MAX, SCALE_MIN } from '../../common/constants';

export class AnswerInputDto {
  @IsString()
  @MaxLength(64)
  questionCode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  targetArea?: string;

  @IsOptional()
  @IsInt()
  @Min(SCALE_MIN)
  @Max(SCALE_MAX)
  valueNumber?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  valueOption?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  @ArrayMaxSize(32)
  valueOptions?: string[] | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  valueText?: string | null;
}

export class SaveStepDto {
  @IsArray()
  @ArrayMaxSize(64)
  @ValidateNested({ each: true })
  @Type(() => AnswerInputDto)
  answers!: AnswerInputDto[];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  respondentName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  respondentRole?: string;
}
