import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.branch.findMany({
      include: {
        restaurant: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  findByRestaurant(restaurantId: string) {
    return this.prisma.branch.findMany({
      where: {
        restaurantId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  create(data: {
    restaurantId: string;
    name: string;
    address?: string;
    phone?: string;
  }) {
    return this.prisma.branch.create({
      data: {
        restaurantId: data.restaurantId,
        name: data.name,
        address: data.address,
        phone: data.phone,
      },
    });
  }
}
