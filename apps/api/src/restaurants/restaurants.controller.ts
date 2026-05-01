import { Body, Controller, Get, Post } from '@nestjs/common';
import { RestaurantsService } from './restaurants.service';

@Controller('restaurants')
export class RestaurantsController {
  constructor(private readonly restaurantsService: RestaurantsService) {}

  @Get()
  findAll() {
    return this.restaurantsService.findAll();
  }

  @Post()
  create(@Body() body: { name: string; slug: string }) {
    return this.restaurantsService.create(body);
  }
}
