import { Body, Controller, Get, Param, Patch, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CallerDevicesService } from './caller-devices.service';

type AuthenticatedRequest = {
  user?: {
    restaurantId?: string;
  };
};

@Controller('caller-devices')
@UseGuards(JwtAuthGuard)
export class CallerDevicesController {
  constructor(private readonly callerDevicesService: CallerDevicesService) {}

  private getRestaurantId(request: AuthenticatedRequest) {
    const restaurantId = request.user?.restaurantId;

    if (!restaurantId) {
      throw new UnauthorizedException('Restoran bilgisi bulunamadı.');
    }

    return restaurantId;
  }

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.callerDevicesService.list(this.getRestaurantId(request));
  }

  @Post()
  create(
    @Req() request: AuthenticatedRequest,
    @Body() body: { name?: string; branchId?: string | null },
  ) {
    return this.callerDevicesService.create(this.getRestaurantId(request), body);
  }

  @Patch(':id/deactivate')
  deactivate(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.callerDevicesService.deactivate(this.getRestaurantId(request), id);
  }

  @Patch(':id/activate')
  activate(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.callerDevicesService.activate(this.getRestaurantId(request), id);
  }
}
