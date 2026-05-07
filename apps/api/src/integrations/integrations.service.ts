import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PlatformType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class IntegrationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findByRestaurant(restaurantId: string) {
    return this.prisma.platformIntegration.findMany({
      where: { restaurantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, restaurantId: string) {
    const integration = await this.prisma.platformIntegration.findUnique({
      where: { id },
    });

    if (!integration || integration.restaurantId !== restaurantId) {
      throw new NotFoundException('Entegrasyon bulunamadi');
    }

    return integration;
  }

  async create(data: {
    restaurantId: string;
    branchId?: string;
    platform: PlatformType;
    name: string;
    supplierId?: string;
    apiKey?: string;
    apiSecret?: string;
    baseUrl?: string;
  }) {
    if (!data.platform) {
      throw new BadRequestException('platform zorunludur');
    }
    if (!data.name) {
      throw new BadRequestException('name zorunludur');
    }

    return this.prisma.platformIntegration.create({
      data: {
        restaurantId: data.restaurantId,
        branchId: data.branchId || null,
        platform: data.platform,
        name: data.name,
        supplierId: data.supplierId || null,
        apiKey: data.apiKey || null,
        apiSecret: data.apiSecret || null,
        baseUrl: data.baseUrl || null,
      },
    });
  }

  async update(id: string, restaurantId: string, data: {
    name?: string;
    branchId?: string;
    supplierId?: string;
    apiKey?: string;
    apiSecret?: string;
    baseUrl?: string;
  }) {
    const integration = await this.findOne(id, restaurantId);

    return this.prisma.platformIntegration.update({
      where: { id: integration.id },
      data: {
        name: data.name !== undefined ? data.name : undefined,
        branchId: data.branchId !== undefined ? data.branchId : undefined,
        supplierId: data.supplierId !== undefined ? data.supplierId : undefined,
        apiKey: data.apiKey !== undefined ? data.apiKey : undefined,
        apiSecret: data.apiSecret !== undefined ? data.apiSecret : undefined,
        baseUrl: data.baseUrl !== undefined ? data.baseUrl : undefined,
      },
    });
  }

  async toggleActive(id: string, restaurantId: string, isActive: boolean) {
    const integration = await this.findOne(id, restaurantId);

    return this.prisma.platformIntegration.update({
      where: { id: integration.id },
      data: { isActive },
    });
  }

  async delete(id: string, restaurantId: string) {
    const integration = await this.findOne(id, restaurantId);

    return this.prisma.platformIntegration.delete({
      where: { id: integration.id },
    });
  }

  async getActiveByPlatform(platform: PlatformType) {
    return this.prisma.platformIntegration.findMany({
      where: { platform, isActive: true },
    });
  }

  async updateSyncStatus(id: string, error?: string) {
    return this.prisma.platformIntegration.update({
      where: { id },
      data: {
        lastSyncAt: new Date(),
        lastError: error || null,
      },
    });
  }
}
