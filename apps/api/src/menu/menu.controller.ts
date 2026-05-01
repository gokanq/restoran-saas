import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { MenuService } from './menu.service';

type AuthenticatedRequest = Request & {
  user: {
    id: string;
    restaurantId: string | null;
    email: string;
    role: UserRole;
    isActive: boolean;
  };
};

@Controller('menu')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Get('categories')
  findCategories(@Req() req: AuthenticatedRequest) {
    if (!req.user.restaurantId) {
      throw new ForbiddenException('Restaurant bilgisi bulunamadı');
    }

    return this.menuService.findCategories(req.user.restaurantId);
  }

  @Post('categories')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  createCategory(
    @Body()
    body: {
      branchId?: string | null;
      name: string;
      sortOrder?: number;
      isActive?: boolean;
    },
    @Req() req: AuthenticatedRequest,
  ) {
    if (!req.user.restaurantId) {
      throw new ForbiddenException('Restaurant bilgisi bulunamadı');
    }

    return this.menuService.createCategory({
      restaurantId: req.user.restaurantId,
      branchId: body.branchId,
      name: body.name,
      sortOrder: body.sortOrder,
      isActive: body.isActive,
    });
  }

  @Get('items')
  findItems(@Req() req: AuthenticatedRequest) {
    if (!req.user.restaurantId) {
      throw new ForbiddenException('Restaurant bilgisi bulunamadı');
    }

    return this.menuService.findItems(req.user.restaurantId);
  }

  @Post('items')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  createItem(
    @Body()
    body: {
      branchId?: string | null;
      categoryId?: string | null;
      name: string;
      description?: string | null;
      price: string | number;
      isActive?: boolean;
    },
    @Req() req: AuthenticatedRequest,
  ) {
    if (!req.user.restaurantId) {
      throw new ForbiddenException('Restaurant bilgisi bulunamadı');
    }

    return this.menuService.createItem({
      restaurantId: req.user.restaurantId,
      branchId: body.branchId,
      categoryId: body.categoryId,
      name: body.name,
      description: body.description,
      price: body.price,
      isActive: body.isActive,
    });
  }

  @Get('option-groups')
  findOptionGroups(@Req() req: AuthenticatedRequest) {
    if (!req.user.restaurantId) {
      throw new ForbiddenException('Restaurant bilgisi bulunamadı');
    }

    return this.menuService.findOptionGroups(req.user.restaurantId);
  }

  @Post('option-groups')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  createOptionGroup(
    @Body()
    body: {
      branchId?: string | null;
      menuItemId: string;
      name: string;
      isRequired?: boolean;
      minSelect?: number;
      maxSelect?: number;
      sortOrder?: number;
      isActive?: boolean;
    },
    @Req() req: AuthenticatedRequest,
  ) {
    if (!req.user.restaurantId) {
      throw new ForbiddenException('Restaurant bilgisi bulunamadı');
    }

    return this.menuService.createOptionGroup({
      restaurantId: req.user.restaurantId,
      branchId: body.branchId,
      menuItemId: body.menuItemId,
      name: body.name,
      isRequired: body.isRequired,
      minSelect: body.minSelect,
      maxSelect: body.maxSelect,
      sortOrder: body.sortOrder,
      isActive: body.isActive,
    });
  }

  @Post('options')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  createOption(
    @Body()
    body: {
      branchId?: string | null;
      optionGroupId: string;
      name: string;
      price?: string | number;
      sortOrder?: number;
      isActive?: boolean;
    },
    @Req() req: AuthenticatedRequest,
  ) {
    if (!req.user.restaurantId) {
      throw new ForbiddenException('Restaurant bilgisi bulunamadı');
    }

    return this.menuService.createOption({
      restaurantId: req.user.restaurantId,
      branchId: body.branchId,
      optionGroupId: body.optionGroupId,
      name: body.name,
      price: body.price,
      sortOrder: body.sortOrder,
      isActive: body.isActive,
    });
  }
}
