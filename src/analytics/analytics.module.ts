import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { AnswersRepository } from './repositories/answers.repository';
import { ResponsesRepository } from './repositories/responses.repository';
import { ThresholdsService } from './thresholds.service';
import { WeightsService } from './weights.service';

@Module({
  imports: [AuthModule],
  controllers: [AnalyticsController],
  providers: [
    AnalyticsService,
    AnswersRepository,
    ResponsesRepository,
    WeightsService,
    ThresholdsService,
  ],
  exports: [AnalyticsService, AnswersRepository, ResponsesRepository],
})
export class AnalyticsModule {}
