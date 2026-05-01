import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  findByRestaurant(restaurantId: string) {
    return this.prisma.order.findMany({
      where: {
        restaurantId,
      },
      include: {
        branch: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async create(data: {
    restaurantId: string;
    branchId: string;
    code: string;
    status?: OrderStatus;
    total?: string | number;
  }) {
    const branch = await this.prisma.branch.findUnique({
      where: {
        id: data.branchId,
      },
      select: {
        id: true,
        restaurantId: true,
      },
    });

    if (!branch) {
      throw new NotFoundException('Şube bulunamadı');
    }

    if (branch.restaurantId !== data.restaurantId) {
      throw new ForbiddenException('Bu şube için sipariş oluşturma yetkiniz yok');
    }

    return this.prisma.order.create({
      data: {
        restaurantId: data.restaurantId,
        branchId: data.branchId,
        code: data.code,
        status: data.status,
        total: data.total ?? 0,
      },
      include: {
        branch: true,
      },
    });
  }

  async updateStatus(data: {
    orderId: string;
    restaurantId: string;
    status: OrderStatus;
  }) {
    const order = await this.prisma.order.findUnique({
      where: {
        id: data.orderId,
      },
      select: {
        id: true,
        restaurantId: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Sipariş bulunamadı');
    }

    if (order.restaurantId !== data.restaurantId) {
      throw new ForbiddenException('Bu siparişi güncelleme yetkiniz yok');
    }

    return this.prisma.order.update({
      where: {
        id: data.orderId,
      },
      data: {
        status: data.status,
      },
      include: {
        branch: true,
      },
    });
  }
}
