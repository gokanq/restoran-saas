import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PlatformType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TrendyolService } from './trendyol.service';
import { GetirService } from './getir.service';

@Injectable()
export class PlatformSyncService {
  private readonly logger = new Logger(PlatformSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly trendyolService: TrendyolService,
    private readonly getirService: GetirService,
  ) {}

  @Cron('*/5 * * * * *')
  async syncAllPlatforms() {
    this.logger.log('Platform sync started');
    
    const activeIntegrations = await this.prisma.platformIntegration.findMany({
      where: { isActive: true },
    });

    this.logger.log(`Found ${activeIntegrations.length} active integrations`);

    for (const integration of activeIntegrations) {
      try {
        const settings = await this.prisma.restaurantSettings.findUnique({
          where: { restaurantId: integration.restaurantId },
        });

        if (settings && !settings.isOpen) {
          this.logger.log(`Restaurant ${integration.restaurantId} is closed, skipping`);
          continue;
        }

        if (integration.platform === PlatformType.TRENDYOL) {
          this.logger.log(`Syncing Trendyol for restaurant ${integration.restaurantId}`);
          const result = await this.trendyolService.syncOrders(integration);
          this.logger.log(`Trendyol sync result: ${JSON.stringify(result)}`);

          if (result.success && settings?.autoApproveOrders && result.synced && result.synced > 0) {
            this.logger.log(`Auto-approving ${result.synced} new orders`);
            const approved = await this.autoApproveOrders(integration.restaurantId);
            this.logger.log(`Auto-approved ${approved.count} orders`);
          }
        }

        if (integration.platform === PlatformType.GETIR) {
          this.logger.log(`Syncing Getir for restaurant ${integration.restaurantId}`);
          const result = await this.getirService.syncOrders(integration);
          this.logger.log(`Getir sync result: ${JSON.stringify(result)}`);

          if (result.success && settings?.autoApproveOrders && result.synced && result.synced > 0) {
            this.logger.log(`Auto-approving ${result.synced} new Getir orders`);
            const approved = await this.autoApproveOrders(integration.restaurantId);
            this.logger.log(`Auto-approved ${approved.count} orders`);
          }
        }
      } catch (error: any) {
        this.logger.error(
          `Sync failed for integration ${integration.id}: ${error.message}`,
        );
      }
    }
  }

  private async autoApproveOrders(restaurantId: string) {
    return this.prisma.order.updateMany({
      where: {
        restaurantId,
        status: 'PENDING',
      },
      data: {
        status: 'ACCEPTED',
      },
    });
  }
}
