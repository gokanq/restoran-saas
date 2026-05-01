import { Body, Controller, Get, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Post()
  create(
    @Body()
    body: {
      restaurantId?: string;
      name: string;
      email: string;
      passwordHash: string;
      role?: UserRole;
    },
  ) {
    return this.usersService.create(body);
  }
}
