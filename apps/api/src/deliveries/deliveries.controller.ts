// apps/api/src/deliveries/deliveries.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DeliveriesService } from './deliveries.service';
import { MapboxService } from './mapbox.service';

type AuthReq = Request & { user: { restaurantId: string | null } };

@Controller('deliveries')
@UseGuards(JwtAuthGuard)
export class DeliveriesController {
  constructor(
    private readonly deliveriesService: DeliveriesService,
    private readonly mapboxService: MapboxService,
  ) {}

  @Get('active-couriers')
  listActiveCouriers(@Req() req: AuthReq) {
    if (!req.user.restaurantId) throw new ForbiddenException();
    return this.deliveriesService.listActiveCouriers(req.user.restaurantId);
  }

  @Get('assignments/active')
  listActiveAssignments(@Req() req: AuthReq) {
    if (!req.user.restaurantId) throw new ForbiddenException();
    return this.deliveriesService.listActiveAssignments(req.user.restaurantId);
  }

  @Get('orders/unassigned')
  listUnassigned(@Req() req: AuthReq) {
    if (!req.user.restaurantId) throw new ForbiddenException();
    return this.deliveriesService.listUnassigned(req.user.restaurantId);
  }

  @Post('orders/:orderId/auto-assign')
  autoAssign(@Param('orderId') orderId: string, @Req() req: AuthReq) {
    if (!req.user.restaurantId) throw new ForbiddenException();
    return this.deliveriesService.autoAssign(req.user.restaurantId, orderId);
  }

  @Post('orders/:orderId/assign')
  assign(
    @Param('orderId') orderId: string,
    @Body() body: { courierId: string },
    @Req() req: AuthReq,
  ) {
    if (!req.user.restaurantId) throw new ForbiddenException();
    return this.deliveriesService.assign(req.user.restaurantId, orderId, body.courierId);
  }

  @Post('assignments/:id/cancel')
  cancel(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @Req() req: AuthReq,
  ) {
    if (!req.user.restaurantId) throw new ForbiddenException();
    return this.deliveriesService.cancel(req.user.restaurantId, id, body.reason);
  }

  // Adres geocode (kullanıcı sipariş eklerken / düzenlerken)
  @Get('geocode')
  async geocode(@Query('q') q: string) {
    if (!q) return null;
    return this.mapboxService.geocode(q);
  }
}
