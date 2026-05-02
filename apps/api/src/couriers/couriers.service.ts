import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

function optionalText(value: unknown) {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

function decimalNumber(value: unknown) {
  const parsedValue = Number(String(value ?? 0).replace(',', '.'));

  if (!Number.isFinite(parsedValue) || parsedValue < 0) {
    return 0;
  }

  return parsedValue;
}

@Injectable()
export class CouriersService {
  constructor(private readonly prisma: PrismaService) {}

  findByRestaurant(restaurantId: string) {
    return this.prisma.courier.findMany({
      where: {
        restaurantId,
      },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        {
          isActive: 'desc',
        },
        {
          name: 'asc',
        },
      ],
    });
  }

  async create(data: {
    restaurantId: string;
    branchId?: string | null;
    name?: string;
    phone?: string | null;
    perPackageFee?: string | number | null;
    hourlyFee?: string | number | null;
    isActive?: boolean;
  }) {
    const name = optionalText(data.name);

    if (!name) {
      throw new BadRequestException('Kurye adı zorunludur');
    }

    if (data.branchId) {
      const branch = await this.prisma.branch.findFirst({
        where: {
          id: data.branchId,
          restaurantId: data.restaurantId,
        },
      });

      if (!branch) {
        throw new BadRequestException('Şube bulunamadı');
      }
    }

    return this.prisma.courier.create({
      data: {
        restaurantId: data.restaurantId,
        branchId: optionalText(data.branchId) || null,
        name,
        phone: optionalText(data.phone) || null,
        perPackageFee: decimalNumber(data.perPackageFee),
        hourlyFee: decimalNumber(data.hourlyFee),
        isActive: data.isActive ?? true,
      },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async update(data: {
    id: string;
    restaurantId: string;
    branchId?: string | null;
    name?: string;
    phone?: string | null;
    perPackageFee?: string | number | null;
    hourlyFee?: string | number | null;
    isActive?: boolean;
  }) {
    const courier = await this.prisma.courier.findFirst({
      where: {
        id: data.id,
        restaurantId: data.restaurantId,
      },
    });

    if (!courier) {
      throw new NotFoundException('Kurye bulunamadı');
    }

    if (data.branchId) {
      const branch = await this.prisma.branch.findFirst({
        where: {
          id: data.branchId,
          restaurantId: data.restaurantId,
        },
      });

      if (!branch) {
        throw new BadRequestException('Şube bulunamadı');
      }
    }

    return this.prisma.courier.update({
      where: {
        id: data.id,
      },
      data: {
        branchId: data.branchId === undefined ? undefined : optionalText(data.branchId) || null,
        name: data.name === undefined ? undefined : optionalText(data.name),
        phone: data.phone === undefined ? undefined : optionalText(data.phone) || null,
        perPackageFee:
          data.perPackageFee === undefined ? undefined : decimalNumber(data.perPackageFee),
        hourlyFee: data.hourlyFee === undefined ? undefined : decimalNumber(data.hourlyFee),
        isActive: data.isActive,
      },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async deactivate(id: string, restaurantId: string) {
    const courier = await this.prisma.courier.findFirst({
      where: {
        id,
        restaurantId,
      },
    });

    if (!courier) {
      throw new NotFoundException('Kurye bulunamadı');
    }

    return this.prisma.courier.update({
      where: {
        id,
      },
      data: {
        isActive: false,
      },
    });
  }
}
