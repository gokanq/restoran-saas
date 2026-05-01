import { BadRequestException, Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  private readonly safeUserSelect = {
    id: true,
    restaurantId: true,
    name: true,
    email: true,
    role: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
    restaurant: {
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    },
  };

  findAll() {
    return this.prisma.user.findMany({
      select: this.safeUserSelect,
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: {
    restaurantId?: string;
    name: string;
    email: string;
    password: string;
    role?: UserRole;
  }) {
    if (!data.name || !data.email || !data.password) {
      throw new BadRequestException('name, email ve password zorunludur');
    }

    if (data.password.length < 6) {
      throw new BadRequestException('Şifre en az 6 karakter olmalıdır');
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    return this.prisma.user.create({
      data: {
        restaurantId: data.restaurantId,
        name: data.name,
        email: data.email.toLowerCase(),
        passwordHash,
        role: data.role ?? UserRole.ADMIN,
      },
      select: this.safeUserSelect,
    });
  }
}
