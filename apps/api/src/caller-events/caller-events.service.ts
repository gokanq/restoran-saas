import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type CreateCallerEventInput = {
  branchId?: string | null;
  phone?: string | null;
  source?: string | null;
  payload?: unknown;
};

type MarkCallerEventConvertedInput = {
  orderId?: string | null;
  orderCode?: string | null;
};

function normalizePhone(phone?: string | null) {
  return (phone || '').replace(/\D/g, '');
}

@Injectable()
export class CallerEventsService {
  constructor(private readonly prisma: PrismaService) {}

  private async findCustomerByPhone(restaurantId: string, phone: string) {
    const phoneNormalized = normalizePhone(phone);
    const phoneTail = phoneNormalized.length > 10 ? phoneNormalized.slice(-10) : phoneNormalized;

    if (!phoneNormalized) {
      return null;
    }

    return this.prisma.customer.findFirst({
      where: {
        restaurantId,
        isActive: true,
        deletedAt: null,
        OR: [
          {
            phoneNormalized,
          },
          ...(phoneTail.length >= 7
            ? [
                {
                  phoneNormalized: {
                    endsWith: phoneTail,
                  },
                },
              ]
            : []),
        ],
      },
      select: {
        id: true,
        name: true,
        phone: true,
        phoneNormalized: true,
      },
    });
  }

  async createIncomingCall(restaurantId: string, data: CreateCallerEventInput) {
    const phone = (data.phone || '').trim();

    if (!phone) {
      throw new BadRequestException('Telefon numarası zorunludur');
    }

    const phoneNormalized = normalizePhone(phone);
    const customer = await this.findCustomerByPhone(restaurantId, phone);

    return this.prisma.callerEvent.create({
      data: {
        restaurantId,
        branchId: data.branchId || null,
        phone,
        phoneNormalized: phoneNormalized || null,
        source: data.source || 'manual',
        customerId: customer?.id || null,
        customerName: customer?.name || null,
        payload: data.payload === undefined ? undefined : (data.payload as object),
      },
    });
  }

  async findLatest(restaurantId: string) {
    return this.prisma.callerEvent.findFirst({
      where: {
        restaurantId,
        status: 'NEW',
        seenAt: null,
      },
      orderBy: {
        receivedAt: 'desc',
      },
    });
  }

  async findRecent(restaurantId: string) {
    return this.prisma.callerEvent.findMany({
      where: {
        restaurantId,
      },
      orderBy: {
        receivedAt: 'desc',
      },
      take: 20,
    });
  }

  async markSeen(restaurantId: string, id: string) {
    const event = await this.prisma.callerEvent.findFirst({
      where: {
        id,
        restaurantId,
      },
    });

    if (!event) {
      throw new NotFoundException('Caller ID olayı bulunamadı');
    }

    return this.prisma.callerEvent.update({
      where: {
        id,
      },
      data: {
        status: 'SEEN',
        seenAt: new Date(),
      },
    });
  }
  async markConverted(restaurantId: string, id: string, data: MarkCallerEventConvertedInput) {
    const event = await this.prisma.callerEvent.findFirst({
      where: {
        id,
        restaurantId,
      },
    });

    if (!event) {
      throw new NotFoundException('Caller ID olayı bulunamadı');
    }

    const orderId = (data.orderId || '').trim();
    const orderCode = (data.orderCode || '').trim();

    if (!orderId && !orderCode) {
      throw new BadRequestException('Sipariş bilgisi zorunludur');
    }

    const order = await this.prisma.order.findFirst({
      where: {
        restaurantId,
        ...(orderId ? { id: orderId } : { code: orderCode }),
      },
      select: {
        id: true,
        code: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Sipariş bulunamadı');
    }

    return this.prisma.callerEvent.update({
      where: {
        id,
      },
      data: {
        status: 'SEEN',
        seenAt: event.seenAt || new Date(),
        orderId: order.id,
        orderCode: order.code,
        convertedAt: new Date(),
      },
    });
  }

}
