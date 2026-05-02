import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CouriersService } from './couriers.service';

type AuthenticatedRequest = Request & {
  user: {
    id: string;
    restaurantId: string | null;
    email: string;
    role: UserRole;
    isActive: boolean;
  };
};

@Controller('couriers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CouriersController {
  constructor(private readonly couriersService: CouriersService) {}

  @Get()
  findAll(@Req() req: AuthenticatedRequest) {
    if (!req.user.restaurantId) {
      throw new ForbiddenException('Restaurant bilgisi bulunamadı');
    }

    return this.couriersService.findByRestaurant(req.user.restaurantId);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  create(
    @Body()
    body: {
      branchId?: string | null;
      name?: string;
      phone?: string | null;
      perPackageFee?: string | number | null;
      hourlyFee?: string | number | null;
      isActive?: boolean;
    },
    @Req() req: AuthenticatedRequest,
  ) {
    if (!req.user.restaurantId) {
      throw new ForbiddenException('Restaurant bilgisi bulunamadı');
    }

    return this.couriersService.create({
      restaurantId: req.user.restaurantId,
      branchId: body.branchId,
      name: body.name,
      phone: body.phone,
      perPackageFee: body.perPackageFee,
      hourlyFee: body.hourlyFee,
      isActive: body.isActive,
    });
  }

  @Patch(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  update(
    @Param('id') id: string,
    @Body()
    body: {
      branchId?: string | null;
      name?: string;
      phone?: string | null;
      perPackageFee?: string | number | null;
      hourlyFee?: string | number | null;
      isActive?: boolean;
    },
    @Req() req: AuthenticatedRequest,
  ) {
    if (!req.user.restaurantId) {
      throw new ForbiddenException('Restaurant bilgisi bulunamadı');
    }

    return this.couriersService.update({
      id,
      restaurantId: req.user.restaurantId,
      branchId: body.branchId,
      name: body.name,
      phone: body.phone,
      perPackageFee: body.perPackageFee,
      hourlyFee: body.hourlyFee,
      isActive: body.isActive,
    });
  }

  @Delete(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  deactivate(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    if (!req.user.restaurantId) {
      throw new ForbiddenException('Restaurant bilgisi bulunamadı');
    }

    return this.couriersService.deactivate(id, req.user.restaurantId);
  }
}
