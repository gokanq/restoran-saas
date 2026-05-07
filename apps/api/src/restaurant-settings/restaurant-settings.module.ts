import { Module } from '@nestjs/common';
import { RestaurantSettingsController } from './restaurant-settings.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [RestaurantSettingsController],
})
export class RestaurantSettingsModule {}
