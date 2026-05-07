import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IntegrationsService } from './integrations.service';
import { TrendyolService } from './trendyol.service';
import { GetirService } from './getir.service';
import { PlatformType } from '@prisma/client';

@Controller('integrations')
@UseGuards(JwtAuthGuard)
export class IntegrationsController {
  constructor(
    private readonly integrationsService: IntegrationsService,
    private readonly trendyolService: TrendyolService,
    private readonly getirService: GetirService,
  ) {}

  @Get()
  findAll(@Request() req: any) {
    return this.integrationsService.findByRestaurant(req.user.restaurantId);
  }

  @Post()
  create(@Request() req: any, @Body() body: any) {
    return this.integrationsService.create({
      restaurantId: req.user.restaurantId,
      branchId: body.branchId,
      platform: body.platform,
      name: body.name,
      supplierId: body.supplierId,
      apiKey: body.apiKey,
      apiSecret: body.apiSecret,
      baseUrl: body.baseUrl,
    });
  }

  @Put(':id')
  update(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.integrationsService.update(id, req.user.restaurantId, {
      name: body.name,
      branchId: body.branchId,
      supplierId: body.supplierId,
      apiKey: body.apiKey,
      apiSecret: body.apiSecret,
      baseUrl: body.baseUrl,
    });
  }

  @Patch(':id/toggle')
  toggleActive(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.integrationsService.toggleActive(id, req.user.restaurantId, body.isActive);
  }

  @Delete(':id')
  delete(@Request() req: any, @Param('id') id: string) {
    return this.integrationsService.delete(id, req.user.restaurantId);
  }

  @Post(':id/test')
  async testConnection(@Request() req: any, @Param('id') id: string) {
    const integration = await this.integrationsService.findOne(id, req.user.restaurantId);

    if (integration.platform === PlatformType.TRENDYOL) {
      return this.trendyolService.testConnection(integration);
    }
    if (integration.platform === PlatformType.GETIR) {
      return this.getirService.testConnection(integration);
    }

    return { success: false, message: 'Bu platform henuz desteklenmiyor' };
  }

  @Post(':id/sync')
  async syncNow(@Request() req: any, @Param('id') id: string) {
    const integration = await this.integrationsService.findOne(id, req.user.restaurantId);

    if (integration.platform === PlatformType.TRENDYOL) {
      return this.trendyolService.syncOrders(integration);
    }
    if (integration.platform === PlatformType.GETIR) {
      return this.getirService.syncOrders(integration);
    }

    return { success: false, message: 'Bu platform henuz desteklenmiyor' };
  }
}
