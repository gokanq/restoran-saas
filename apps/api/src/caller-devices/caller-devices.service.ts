import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CallerDevicesService {
  constructor(private readonly prisma: PrismaService) {}

  private hashKey(key: string) {
    return createHash('sha256').update(key).digest('hex');
  }

  async list(restaurantId: string) {
    return this.prisma.callerDevice.findMany({
      where: {
        restaurantId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        restaurantId: true,
        branchId: true,
        name: true,
        keyPreview: true,
        isActive: true,
        lastSeenAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async create(restaurantId: string, data: { name?: string; branchId?: string | null }) {
    const name = (data.name || '').trim();

    if (!name) {
      throw new BadRequestException('Cihaz adı zorunludur.');
    }

    const branchId = (data.branchId || '').trim() || null;

    if (branchId) {
      const branch = await this.prisma.branch.findFirst({
        where: {
          id: branchId,
          restaurantId,
        },
      });

      if (!branch) {
        throw new BadRequestException('Şube bulunamadı.');
      }
    }

    const deviceKey = `cid_${randomBytes(32).toString('hex')}`;
    const keyPreview = `${deviceKey.slice(0, 10)}...${deviceKey.slice(-6)}`;

    const device = await this.prisma.callerDevice.create({
      data: {
        restaurantId,
        branchId,
        name,
        keyHash: this.hashKey(deviceKey),
        keyPreview,
      },
      select: {
        id: true,
        restaurantId: true,
        branchId: true,
        name: true,
        keyPreview: true,
        isActive: true,
        lastSeenAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      ...device,
      deviceKey,
      message: 'Cihaz anahtarı sadece bu cevapta gösterilir. Güvenli bir yere kaydedin.',
    };
  }

  async deactivate(restaurantId: string, id: string) {
    const device = await this.prisma.callerDevice.findFirst({
      where: {
        id,
        restaurantId,
      },
    });

    if (!device) {
      throw new NotFoundException('Cihaz bulunamadı.');
    }

    return this.prisma.callerDevice.update({
      where: {
        id,
      },
      data: {
        isActive: false,
      },
      select: {
        id: true,
        restaurantId: true,
        branchId: true,
        name: true,
        keyPreview: true,
        isActive: true,
        lastSeenAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async activate(restaurantId: string, id: string) {
    const device = await this.prisma.callerDevice.findFirst({
      where: {
        id,
        restaurantId,
      },
    });

    if (!device) {
      throw new NotFoundException('Cihaz bulunamadı.');
    }

    return this.prisma.callerDevice.update({
      where: {
        id,
      },
      data: {
        isActive: true,
      },
      select: {
        id: true,
        restaurantId: true,
        branchId: true,
        name: true,
        keyPreview: true,
        isActive: true,
        lastSeenAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }
}
