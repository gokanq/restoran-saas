import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, OrderType, PaymentMethod } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const ORDER_STATUSES = Object.values(OrderStatus);
const ORDER_TYPES = Object.values(OrderType);
const PAYMENT_METHODS = Object.values(PaymentMethod);

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
        items: {
          orderBy: {
            createdAt: 'asc',
          },
        },
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
        items: {
          orderBy: {
            createdAt: 'asc',
          },
        },
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
    tableNumber?: string;
    status?: OrderStatus;
    total?: string | number;
    paymentMethod?: PaymentMethod;
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

    const orderType = data.type ?? OrderType.DELIVERY;
    const paymentMethod = data.paymentMethod ?? PaymentMethod.CASH;

    if (data.paymentMethod && !PAYMENT_METHODS.includes(data.paymentMethod)) {
      throw new BadRequestException('Geçersiz ödeme tipi');
    }

    const tableNumber = optionalText(data.tableNumber);

    if (orderType === OrderType.TABLE && !tableNumber) {
      throw new BadRequestException('Masa siparişlerinde masa numarası zorunludur');
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
        type: orderType,
        tableNumber: orderType === OrderType.TABLE ? tableNumber : null,
        status: data.status,
        paymentMethod,
        total: data.total ?? 0,
        customerName: optionalText(data.customerName),
        customerPhone: optionalText(data.customerPhone),
        customerAddress: orderType === OrderType.DELIVERY ? optionalText(data.customerAddress) : null,
        note: optionalText(data.note),
      },
      include: {
        branch: true,
        items: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });
  }

  async updateStatus(data: {
    orderId: string;
    restaurantId: string;
    status: OrderStatus;
    courierId?: string | null;
    courierName?: string | null;
  }) {
    if (!data.status) {
      throw new BadRequestException('status zorunludur');
    }

    if (!ORDER_STATUSES.includes(data.status)) {
      throw new BadRequestException('Geçersiz sipariş durumu');
    }

    let courierSnapshotName: string | null | undefined;

    if (data.status === OrderStatus.ON_DELIVERY) {
      if (optionalText(data.courierId)) {
        const courier = await this.prisma.courier.findFirst({
          where: {
            id: optionalText(data.courierId) || undefined,
            restaurantId: data.restaurantId,
            isActive: true,
          },
        });

        if (!courier) {
          throw new BadRequestException('Aktif kurye bulunamadı');
        }

        courierSnapshotName = courier.name;
      } else if (optionalText(data.courierName)) {
        courierSnapshotName = optionalText(data.courierName);
      } else {
        throw new BadRequestException('Yola çıkarılan sipariş için kurye seçimi zorunludur');
      }
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
        courierId:
          data.status === OrderStatus.ON_DELIVERY && optionalText(data.courierId)
            ? optionalText(data.courierId) || undefined
            : undefined,
        courierName: data.status === OrderStatus.ON_DELIVERY ? courierSnapshotName : undefined,
      },
      include: {
        branch: true,
        items: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });
  }
}
