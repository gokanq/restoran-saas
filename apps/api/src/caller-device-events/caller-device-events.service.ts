import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CallerDeviceEventsService {
  constructor(private readonly prisma: PrismaService) {}

  private hashKey(key: string) {
    return createHash('sha256').update(key).digest('hex');
  }

  private normalizePhone(phone?: string | null) {
    return (phone || '').replace(/\D/g, '');
  }

  async createIncomingEvent(
    deviceKey: string | undefined,
    data: {
      phone?: string;
      source?: string;
      payload?: unknown;
    },
  ) {
    const key = (deviceKey || '').trim();

    if (!key) {
      throw new UnauthorizedException('Caller ID cihaz anahtarı eksik.');
    }

    const device = await this.prisma.callerDevice.findFirst({
      where: {
        keyHash: this.hashKey(key),
        isActive: true,
      },
    });

    if (!device) {
      throw new UnauthorizedException('Caller ID cihaz anahtarı geçersiz.');
    }

    const phone = (data.phone || '').trim();

    if (!phone) {
      throw new BadRequestException('Telefon numarası zorunludur.');
    }

    const phoneNormalized = this.normalizePhone(phone);
    const phoneTail = phoneNormalized.length > 10 ? phoneNormalized.slice(-10) : phoneNormalized;

    const phoneConditions: any[] = [{ phoneNormalized }];

    if (phoneTail.length >= 7) {
      phoneConditions.push({
        phoneNormalized: {
          endsWith: phoneTail,
        },
      });
    }

    const customer = await this.prisma.customer.findFirst({
      where: {
        restaurantId: device.restaurantId,
        isActive: true,
        deletedAt: null,
        OR: phoneConditions,
      },
      orderBy: {
        updatedAt: 'desc',
      },
      select: {
        id: true,
        name: true,
      },
    });

    await this.prisma.callerDevice.update({
      where: {
        id: device.id,
      },
      data: {
        lastSeenAt: new Date(),
      },
    });

    return this.prisma.callerEvent.create({
      data: {
        restaurantId: device.restaurantId,
        branchId: device.branchId,
        phone,
        phoneNormalized,
        status: 'NEW',
        source: data.source || `device:${device.name}`,
        customerId: customer?.id || null,
        customerName: customer?.name || null,
        payload: {
          ...(typeof data.payload === 'object' && data.payload !== null ? data.payload : {}),
          deviceId: device.id,
          deviceName: device.name,
        },
      },
    });
  }
}
