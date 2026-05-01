import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { OrderStatus, OrderType, UserRole } from '@prisma/client';
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

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    if (!req.user.restaurantId) {
      throw new ForbiddenException('Restaurant bilgisi bulunamadı');
    }

    return this.ordersService.findOneByRestaurant(id, req.user.restaurantId);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
  create(
    @Body()
    body: {
      branchId: string;
      code: string;
      type?: OrderType;
      status?: OrderStatus;
      total?: string | number;
      customerName?: string;
      customerPhone?: string;
      customerAddress?: string;
      note?: string;
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
      type: body.type,
      status: body.status,
      total: body.total,
      customerName: body.customerName,
      customerPhone: body.customerPhone,
      customerAddress: body.customerAddress,
      note: body.note,
    });
  }

  @Patch(':id/status')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF, UserRole.COURIER)
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status: OrderStatus },
    @Req() req: AuthenticatedRequest,
  ) {
    if (!req.user.restaurantId) {
      throw new ForbiddenException('Restaurant bilgisi bulunamadı');
    }

    return this.ordersService.updateStatus({
      orderId: id,
      restaurantId: req.user.restaurantId,
      status: body.status,
    });
  }
}
