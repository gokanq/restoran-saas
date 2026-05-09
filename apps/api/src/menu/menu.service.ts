import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, MenuChannel } from '@prisma/client';

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


const MENU_ITEM_INCLUDE: Prisma.MenuItemInclude = {
  branch: true,
  category: true,
  menuItemChannelSettings: {
    orderBy: {
      channel: 'asc' as const,
    },
  },
  optionGroups: {
    include: {
      options: {
        orderBy: [
          {
            sortOrder: 'asc' as const,
          },
          {
            name: 'asc' as const,
          },
        ],
      },
    },
    orderBy: [
      {
        sortOrder: 'asc' as const,
      },
      {
        name: 'asc' as const,
      },
    ],
  },
};

function parseOptionalPrice(value: unknown) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === '') {
    return null;
  }

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    throw new BadRequestException('Fiyat geçerli olmalıdır');
  }

  return numericValue;
}

function parseMenuChannel(value: unknown) {
  if (typeof value !== 'string') {
    throw new BadRequestException('Menü kanalı zorunludur');
  }

  const normalizedValue = value.trim().toUpperCase();

  if (!Object.values(MenuChannel).includes(normalizedValue as MenuChannel)) {
    throw new BadRequestException('Menü kanalı geçerli değildir');
  }

  return normalizedValue as MenuChannel;
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
        deletedAt: null,
      },
      include: MENU_ITEM_INCLUDE,
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
    imageUrl?: string | null;
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
        imageUrl: optionalText(data.imageUrl),
        price: numericPrice,
        isActive: data.isActive ?? true,
      },
      include: MENU_ITEM_INCLUDE,
    });
  }

  private async validateMenuItemForRestaurant(restaurantId: string, itemId: string) {
    const item = await this.prisma.menuItem.findFirst({
      where: {
        id: itemId,
        restaurantId,
        deletedAt: null,
      },
      select: {
        id: true,
        restaurantId: true,
        branchId: true,
      },
    });

    if (!item) {
      throw new NotFoundException('Ürün bulunamadı');
    }

    return item;
  }

  async updateItem(
    restaurantId: string,
    itemId: string,
    data: {
      branchId?: string | null;
      categoryId?: string | null;
      name?: string;
      description?: string | null;
      imageUrl?: string | null;
      price?: string | number;
      isActive?: boolean;
    },
  ) {
    const currentItem = await this.validateMenuItemForRestaurant(restaurantId, itemId);

    const branchId = data.branchId === undefined ? undefined : optionalText(data.branchId);
    const categoryId = data.categoryId === undefined ? undefined : optionalText(data.categoryId);

    if (branchId) {
      await this.validateBranch(restaurantId, branchId);
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

      if (category.restaurantId !== restaurantId) {
        throw new ForbiddenException('Bu kategori için işlem yapma yetkiniz yok');
      }

      const effectiveBranchId = branchId === undefined ? currentItem.branchId : branchId;

      if (effectiveBranchId && category.branchId && category.branchId !== effectiveBranchId) {
        throw new BadRequestException('Ürün şubesi ile kategori şubesi uyuşmuyor');
      }
    }

    const name = data.name === undefined ? undefined : optionalText(data.name);

    if (data.name !== undefined && !name) {
      throw new BadRequestException('Ürün adı zorunludur');
    }

    const price = data.price === undefined ? undefined : parseOptionalPrice(data.price);

    return this.prisma.menuItem.update({
      where: {
        id: itemId,
      },
      data: {
        branchId,
        categoryId,
        name: name ?? undefined,
        description: data.description === undefined ? undefined : optionalText(data.description),
        imageUrl: data.imageUrl === undefined ? undefined : optionalText(data.imageUrl),
        price: price === null ? 0 : price,
        isActive: data.isActive,
      },
      include: MENU_ITEM_INCLUDE,
    });
  }

  async deleteItem(restaurantId: string, itemId: string) {
    await this.validateMenuItemForRestaurant(restaurantId, itemId);

    return this.prisma.menuItem.update({
      where: {
        id: itemId,
      },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
      include: MENU_ITEM_INCLUDE,
    });
  }

  async updateItemChannelSettings(
    restaurantId: string,
    itemId: string,
    settings: Array<{
      channel: string;
      isEnabled?: boolean;
      customPrice?: string | number | null;
    }>,
  ) {
    const item = await this.validateMenuItemForRestaurant(restaurantId, itemId);

    if (!Array.isArray(settings)) {
      throw new BadRequestException('Kanal ayarları liste olarak gönderilmelidir');
    }

    for (const setting of settings) {
      const channel = parseMenuChannel(setting.channel);
      const customPrice = parseOptionalPrice(setting.customPrice);

      await this.prisma.menuItemChannelSetting.upsert({
        where: {
          menuItemId_channel: {
            menuItemId: item.id,
            channel,
          },
        },
        update: {
          isEnabled: setting.isEnabled ?? true,
          customPrice,
          branchId: item.branchId,
        },
        create: {
          restaurantId,
          branchId: item.branchId,
          menuItemId: item.id,
          channel,
          isEnabled: setting.isEnabled ?? true,
          customPrice,
        },
      });
    }

    return this.prisma.menuItem.findUnique({
      where: {
        id: item.id,
      },
      include: MENU_ITEM_INCLUDE,
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

  async updateOptionGroup(
    restaurantId: string,
    id: string,
    data: {
      name?: string;
      isRequired?: boolean;
      minSelect?: number;
      maxSelect?: number;
      sortOrder?: number;
      isActive?: boolean;
    },
  ) {
    const optionGroup = await this.prisma.menuItemOptionGroup.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        restaurantId: true,
      },
    });

    if (!optionGroup) {
      throw new NotFoundException('Opsiyon grubu bulunamadı');
    }

    if (optionGroup.restaurantId !== restaurantId) {
      throw new ForbiddenException('Bu opsiyon grubu için işlem yapma yetkiniz yok');
    }

    const updateData: {
      name?: string;
      isRequired?: boolean;
      minSelect?: number;
      maxSelect?: number;
      sortOrder?: number;
      isActive?: boolean;
    } = {};

    if (data.name !== undefined) {
      const name = optionalText(data.name);

      if (!name) {
        throw new BadRequestException('Opsiyon grubu adı zorunludur');
      }

      updateData.name = name;
    }

    if (data.isRequired !== undefined) {
      updateData.isRequired = data.isRequired;
    }

    if (data.minSelect !== undefined) {
      updateData.minSelect = positiveIntegerOrDefault(data.minSelect, 0);
    }

    if (data.maxSelect !== undefined) {
      const maxSelect = positiveIntegerOrDefault(data.maxSelect, 1);

      if (maxSelect < 1) {
        throw new BadRequestException('Maksimum seçim en az 1 olmalıdır');
      }

      updateData.maxSelect = maxSelect;
    }

    const finalMinSelect = updateData.minSelect ?? 0;
    const finalMaxSelect = updateData.maxSelect ?? 1;

    if (finalMinSelect > finalMaxSelect) {
      throw new BadRequestException('Minimum seçim maksimum seçimden büyük olamaz');
    }

    if (data.sortOrder !== undefined) {
      updateData.sortOrder = positiveIntegerOrDefault(data.sortOrder, 0);
    }

    if (data.isActive !== undefined) {
      updateData.isActive = data.isActive;
    }

    return this.prisma.menuItemOptionGroup.update({
      where: {
        id,
      },
      data: updateData,
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
    });
  }

  async deleteOptionGroup(restaurantId: string, id: string) {
    const optionGroup = await this.prisma.menuItemOptionGroup.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        restaurantId: true,
      },
    });

    if (!optionGroup) {
      throw new NotFoundException('Opsiyon grubu bulunamadı');
    }

    if (optionGroup.restaurantId !== restaurantId) {
      throw new ForbiddenException('Bu opsiyon grubu için işlem yapma yetkiniz yok');
    }

    await this.prisma.menuItemOptionGroup.delete({
      where: {
        id,
      },
    });

    return {
      success: true,
    };
  }

  async updateOption(
    restaurantId: string,
    id: string,
    data: {
      name?: string;
      price?: string | number;
      priceDelta?: string | number;
      sortOrder?: number;
      isActive?: boolean;
    },
  ) {
    const option = await this.prisma.menuItemOption.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        restaurantId: true,
      },
    });

    if (!option) {
      throw new NotFoundException('Opsiyon bulunamadı');
    }

    if (option.restaurantId !== restaurantId) {
      throw new ForbiddenException('Bu opsiyon için işlem yapma yetkiniz yok');
    }

    const updateData: {
      name?: string;
      priceDelta?: number;
      sortOrder?: number;
      isActive?: boolean;
    } = {};

    if (data.name !== undefined) {
      const name = optionalText(data.name);

      if (!name) {
        throw new BadRequestException('Opsiyon adı zorunludur');
      }

      updateData.name = name;
    }

    const priceValue = data.priceDelta ?? data.price;

    if (priceValue !== undefined) {
      const numericPrice = numberOrDefault(priceValue, 0);

      if (!Number.isFinite(numericPrice) || numericPrice < 0) {
        throw new BadRequestException('Opsiyon fiyatı geçerli olmalıdır');
      }

      updateData.priceDelta = numericPrice;
    }

    if (data.sortOrder !== undefined) {
      updateData.sortOrder = positiveIntegerOrDefault(data.sortOrder, 0);
    }

    if (data.isActive !== undefined) {
      updateData.isActive = data.isActive;
    }

    return this.prisma.menuItemOption.update({
      where: {
        id,
      },
      data: updateData,
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

  async deleteOption(restaurantId: string, id: string) {
    const option = await this.prisma.menuItemOption.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        restaurantId: true,
      },
    });

    if (!option) {
      throw new NotFoundException('Opsiyon bulunamadı');
    }

    if (option.restaurantId !== restaurantId) {
      throw new ForbiddenException('Bu opsiyon için işlem yapma yetkiniz yok');
    }

    await this.prisma.menuItemOption.delete({
      where: {
        id,
      },
    });

    return {
      success: true,
    };
  }

}
