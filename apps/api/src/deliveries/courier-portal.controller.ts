// apps/api/src/deliveries/courier-portal.controller.ts
import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CourierAuthService } from './courier-auth.service';

@Controller('courier-portal')
export class CourierPortalController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: CourierAuthService,
  ) {}

  // Kurye kendi profil + atamalarını çeker
  @Get('me')
  async me(@Headers('x-courier-token') token: string) {
    const courier = await this.authService.validateToken(token);
    return {
      id: courier.id,
      name: courier.name,
      phone: courier.phone,
      isOnline: courier.isOnline,
      isAvailable: courier.isAvailable,
      latitude: courier.latitude,
      longitude: courier.longitude,
    };
  }

  // Kurye konumunu günceller
  @Post('location')
  async updateLocation(
    @Headers('x-courier-token') token: string,
    @Body() body: { latitude: number; longitude: number },
  ) {
    const courier = await this.authService.validateToken(token);
    if (typeof body.latitude !== 'number' || typeof body.longitude !== 'number') {
      throw new UnauthorizedException('Geçersiz konum');
    }
    return this.prisma.courier.update({
      where: { id: courier.id },
      data: {
        latitude: body.latitude,
        longitude: body.longitude,
        lastLocationAt: new Date(),
        isOnline: true,
      },
      select: { id: true, latitude: true, longitude: true, lastLocationAt: true },
    });
  }

  // Müsaitlik durumu
  @Post('availability')
  async setAvailability(
    @Headers('x-courier-token') token: string,
    @Body() body: { isAvailable: boolean },
  ) {
    const courier = await this.authService.validateToken(token);
    return this.prisma.courier.update({
      where: { id: courier.id },
      data: { isAvailable: body.isAvailable },
      select: { id: true, isAvailable: true },
    });
  }

  // Kuryenin aktif atamaları
  @Get('assignments')
  async myAssignments(@Headers('x-courier-token') token: string) {
    const courier = await this.authService.validateToken(token);
    return this.prisma.deliveryAssignment.findMany({
      where: {
        courierId: courier.id,
        status: { in: ['ASSIGNED', 'ACCEPTED', 'PICKED_UP', 'DELIVERING'] },
      },
      include: {
        order: {
          select: {
            id: true,
            code: true,
            customerName: true,
            customerPhone: true,
            customerAddress: true,
            deliveryLat: true,
            deliveryLng: true,
            total: true,
            paymentMethod: true,
            note: true,
          },
        },
      },
      orderBy: { assignedAt: 'desc' },
    });
  }

  // Geçmiş atamalar (son 20)
  @Get('assignments/history')
  async assignmentHistory(@Headers('x-courier-token') token: string) {
    const courier = await this.authService.validateToken(token);
    return this.prisma.deliveryAssignment.findMany({
      where: {
        courierId: courier.id,
        status: { in: ['DELIVERED', 'CANCELLED', 'REJECTED'] },
      },
      include: {
        order: {
          select: { code: true, customerName: true, customerAddress: true, total: true },
        },
      },
      orderBy: { assignedAt: 'desc' },
      take: 20,
    });
  }

  // Atamayı kabul et
  @Post('assignments/:id/accept')
  async accept(
    @Headers('x-courier-token') token: string,
    @Param('id') id: string,
  ) {
    const courier = await this.authService.validateToken(token);
    const a = await this.prisma.deliveryAssignment.findFirst({
      where: { id, courierId: courier.id },
    });
    if (!a) throw new UnauthorizedException();
    return this.prisma.deliveryAssignment.update({
      where: { id },
      data: { status: 'ACCEPTED', acceptedAt: new Date() },
    });
  }

  // Restoraandan aldı
  @Post('assignments/:id/picked-up')
  async pickedUp(
    @Headers('x-courier-token') token: string,
    @Param('id') id: string,
  ) {
    const courier = await this.authService.validateToken(token);
    const a = await this.prisma.deliveryAssignment.findFirst({
      where: { id, courierId: courier.id },
    });
    if (!a) throw new UnauthorizedException();
    return this.prisma.deliveryAssignment.update({
      where: { id },
      data: { status: 'PICKED_UP', pickedUpAt: new Date() },
    });
  }

  // Yola çıktı
  @Post('assignments/:id/delivering')
  async delivering(
    @Headers('x-courier-token') token: string,
    @Param('id') id: string,
  ) {
    const courier = await this.authService.validateToken(token);
    const a = await this.prisma.deliveryAssignment.findFirst({
      where: { id, courierId: courier.id },
    });
    if (!a) throw new UnauthorizedException();
    return this.prisma.deliveryAssignment.update({
      where: { id },
      data: { status: 'DELIVERING' },
    });
  }

  // Teslim edildi
  @Post('assignments/:id/delivered')
  async delivered(
    @Headers('x-courier-token') token: string,
    @Param('id') id: string,
  ) {
    const courier = await this.authService.validateToken(token);
    const a = await this.prisma.deliveryAssignment.findFirst({
      where: { id, courierId: courier.id },
    });
    if (!a) throw new UnauthorizedException();

    const updated = await this.prisma.deliveryAssignment.update({
      where: { id },
      data: { status: 'DELIVERED', deliveredAt: new Date() },
    });

    // Order'ı DELIVERED yap
    await this.prisma.order.update({
      where: { id: a.orderId },
      data: { status: 'DELIVERED' },
    });

    return updated;
  }

  // Reddet
  @Post('assignments/:id/reject')
  async reject(
    @Headers('x-courier-token') token: string,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    const courier = await this.authService.validateToken(token);
    const a = await this.prisma.deliveryAssignment.findFirst({
      where: { id, courierId: courier.id },
    });
    if (!a) throw new UnauthorizedException();

    const updated = await this.prisma.deliveryAssignment.update({
      where: { id },
      data: {
        status: 'REJECTED',
        cancelledAt: new Date(),
        rejectionReason: body.reason || null,
      },
    });

    // Order'ı READY'e geri al, courier bağını kopar
    await this.prisma.order.update({
      where: { id: a.orderId },
      data: { courierId: null, courierName: null, status: 'READY' },
    });

    return updated;
  }
}
