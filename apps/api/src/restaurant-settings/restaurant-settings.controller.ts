import { Controller, Get, Patch, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

@Controller('restaurant-settings')
@UseGuards(JwtAuthGuard)
export class RestaurantSettingsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getSettings(@Request() req: any) {
    const restaurantId = req.user.restaurantId;

    let settings = await this.prisma.restaurantSettings.findUnique({
      where: { restaurantId },
    });

    if (!settings) {
      settings = await this.prisma.restaurantSettings.create({
        data: { restaurantId },
      });
    }

    return settings;
  }

  @Patch()
  async updateSettings(@Request() req: any, @Body() body: any) {
    const restaurantId = req.user.restaurantId;

    const data: any = {};
    if (typeof body.isOpen === 'boolean') data.isOpen = body.isOpen;
    if (typeof body.autoApproveOrders === 'boolean') data.autoApproveOrders = body.autoApproveOrders;
    if (typeof body.notificationSound === 'string') data.notificationSound = body.notificationSound;
    if (typeof body.notificationVolume === 'number') data.notificationVolume = body.notificationVolume;

    return this.prisma.restaurantSettings.upsert({
      where: { restaurantId },
      create: { restaurantId, ...data },
      update: data,
    });
  }
}
