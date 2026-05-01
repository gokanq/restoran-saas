import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

function optionalText(value?: string | null) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : null;
}

@Injectable()
export class MenuService {
  constructor(private readonly prisma: PrismaService) {}

  async findCategories(restaurantId: string) {
    return this.prisma.menuCategory.findMany({
      where: {
        restaurantId,
      },
      include: {
        branch: true,
        items: {
          orderBy: {
            name: 'asc',
          },
        },
      },
      orderBy: [
        {
          sortOrder: 'asc',
        },
        {
          name: 'asc',
        },
      ],
    });
  }

  async createCategory(data: {
    restaurantId: string;
    branchId?: string | null;
    name: string;
    sortOrder?: number;
    isActive?: boolean;
  }) {
    const name = optionalText(data.name);

    if (!name) {
      throw new BadRequestException('Kategori adı zorunludur');
    }

    const branchId = optionalText(data.branchId);

    if (branchId) {
      const branch = await this.prisma.branch.findUnique({
        where: {
          id: branchId,
        },
        select: {
          id: true,
          restaurantId: true,
        },
      });

      if (!branch) {
        throw new NotFoundException('Şube bulunamadı');
      }

      if (branch.restaurantId !== data.restaurantId) {
        throw new ForbiddenException('Bu şube için kategori oluşturma yetkiniz yok');
      }
    }

    return this.prisma.menuCategory.create({
      data: {
        restaurantId: data.restaurantId,
        branchId,
        name,
        sortOrder: data.sortOrder ?? 0,
        isActive: data.isActive ?? true,
      },
      include: {
        branch: true,
        items: true,
      },
    });
  }

  async findItems(restaurantId: string) {
    return this.prisma.menuItem.findMany({
      where: {
        restaurantId,
      },
      include: {
        branch: true,
        category: true,
      },
      orderBy: [
        {
          category: {
            sortOrder: 'asc',
          },
        },
        {
          name: 'asc',
        },
      ],
    });
  }

  async createItem(data: {
    restaurantId: string;
    branchId?: string | null;
    categoryId?: string | null;
    name: string;
    description?: string | null;
    price: string | number;
    isActive?: boolean;
  }) {
    const name = optionalText(data.name);

    if (!name) {
      throw new BadRequestException('Ürün adı zorunludur');
    }

    const numericPrice = Number(data.price);

    if (!Number.isFinite(numericPrice) || numericPrice < 0) {
      throw new BadRequestException('Ürün fiyatı geçerli olmalıdır');
    }

    const branchId = optionalText(data.branchId);
    const categoryId = optionalText(data.categoryId);

    if (branchId) {
      const branch = await this.prisma.branch.findUnique({
        where: {
          id: branchId,
        },
        select: {
          id: true,
          restaurantId: true,
        },
      });

      if (!branch) {
        throw new NotFoundException('Şube bulunamadı');
      }

      if (branch.restaurantId !== data.restaurantId) {
        throw new ForbiddenException('Bu şube için ürün oluşturma yetkiniz yok');
      }
    }

    if (categoryId) {
      const category = await this.prisma.menuCategory.findUnique({
        where: {
          id: categoryId,
        },
        select: {
          id: true,
          restaurantId: true,
          branchId: true,
        },
      });

      if (!category) {
        throw new NotFoundException('Kategori bulunamadı');
      }

      if (category.restaurantId !== data.restaurantId) {
        throw new ForbiddenException('Bu kategori için ürün oluşturma yetkiniz yok');
      }

      if (branchId && category.branchId && category.branchId !== branchId) {
        throw new BadRequestException('Ürün şubesi ile kategori şubesi uyuşmuyor');
      }
    }

    return this.prisma.menuItem.create({
      data: {
        restaurantId: data.restaurantId,
        branchId,
        categoryId,
        name,
        description: optionalText(data.description),
        price: numericPrice,
        isActive: data.isActive ?? true,
      },
      include: {
        branch: true,
        category: true,
      },
    });
  }
}
