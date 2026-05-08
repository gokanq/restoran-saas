// apps/api/src/deliveries/deliveries.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DeliveriesController } from './deliveries.controller';
import { DeliveriesService } from './deliveries.service';
import { MapboxService } from './mapbox.service';
import { CourierAuthController } from './courier-auth.controller';
import { CourierPortalController } from './courier-portal.controller';
import { CourierAuthService } from './courier-auth.service';

@Module({
  imports: [PrismaModule],
  controllers: [
    DeliveriesController,
    CourierAuthController,
    CourierPortalController,
  ],
  providers: [DeliveriesService, MapboxService, CourierAuthService],
  exports: [DeliveriesService, MapboxService],
})
export class DeliveriesModule {}
