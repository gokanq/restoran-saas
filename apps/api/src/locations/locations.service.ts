import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  getDistricts(city = 'Giresun') {
    return this.prisma.locationDistrict.findMany({
      where: {
        city,
        isActive: true,
      },
      orderBy: [
        { sortOrder: 'asc' },
        { name: 'asc' },
      ],
      select: {
        id: true,
        city: true,
        name: true,
        sortOrder: true,
      },
    });
  }

  getNeighborhoods(city = 'Giresun', district?: string) {
    return this.prisma.locationNeighborhood.findMany({
      where: {
        isActive: true,
        district: {
          city,
          isActive: true,
          ...(district ? { name: district } : {}),
        },
      },
      orderBy: [
        { sortOrder: 'asc' },
        { name: 'asc' },
      ],
      select: {
        id: true,
        name: true,
        sortOrder: true,
        district: {
          select: {
            id: true,
            city: true,
            name: true,
          },
        },
      },
    });
  }
}
