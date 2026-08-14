import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { ResponsesService } from './responses.service';
import { SaveStepDto } from './dto/save-step.dto';

@Controller('responses')
export class ResponsesController {
  constructor(private readonly responses: ResponsesService) {}

  /** Abre un borrador. Limitado por IP para que no se pueda inundar la tabla. */
  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  start(@Req() request: Request) {
    return this.responses.start({
      ip: request.ip,
      userAgent: request.get('user-agent'),
    });
  }

  @Get(':draftToken')
  getDraft(@Param('draftToken') draftToken: string) {
    return this.responses.getDraft(draftToken);
  }

  @Patch(':draftToken/step/:componentId')
  saveStep(
    @Param('draftToken') draftToken: string,
    @Param('componentId', ParseIntPipe) componentId: number,
    @Body() dto: SaveStepDto,
  ) {
    return this.responses.saveStep(draftToken, componentId, dto);
  }

  @Post(':draftToken/submit')
  submit(@Param('draftToken') draftToken: string) {
    return this.responses.submit(draftToken);
  }
}
