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

function numberOrDefault(value: unknown, defaultValue: number) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return defaultValue;
  }

  return numericValue;
}

function positiveIntegerOrDefault(value: unknown, defaultValue: number) {
  const numericValue = Math.floor(numberOrDefault(value, defaultValue));

  return numericValue < 0 ? defaultValue : numericValue;
}

@Injectable()
export class MenuService {
  constructor(private readonly prisma: PrismaService) {}

  private async validateBranch(restaurantId: string, branchId: string) {
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

    if (branch.restaurantId !== restaurantId) {
      throw new ForbiddenException('Bu şube için işlem yapma yetkiniz yok');
    }

    return branch;
  }

  async findCategories(restaurantId: string) {
    return this.prisma.menuCategory.findMany({
      where: {
        restaurantId,
      },
      include: {
        branch: true,
        items: {
          include: {
            optionGroups: {
              include: {
                options: {
                  orderBy: [
                    {
                      sortOrder: 'asc',
                    },
                    {
                      name: 'asc',
                    },
                  ],
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
            },
          },
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
      await this.validateBranch(data.restaurantId, branchId);
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
        optionGroups: {
          include: {
            options: {
              orderBy: [
                {
                  sortOrder: 'asc',
                },
                {
                  name: 'asc',
                },
              ],
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
        },
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
      await this.validateBranch(data.restaurantId, branchId);
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
        optionGroups: {
          include: {
            options: true,
          },
        },
      },
    });
  }

  async findOptionGroups(restaurantId: string) {
    return this.prisma.menuItemOptionGroup.findMany({
      where: {
        restaurantId,
      },
      include: {
        branch: true,
        menuItem: {
          include: {
            category: true,
          },
        },
        options: {
          orderBy: [
            {
              sortOrder: 'asc',
            },
            {
              name: 'asc',
            },
          ],
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

  async createOptionGroup(data: {
    restaurantId: string;
    branchId?: string | null;
    menuItemId: string;
    name: string;
    isRequired?: boolean;
    minSelect?: number;
    maxSelect?: number;
    sortOrder?: number;
    isActive?: boolean;
  }) {
    const name = optionalText(data.name);

    if (!name) {
      throw new BadRequestException('Opsiyon grubu adı zorunludur');
    }

    const menuItemId = optionalText(data.menuItemId);

    if (!menuItemId) {
      throw new BadRequestException('Ürün seçimi zorunludur');
    }

    const menuItem = await this.prisma.menuItem.findUnique({
      where: {
        id: menuItemId,
      },
      select: {
        id: true,
        restaurantId: true,
        branchId: true,
      },
    });

    if (!menuItem) {
      throw new NotFoundException('Ürün bulunamadı');
    }

    if (menuItem.restaurantId !== data.restaurantId) {
      throw new ForbiddenException('Bu ürün için opsiyon grubu oluşturma yetkiniz yok');
    }

    const requestedBranchId = optionalText(data.branchId);
    const branchId = requestedBranchId ?? menuItem.branchId ?? null;

    if (branchId) {
      await this.validateBranch(data.restaurantId, branchId);
    }

    if (menuItem.branchId && branchId && menuItem.branchId !== branchId) {
      throw new BadRequestException('Opsiyon grubu şubesi ile ürün şubesi uyuşmuyor');
    }

    const isRequired = data.isRequired ?? false;
    let minSelect = positiveIntegerOrDefault(data.minSelect, isRequired ? 1 : 0);
    const maxSelect = positiveIntegerOrDefault(data.maxSelect, 1);

    if (isRequired && minSelect < 1) {
      minSelect = 1;
    }

    if (maxSelect < 1) {
      throw new BadRequestException('Maksimum seçim en az 1 olmalıdır');
    }

    if (minSelect > maxSelect) {
      throw new BadRequestException('Minimum seçim maksimum seçimden büyük olamaz');
    }

    return this.prisma.menuItemOptionGroup.create({
      data: {
        restaurantId: data.restaurantId,
        branchId,
        menuItemId,
        name,
        isRequired,
        minSelect,
        maxSelect,
        sortOrder: positiveIntegerOrDefault(data.sortOrder, 0),
        isActive: data.isActive ?? true,
      },
      include: {
        branch: true,
        menuItem: {
          include: {
            category: true,
          },
        },
        options: true,
      },
    });
  }

  async createOption(data: {
    restaurantId: string;
    branchId?: string | null;
    optionGroupId: string;
    name: string;
    price?: string | number;
    sortOrder?: number;
    isActive?: boolean;
  }) {
    const name = optionalText(data.name);

    if (!name) {
      throw new BadRequestException('Opsiyon adı zorunludur');
    }

    const optionGroupId = optionalText(data.optionGroupId);

    if (!optionGroupId) {
      throw new BadRequestException('Opsiyon grubu seçimi zorunludur');
    }

    const optionGroup = await this.prisma.menuItemOptionGroup.findUnique({
      where: {
        id: optionGroupId,
      },
      select: {
        id: true,
        restaurantId: true,
        branchId: true,
      },
    });

    if (!optionGroup) {
      throw new NotFoundException('Opsiyon grubu bulunamadı');
    }

    if (optionGroup.restaurantId !== data.restaurantId) {
      throw new ForbiddenException('Bu opsiyon grubu için işlem yapma yetkiniz yok');
    }

    const requestedBranchId = optionalText(data.branchId);
    const branchId = requestedBranchId ?? optionGroup.branchId ?? null;

    if (branchId) {
      await this.validateBranch(data.restaurantId, branchId);
    }

    if (optionGroup.branchId && branchId && optionGroup.branchId !== branchId) {
      throw new BadRequestException('Opsiyon şubesi ile opsiyon grubu şubesi uyuşmuyor');
    }

    const numericPrice = numberOrDefault(data.price, 0);

    if (!Number.isFinite(numericPrice) || numericPrice < 0) {
      throw new BadRequestException('Opsiyon fiyatı geçerli olmalıdır');
    }

    return this.prisma.menuItemOption.create({
      data: {
        restaurantId: data.restaurantId,
        branchId,
        groupId: optionGroupId,
        name,
        priceDelta: numericPrice,
        sortOrder: positiveIntegerOrDefault(data.sortOrder, 0),
        isActive: data.isActive ?? true,
      },
      include: {
        branch: true,
        group: {
          include: {
            menuItem: true,
          },
        },
      },
    });
  }
}
