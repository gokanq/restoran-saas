// apps/api/src/deliveries/deliveries.service.ts
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MapboxService } from './mapbox.service';

@Injectable()
export class DeliveriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapbox: MapboxService,
  ) {}

  // Tüm aktif (online) kuryeleri konum + durum ile döner
  async listActiveCouriers(restaurantId: string) {
    return this.prisma.courier.findMany({
      where: { restaurantId, isActive: true },
      select: {
        id: true,
        name: true,
        phone: true,
        latitude: true,
        longitude: true,
        isOnline: true,
        isAvailable: true,
        lastLocationAt: true,
        assignments: {
          where: {
            status: { in: ['ASSIGNED', 'ACCEPTED', 'PICKED_UP', 'DELIVERING'] },
          },
          select: {
            id: true,
            orderId: true,
            status: true,
            distance: true,
            duration: true,
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
              },
            },
          },
        },
      },
      orderBy: [{ isOnline: 'desc' }, { name: 'asc' }],
    });
  }

  // Bir siparişe en yakın müsait kuryeyi otomatik atar
  async autoAssign(restaurantId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, restaurantId },
      include: { branch: true, assignment: true },
    });

    if (!order) throw new NotFoundException('Sipariş bulunamadı');
    if (order.assignment) throw new BadRequestException('Bu siparişe zaten atama yapılmış');
    if (order.type !== 'DELIVERY') throw new BadRequestException('Sadece teslimat siparişleri atanabilir');

    const dropLat = order.deliveryLat ? Number(order.deliveryLat) : null;
    const dropLng = order.deliveryLng ? Number(order.deliveryLng) : null;
    const pickLat = order.branch.latitude ? Number(order.branch.latitude) : null;
    const pickLng = order.branch.longitude ? Number(order.branch.longitude) : null;

    // Müsait, online kuryeleri bul
    const couriers = await this.prisma.courier.findMany({
      where: {
        restaurantId,
        isActive: true,
        isOnline: true,
        isAvailable: true,
        latitude: { not: null },
        longitude: { not: null },
      },
    });

    if (couriers.length === 0) throw new BadRequestException('Müsait online kurye bulunamadı');

    // En yakın kuryeyi bul (Haversine)
    let bestCourier = couriers[0];
    let bestDistance = Infinity;

    if (pickLat && pickLng) {
      for (const c of couriers) {
        const lat = Number(c.latitude);
        const lng = Number(c.longitude);
        const d = this.mapbox.haversine(lat, lng, pickLat, pickLng);
        if (d < bestDistance) {
          bestDistance = d;
          bestCourier = c;
        }
      }
    }

    return this.assign(restaurantId, orderId, bestCourier.id);
  }

  // Manuel atama
  async assign(restaurantId: string, orderId: string, courierId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, restaurantId },
      include: { branch: true, assignment: true },
    });

    if (!order) throw new NotFoundException('Sipariş bulunamadı');
    if (order.assignment) throw new BadRequestException('Bu siparişe zaten atama yapılmış');

    const courier = await this.prisma.courier.findFirst({
      where: { id: courierId, restaurantId, isActive: true },
    });

    if (!courier) throw new NotFoundException('Kurye bulunamadı');

    // Mapbox ile rota hesapla (varsa koordinatlar)
    const pickLat = order.branch.latitude ? Number(order.branch.latitude) : null;
    const pickLng = order.branch.longitude ? Number(order.branch.longitude) : null;
    const dropLat = order.deliveryLat ? Number(order.deliveryLat) : null;
    const dropLng = order.deliveryLng ? Number(order.deliveryLng) : null;

    let distance: number | null = null;
    let duration: number | null = null;
    let geometry: string | null = null;

    if (pickLat && pickLng && dropLat && dropLng) {
      const dir = await this.mapbox.getDirections(pickLat, pickLng, dropLat, dropLng);
      if (dir) {
        distance = dir.distance;
        duration = dir.duration;
        geometry = dir.geometry || null;
      }
    }

    // Kazanç hesabı: km başına perPackageFee veya sabit
    const earnings = Number(courier.perPackageFee) || 0;

    const assignment = await this.prisma.deliveryAssignment.create({
      data: {
        restaurantId,
        branchId: order.branchId,
        orderId,
        courierId,
        status: 'ASSIGNED',
        distance,
        duration,
        routeGeometry: geometry,
        pickupLat: pickLat,
        pickupLng: pickLng,
        dropoffLat: dropLat,
        dropoffLng: dropLng,
        earnings,
      },
      include: {
        order: { select: { code: true, customerName: true, customerAddress: true } },
        courier: { select: { name: true, phone: true } },
      },
    });

    // Order'a courierId/courierName güncelle
    await this.prisma.order.update({
      where: { id: orderId },
      data: { courierId, courierName: courier.name, status: 'ON_DELIVERY' },
    });

    return assignment;
  }

  // Atamayı iptal et
  async cancel(restaurantId: string, assignmentId: string, reason?: string) {
    const assignment = await this.prisma.deliveryAssignment.findFirst({
      where: { id: assignmentId, restaurantId },
    });
    if (!assignment) throw new NotFoundException('Atama bulunamadı');
    if (['DELIVERED', 'CANCELLED'].includes(assignment.status))
      throw new BadRequestException('Bu atama tamamlanmış veya iptal edilmiş');

    const updated = await this.prisma.deliveryAssignment.update({
      where: { id: assignmentId },
      data: { status: 'CANCELLED', cancelledAt: new Date(), rejectionReason: reason || null },
    });

    await this.prisma.order.update({
      where: { id: assignment.orderId },
      data: { courierId: null, courierName: null, status: 'READY' },
    });

    return updated;
  }

  // Aktif teslimatları liste
  async listActiveAssignments(restaurantId: string) {
    return this.prisma.deliveryAssignment.findMany({
      where: {
        restaurantId,
        status: { in: ['PENDING', 'ASSIGNED', 'ACCEPTED', 'PICKED_UP', 'DELIVERING'] },
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
          },
        },
        courier: {
          select: { id: true, name: true, phone: true, latitude: true, longitude: true },
        },
      },
      orderBy: { assignedAt: 'desc' },
    });
  }

  // Atanmamış DELIVERY siparişlerini listele
  async listUnassigned(restaurantId: string) {
    return this.prisma.order.findMany({
      where: {
        restaurantId,
        type: 'DELIVERY',
        status: { in: ['PENDING', 'ACCEPTED', 'PREPARING', 'READY'] },
        assignment: null,
      },
      select: {
        id: true,
        code: true,
        status: true,
        customerName: true,
        customerPhone: true,
        customerAddress: true,
        deliveryLat: true,
        deliveryLng: true,
        total: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}
