import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { BranchesModule } from './branches/branches.module';
import { CouriersModule } from './couriers/couriers.module';
import { MenuModule } from './menu/menu.module';
import { OrdersModule } from './orders/orders.module';
import { PrismaModule } from './prisma/prisma.module';
import { PublicModule } from './public/public.module';
import { RestaurantsModule } from './restaurants/restaurants.module';
import { UsersModule } from './users/users.module';
import { TableServiceModule } from './table-service/table-service.module';

@Module({
  imports: [
    AuthModule,
    PrismaModule,
    RestaurantsModule,
    BranchesModule,
    CouriersModule,
    UsersModule,
    OrdersModule,
    TableServiceModule,
    MenuModule,
    PublicModule,
  ],
})
export class AppModule {}
