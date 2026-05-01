import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        restaurantId: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        restaurant: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  create(data: {
    restaurantId?: string;
    name: string;
    email: string;
    passwordHash: string;
    role?: UserRole;
  }) {
    return this.prisma.user.create({
      data: {
        restaurantId: data.restaurantId,
        name: data.name,
        email: data.email,
        passwordHash: data.passwordHash,
        role: data.role || UserRole.ADMIN,
      },
      select: {
        id: true,
        restaurantId: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }
}
