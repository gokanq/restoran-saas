import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { BranchesService } from './branches.service';

type AuthenticatedRequest = Request & {
  user: {
    id: string;
    restaurantId: string | null;
    email: string;
    role: UserRole;
    isActive: boolean;
  };
};

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get('branches')
  findAll(@Req() req: AuthenticatedRequest) {
    if (!req.user.restaurantId) {
      throw new ForbiddenException('Restaurant bilgisi bulunamadı');
    }

    return this.branchesService.findByRestaurant(req.user.restaurantId);
  }

  @Get('restaurants/:restaurantId/branches')
  findByRestaurant(
    @Param('restaurantId') restaurantId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!req.user.restaurantId || req.user.restaurantId !== restaurantId) {
      throw new ForbiddenException('Bu restaurant şubelerine erişim yetkiniz yok');
    }

    return this.branchesService.findByRestaurant(restaurantId);
  }

  @Post('branches')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  create(
    @Body()
    body: {
      name: string;
      address?: string;
      phone?: string;
    },
    @Req() req: AuthenticatedRequest,
  ) {
    if (!req.user.restaurantId) {
      throw new ForbiddenException('Restaurant bilgisi bulunamadı');
    }

    return this.branchesService.create({
      restaurantId: req.user.restaurantId,
      name: body.name,
      address: body.address,
      phone: body.phone,
    });
  }
}
