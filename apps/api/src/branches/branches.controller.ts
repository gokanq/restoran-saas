import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { BranchesService } from './branches.service';

@Controller()
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get('branches')
  findAll() {
    return this.branchesService.findAll();
  }

  @Get('restaurants/:restaurantId/branches')
  findByRestaurant(@Param('restaurantId') restaurantId: string) {
    return this.branchesService.findByRestaurant(restaurantId);
  }

  @Post('branches')
  create(
    @Body()
    body: {
      restaurantId: string;
      name: string;
      address?: string;
      phone?: string;
    },
  ) {
    return this.branchesService.create(body);
  }
}
