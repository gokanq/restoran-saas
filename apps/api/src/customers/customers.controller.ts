import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CustomersService } from './customers.service';

@UseGuards(JwtAuthGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  list(@Req() req: any, @Query('q') query?: string) {
    return this.customersService.list(req.user.restaurantId, query);
  }

  @Get('by-phone/:phone')
  findByPhone(@Req() req: any, @Param('phone') phone: string) {
    return this.customersService.findByPhone(req.user.restaurantId, phone);
  }

  @Get(':id')
  get(@Req() req: any, @Param('id') id: string) {
    return this.customersService.get(req.user.restaurantId, id);
  }

  @Post()
  create(@Req() req: any, @Body() body: any) {
    return this.customersService.create(req.user.restaurantId, body);
  }

  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.customersService.update(req.user.restaurantId, id, body);
  }

  @Delete(':id')
  softDelete(@Req() req: any, @Param('id') id: string) {
    return this.customersService.softDelete(req.user.restaurantId, id);
  }

  @Post(':id/addresses')
  createAddress(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.customersService.createAddress(req.user.restaurantId, id, body);
  }

  @Patch(':id/addresses/:addressId')
  updateAddress(
    @Req() req: any,
    @Param('id') id: string,
    @Param('addressId') addressId: string,
    @Body() body: any,
  ) {
    return this.customersService.updateAddress(req.user.restaurantId, id, addressId, body);
  }

  @Delete(':id/addresses/:addressId')
  softDeleteAddress(@Req() req: any, @Param('id') id: string, @Param('addressId') addressId: string) {
    return this.customersService.softDeleteAddress(req.user.restaurantId, id, addressId);
  }
}
