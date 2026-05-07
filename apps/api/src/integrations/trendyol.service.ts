import { Injectable, Logger } from '@nestjs/common';
import { PlatformIntegration, PlatformType, OrderType, PaymentMethod } from '@prisma/client';
import axios, { AxiosInstance } from 'axios';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TrendyolService {
  private readonly logger = new Logger(TrendyolService.name);
  private readonly DEFAULT_BASE_URL = 'https://api.trendyol.com/sapigw';

  constructor(private readonly prisma: PrismaService) {}

  private createClient(integration: PlatformIntegration): AxiosInstance {
    const baseURL = integration.baseUrl || this.DEFAULT_BASE_URL;
    const auth = Buffer.from(`${integration.apiKey}:${integration.apiSecret}`).toString('base64');

    return axios.create({
      baseURL,
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
  }

  async testConnection(integration: PlatformIntegration) {
    try {
      const client = this.createClient(integration);
      const response = await client.get(
        `/suppliers/${integration.supplierId}/orders?size=1`,
      );

      return {
        success: true,
        message: 'Bağlantı başarılı',
        totalOrders: response.data?.totalElements || 0,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.errors?.[0]?.message || error.message || 'Bağlantı hatası',
      };
    }
  }

  async syncOrders(integration: PlatformIntegration) {
    try {
      const client = this.createClient(integration);

      // Fetch recent orders (last 24 hours)
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      const response = await client.get(
        `/suppliers/${integration.supplierId}/orders`,
        {
          params: {
            startDate: oneDayAgo,
            endDate: Date.now(),
            size: 200,
            orderByField: 'CreatedDate',
            orderByDirection: 'DESC',
          },
        },
      );

      const orders = response.data?.content || [];
      let synced = 0;
      let skipped = 0;

      for (const trendyolOrder of orders) {
        const result = await this.processOrder(integration, trendyolOrder);
        if (result === 'synced') synced++;
        else skipped++;
      }

      // Update sync status
      await this.prisma.platformIntegration.update({
        where: { id: integration.id },
        data: { lastSyncAt: new Date(), lastError: null },
      });

      this.logger.log(
        `Trendyol sync completed for restaurant ${integration.restaurantId}: ${synced} synced, ${skipped} skipped`,
      );

      return { success: true, synced, skipped, total: orders.length };
    } catch (error: any) {
      const errorMsg = error.response?.data?.errors?.[0]?.message || error.message;
      this.logger.error(`Trendyol sync error: ${errorMsg}`);

      await this.prisma.platformIntegration.update({
        where: { id: integration.id },
        data: { lastSyncAt: new Date(), lastError: errorMsg },
      });

      return { success: false, message: errorMsg };
    }
  }

  private async processOrder(integration: PlatformIntegration, trendyolOrder: any): Promise<'synced' | 'skipped'> {
    const platformOrderId = String(trendyolOrder.orderNumber || trendyolOrder.id);

    // Check if already synced
    const existing = await this.prisma.platformOrder.findUnique({
      where: {
        platform_platformOrderId: {
          platform: PlatformType.TRENDYOL,
          platformOrderId,
        },
      },
    });

    if (existing) return 'skipped';

    // Determine branch
    const branchId = integration.branchId;
    if (!branchId) {
      // Use first branch of restaurant
      const branch = await this.prisma.branch.findFirst({
        where: { restaurantId: integration.restaurantId },
      });
      if (!branch) return 'skipped';
      var resolvedBranchId = branch.id;
    } else {
      var resolvedBranchId = branchId;
    }

    // Map payment method
    const paymentMethod = this.mapPaymentMethod(trendyolOrder.paymentType);

    // Map order type
    const orderType = this.mapOrderType(trendyolOrder);

    // Calculate total
    const total = trendyolOrder.grossAmount
      ? Number(trendyolOrder.grossAmount) / 100
      : trendyolOrder.totalPrice || 0;

    // Build items
    const lines = trendyolOrder.lines || [];
    const items = lines.map((line: any) => ({
      name: line.productName || 'Bilinmeyen Ürün',
      quantity: line.quantity || 1,
      unitPrice: line.price ? Number(line.price) / 100 : 0,
      totalPrice: line.amount ? Number(line.amount) / 100 : 0,
      note: null,
    }));

    // Create order
    const order = await this.prisma.order.create({
      data: {
        restaurantId: integration.restaurantId,
        branchId: resolvedBranchId,
        code: `TY-${platformOrderId}`,
        type: orderType,
        status: 'PENDING',
        total,
        paymentMethod,
        customerName: this.getCustomerName(trendyolOrder),
        customerPhone: trendyolOrder.shipmentAddress?.phone || null,
        customerAddress: this.getAddress(trendyolOrder),
        note: `Trendyol Sipariş #${platformOrderId}`,
        items: {
          create: items,
        },
      },
    });

    // Record platform order
    await this.prisma.platformOrder.create({
      data: {
        restaurantId: integration.restaurantId,
        platform: PlatformType.TRENDYOL,
        platformOrderId,
        platformStatus: trendyolOrder.status || null,
        orderId: order.id,
        rawPayload: trendyolOrder,
      },
    });

    return 'synced';
  }

  private mapPaymentMethod(paymentType?: string): PaymentMethod {
    if (!paymentType) return PaymentMethod.CASH;
    const type = paymentType.toUpperCase();
    if (type.includes('CREDIT') || type.includes('CARD')) return PaymentMethod.CREDIT_CARD;
    if (type.includes('ONLINE')) return PaymentMethod.ONLINE;
    if (type.includes('MEAL')) return PaymentMethod.MEAL_CARD;
    return PaymentMethod.CASH;
  }

  private mapOrderType(order: any): OrderType {
    if (order.deliveryType === 'PICK_UP' || order.deliveryType === 'TAKE_AWAY') {
      return OrderType.TAKEAWAY;
    }
    return OrderType.DELIVERY;
  }

  private getCustomerName(order: any): string | null {
    if (order.shipmentAddress) {
      const { firstName, lastName } = order.shipmentAddress;
      if (firstName || lastName) return `${firstName || ''} ${lastName || ''}`.trim();
    }
    return null;
  }

  private getAddress(order: any): string | null {
    if (!order.shipmentAddress) return null;
    const addr = order.shipmentAddress;
    const parts = [addr.address1, addr.address2, addr.district, addr.city].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : null;
  }
}
