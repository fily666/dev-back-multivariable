import { Controller, Get } from '@nestjs/common';
import { SurveyService } from './survey.service';
import type { SurveySchemaDto } from './dto/survey-schema.dto';

@Controller('survey')
export class SurveyController {
  constructor(private readonly surveyService: SurveyService) {}

  /** Catálogo completo del instrumento. Público: el front lo necesita antes del login. */
  @Get('schema')
  getSchema(): Promise<SurveySchemaDto> {
    return this.surveyService.getSchema();
  }
}
