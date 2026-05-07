import { Injectable, Logger } from '@nestjs/common';
import { PlatformIntegration, PlatformType, OrderType, PaymentMethod } from '@prisma/client';
import axios, { AxiosInstance } from 'axios';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GetirService {
  private readonly logger = new Logger(GetirService.name);
  private readonly DEFAULT_BASE_URL = 'https://food-external-api-gateway.getirapi.com';

  constructor(private readonly prisma: PrismaService) {}

  private createClient(integration: PlatformIntegration): AxiosInstance {
    const baseURL = integration.baseUrl || this.DEFAULT_BASE_URL;
    return axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${integration.apiKey}`,
      },
      timeout: 30000,
    });
  }

  async testConnection(integration: PlatformIntegration) {
    try {
      const client = this.createClient(integration);
      const response = await client.get('/restaurants/v1/restaurants');
      return {
        success: true,
        message: 'Bağlantı başarılı',
        restaurants: response.data?.restaurants?.length || 0,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Bağlantı hatası',
      };
    }
  }

  async syncOrders(integration: PlatformIntegration) {
    try {
      const client = this.createClient(integration);
      const response = await client.get('/orders/v1/orders', {
        params: { status: 'CREATED' },
      });

      const orders = response.data?.orders || [];
      let synced = 0;
      let skipped = 0;

      for (const getirOrder of orders) {
        const result = await this.processOrder(integration, getirOrder);
        if (result === 'synced') synced++;
        else skipped++;
      }

      await this.prisma.platformIntegration.update({
        where: { id: integration.id },
        data: { lastSyncAt: new Date(), lastError: null },
      });

      this.logger.log(
        `Getir sync completed for restaurant ${integration.restaurantId}: ${synced} synced, ${skipped} skipped`,
      );

      return { success: true, synced, skipped, total: orders.length };
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message;
      this.logger.error(`Getir sync error: ${errorMsg}`);

      await this.prisma.platformIntegration.update({
        where: { id: integration.id },
        data: { lastSyncAt: new Date(), lastError: errorMsg },
      });

      return { success: false, message: errorMsg };
    }
  }

  private async processOrder(integration: PlatformIntegration, getirOrder: any): Promise<'synced' | 'skipped'> {
    const platformOrderId = String(getirOrder.id);

    const existing = await this.prisma.platformOrder.findUnique({
      where: {
        platform_platformOrderId: {
          platform: PlatformType.GETIR,
          platformOrderId,
        },
      },
    });

    if (existing) return 'skipped';

    const branchId = integration.branchId;
    let resolvedBranchId: string;

    if (!branchId) {
      const branch = await this.prisma.branch.findFirst({
        where: { restaurantId: integration.restaurantId },
      });
      if (!branch) return 'skipped';
      resolvedBranchId = branch.id;
    } else {
      resolvedBranchId = branchId;
    }

    const paymentMethod = this.mapPaymentMethod(getirOrder.paymentMethod);
    const orderType = this.mapOrderType(getirOrder);
    const total = getirOrder.totalPrice || 0;

    const items = (getirOrder.products || []).map((product: any) => ({
      name: product.name || 'Bilinmeyen Ürün',
      quantity: product.quantity || 1,
      unitPrice: product.unitPrice || 0,
      totalPrice: (product.unitPrice || 0) * (product.quantity || 1),
      note: product.note || null,
    }));

    const order = await this.prisma.order.create({
      data: {
        restaurantId: integration.restaurantId,
        branchId: resolvedBranchId,
        code: `GR-${platformOrderId.slice(-6)}`,
        type: orderType,
        status: 'PENDING',
        total,
        paymentMethod,
        customerName: getirOrder.customer?.name || null,
        customerPhone: getirOrder.customer?.phoneNumber || null,
        customerAddress: this.getAddress(getirOrder),
        note: `Getir Sipariş #${platformOrderId.slice(-6)}`,
        items: {
          create: items,
        },
      },
    });

    await this.prisma.platformOrder.create({
      data: {
        restaurantId: integration.restaurantId,
        platform: PlatformType.GETIR,
        platformOrderId,
        platformStatus: getirOrder.status || null,
        orderId: order.id,
        rawPayload: getirOrder,
      },
    });

    return 'synced';
  }

  private mapPaymentMethod(paymentMethod?: string): PaymentMethod {
    if (!paymentMethod) return PaymentMethod.CASH;
    const type = paymentMethod.toUpperCase();
    if (type.includes('CREDIT') || type.includes('CARD')) return PaymentMethod.CREDIT_CARD;
    if (type.includes('ONLINE')) return PaymentMethod.ONLINE;
    return PaymentMethod.CASH;
  }

  private mapOrderType(order: any): OrderType {
    if (order.isTakeaway || order.deliveryType === 'PICKUP') {
      return OrderType.TAKEAWAY;
    }
    return OrderType.DELIVERY;
  }

  private getAddress(order: any): string | null {
    if (!order.address) return null;
    const addr = order.address;
    const parts = [addr.addressLine, addr.district, addr.city].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : null;
  }
}
