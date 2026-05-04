import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CallerDeviceEventsController } from './caller-device-events.controller';
import { CallerDeviceEventsService } from './caller-device-events.service';

@Module({
  controllers: [CallerDeviceEventsController],
  providers: [CallerDeviceEventsService, PrismaService],
})
export class CallerDeviceEventsModule {}
