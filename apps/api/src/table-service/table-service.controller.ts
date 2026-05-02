import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { TableSessionItemStatus, UserRole } from '@prisma/client';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { TableServiceService } from './table-service.service';

type AuthenticatedRequest = Request & { user: { id: string; restaurantId: string | null; role: UserRole } };

@Controller('table-service')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF)
export class TableServiceController {
  constructor(private readonly tableService: TableServiceService) {}

  private getRestaurantId(req: AuthenticatedRequest) {
    if (!req.user.restaurantId) throw new ForbiddenException('Restaurant bilgisi bulunamadı');
    return req.user.restaurantId;
  }

  @Get('dining-areas')
  getDiningAreas(@Query('branchId') branchId: string, @Req() req: AuthenticatedRequest) { return this.tableService.getDiningAreas(this.getRestaurantId(req), branchId); }
  @Post('dining-areas')
  createDiningArea(@Body() body: { branchId: string; name: string; sortOrder?: number }, @Req() req: AuthenticatedRequest) { return this.tableService.createDiningArea(this.getRestaurantId(req), body); }
  @Patch('dining-areas/:id')
  patchDiningArea(@Param('id') id: string, @Body() body: { name?: string; sortOrder?: number; isActive?: boolean }, @Req() req: AuthenticatedRequest) { return this.tableService.patchDiningArea(this.getRestaurantId(req), id, body); }

  @Get('tables')
  getTables(@Query('branchId') branchId: string, @Req() req: AuthenticatedRequest) { return this.tableService.getTables(this.getRestaurantId(req), branchId); }
  @Post('tables')
  createTable(@Body() body: { branchId: string; diningAreaId?: string; name: string; code?: string; capacity?: number; sortOrder?: number }, @Req() req: AuthenticatedRequest) { return this.tableService.createTable(this.getRestaurantId(req), body); }
  @Patch('tables/:id')
  patchTable(@Param('id') id: string, @Body() body: { diningAreaId?: string | null; name?: string; capacity?: number | null; sortOrder?: number; isActive?: boolean }, @Req() req: AuthenticatedRequest) { return this.tableService.patchTable(this.getRestaurantId(req), id, body); }

  @Get('sessions/open')
  getOpenSessions(@Query('branchId') branchId: string, @Req() req: AuthenticatedRequest) { return this.tableService.getOpenSessions(this.getRestaurantId(req), branchId); }
  @Post('sessions/open')
  openSession(@Body() body: { branchId: string; tableId: string }, @Req() req: AuthenticatedRequest) { return this.tableService.openSession(this.getRestaurantId(req), req.user.id, body); }
  @Get('sessions/:id')
  getSessionById(@Param('id') id: string, @Req() req: AuthenticatedRequest) { return this.tableService.getSessionById(this.getRestaurantId(req), id); }
  @Post('sessions/:id/items')
  addSessionItem(@Param('id') id: string, @Body() body: { menuItemId?: string; name: string; quantity: number; unitPrice: string | number; note?: string }, @Req() req: AuthenticatedRequest) { return this.tableService.addSessionItem(this.getRestaurantId(req), id, body); }
  @Patch('sessions/:id/items/:itemId')
  patchSessionItem(@Param('id') id: string, @Param('itemId') itemId: string, @Body() body: { quantity?: number; unitPrice?: string | number; note?: string; status?: TableSessionItemStatus }, @Req() req: AuthenticatedRequest) { return this.tableService.patchSessionItem(this.getRestaurantId(req), id, itemId, body); }
  @Post('sessions/:id/payment-pending')
  paymentPending(@Param('id') id: string, @Req() req: AuthenticatedRequest) { return this.tableService.setPaymentPending(this.getRestaurantId(req), id); }
  @Post('sessions/:id/close')
  closeSession(@Param('id') id: string, @Req() req: AuthenticatedRequest) { return this.tableService.closeSession(this.getRestaurantId(req), id, req.user.id); }
  @Post('sessions/:id/cancel')
  cancelSession(@Param('id') id: string, @Body() body: { reason?: string }, @Req() req: AuthenticatedRequest) { return this.tableService.cancelSession(this.getRestaurantId(req), id, body.reason); }
}
