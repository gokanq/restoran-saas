import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, OrderType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const ORDER_STATUSES = Object.values(OrderStatus);
const ORDER_TYPES = Object.values(OrderType);

function optionalText(value?: string | null) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : null;
}

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

  async findOneByRestaurant(orderId: string, restaurantId: string) {
    const order = await this.prisma.order.findUnique({
      where: {
        id: orderId,
      },
      include: {
        branch: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Sipariş bulunamadı');
    }

    if (order.restaurantId !== restaurantId) {
      throw new ForbiddenException('Bu siparişi görüntüleme yetkiniz yok');
    }

    return order;
  }

  async create(data: {
    restaurantId: string;
    branchId: string;
    code: string;
    type?: OrderType;
    status?: OrderStatus;
    total?: string | number;
    customerName?: string;
    customerPhone?: string;
    customerAddress?: string;
    note?: string;
  }) {
    if (!data.branchId) {
      throw new BadRequestException('branchId zorunludur');
    }

    if (!data.code) {
      throw new BadRequestException('code zorunludur');
    }

    if (data.type && !ORDER_TYPES.includes(data.type)) {
      throw new BadRequestException('Geçersiz sipariş tipi');
    }

    if (data.status && !ORDER_STATUSES.includes(data.status)) {
      throw new BadRequestException('Geçersiz sipariş durumu');
    }

    if (data.total !== undefined && Number(data.total) < 0) {
      throw new BadRequestException('total negatif olamaz');
    }

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
        code: data.code.trim(),
        type: data.type ?? OrderType.DELIVERY,
        status: data.status,
        total: data.total ?? 0,
        customerName: optionalText(data.customerName),
        customerPhone: optionalText(data.customerPhone),
        customerAddress: optionalText(data.customerAddress),
        note: optionalText(data.note),
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
    if (!data.status) {
      throw new BadRequestException('status zorunludur');
    }

    if (!ORDER_STATUSES.includes(data.status)) {
      throw new BadRequestException('Geçersiz sipariş durumu');
    }

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
