import { Module } from '@nestjs/common';
import { CallerEventsController } from './caller-events.controller';
import { CallerEventsService } from './caller-events.service';

@Module({
  controllers: [CallerEventsController],
  providers: [CallerEventsService],
})
export class CallerEventsModule {}
