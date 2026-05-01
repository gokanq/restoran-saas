import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { RestaurantsModule } from './restaurants/restaurants.module';
import { BranchesModule } from './branches/branches.module';

@Module({
  imports: [PrismaModule, RestaurantsModule, BranchesModule],
})
export class AppModule {}
