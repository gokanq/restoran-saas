import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CallerDevicesController } from './caller-devices.controller';
import { CallerDevicesService } from './caller-devices.service';

@Module({
  controllers: [CallerDevicesController],
  providers: [CallerDevicesService, PrismaService],
})
export class CallerDevicesModule {}
