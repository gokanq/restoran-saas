import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { PublicService } from './public.service';

@Controller('public')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Get('menu')
  getMenu(@Query('branchId') branchId: string) {
    return this.publicService.getMenu(branchId);
  }

  @Post('orders/table')
  createTableOrder(
    @Body()
    body: {
      branchId: string;
      tableNumber: string;
      customerName?: string | null;
      customerPhone?: string | null;
      note?: string | null;
      items: {
        menuItemId: string;
        quantity: number;
        note?: string | null;
      }[];
    },
  ) {
    return this.publicService.createTableOrder({
      branchId: body.branchId,
      tableNumber: body.tableNumber,
      customerName: body.customerName,
      customerPhone: body.customerPhone,
      note: body.note,
      items: body.items,
    });
  }
}
