import { Controller, Get, Query } from '@nestjs/common';
import { LocationsService } from './locations.service';

@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get('districts')
  getDistricts(@Query('city') city?: string) {
    return this.locationsService.getDistricts(city || 'Giresun');
  }

  @Get('neighborhoods')
  getNeighborhoods(
    @Query('city') city?: string,
    @Query('district') district?: string,
  ) {
    return this.locationsService.getNeighborhoods(city || 'Giresun', district);
  }
}
