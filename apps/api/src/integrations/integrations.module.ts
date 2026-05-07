import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../prisma/prisma.module';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { TrendyolService } from './trendyol.service';
import { GetirService } from './getir.service';
import { PlatformSyncService } from './platform-sync.service';

@Module({
  imports: [PrismaModule, ScheduleModule.forRoot()],
  controllers: [IntegrationsController],
  providers: [IntegrationsService, TrendyolService, GetirService, PlatformSyncService],
  exports: [IntegrationsService],
})
export class IntegrationsModule {}
