import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RestaurantsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.restaurant.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  create(data: { name: string; slug: string }) {
    return this.prisma.restaurant.create({
      data: {
        name: data.name,
        slug: data.slug,
      },
    });
  }
}
