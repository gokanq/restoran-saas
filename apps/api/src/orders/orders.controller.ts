import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { OrderStatus, UserRole } from '@prisma/client';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { OrdersService } from './orders.service';

type AuthenticatedRequest = Request & {
  user: {
    id: string;
    restaurantId: string | null;
    email: string;
    role: UserRole;
    isActive: boolean;
  };
};

@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  findAll(@Req() req: AuthenticatedRequest) {
    if (!req.user.restaurantId) {
      throw new ForbiddenException('Restaurant bilgisi bulunamadı');
    }

    return this.ordersService.findByRestaurant(req.user.restaurantId);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  create(
    @Body()
    body: {
      branchId: string;
      code: string;
      status?: OrderStatus;
      total?: string | number;
    },
    @Req() req: AuthenticatedRequest,
  ) {
    if (!req.user.restaurantId) {
      throw new ForbiddenException('Restaurant bilgisi bulunamadı');
    }

    return this.ordersService.create({
      restaurantId: req.user.restaurantId,
      branchId: body.branchId,
      code: body.code,
      status: body.status,
      total: body.total,
    });
  }
}
