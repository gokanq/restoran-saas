import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

function optionalText(value?: string | null) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : null;
}

function normalizeQuantity(value: unknown) {
  const quantity = Number(value);

  if (!Number.isInteger(quantity) || quantity <= 0) {
    return null;
  }

  return quantity;
}

@Injectable()
export class PublicService {
  constructor(private readonly prisma: PrismaService) {}

  async getMenu(branchId: string) {
    if (!branchId) {
      throw new BadRequestException('branchId zorunludur');
    }

    const branch = await this.prisma.branch.findUnique({
      where: {
        id: branchId,
      },
      include: {
        restaurant: true,
      },
    });

    if (!branch) {
      throw new NotFoundException('Şube bulunamadı');
    }

    const categories = await this.prisma.menuCategory.findMany({
      where: {
        restaurantId: branch.restaurantId,
        isActive: true,
        OR: [
          {
            branchId: null,
          },
          {
            branchId,
          },
        ],
      },
      include: {
        items: {
          where: {
            isActive: true,
            OR: [
              {
                branchId: null,
              },
              {
                branchId,
              },
            ],
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

    return {
      restaurant: {
        id: branch.restaurant.id,
        name: branch.restaurant.name,
        slug: branch.restaurant.slug,
      },
      branch: {
        id: branch.id,
        name: branch.name,
        address: branch.address,
        phone: branch.phone,
      },
      categories,
    };
  }

  async createTableOrder(data: {
    branchId: string;
    tableNumber: string;
    customerName?: string | null;
    customerPhone?: string | null;
    note?: string | null;
    items: {
      menuItemId: string;
      quantity: number;
      note?: string | null;
    }[];
  }) {
    if (!data.branchId) {
      throw new BadRequestException('branchId zorunludur');
    }

    const tableNumber = optionalText(data.tableNumber);

    if (!tableNumber) {
      throw new BadRequestException('Masa numarası zorunludur');
    }

    if (!Array.isArray(data.items) || data.items.length === 0) {
      throw new BadRequestException('En az bir ürün seçilmelidir');
    }

    const branch = await this.prisma.branch.findUnique({
      where: {
        id: data.branchId,
      },
      select: {
        id: true,
        restaurantId: true,
      },
    });

    if (!branch) {
      throw new NotFoundException('Şube bulunamadı');
    }

    const normalizedItems = data.items.map((item) => ({
      menuItemId: item.menuItemId,
      quantity: normalizeQuantity(item.quantity),
      note: optionalText(item.note),
    }));

    if (normalizedItems.some((item) => !item.menuItemId || !item.quantity)) {
      throw new BadRequestException('Ürün ve adet bilgileri geçerli olmalıdır');
    }

    const menuItemIds = Array.from(new Set(normalizedItems.map((item) => item.menuItemId)));

    const menuItems = await this.prisma.menuItem.findMany({
      where: {
        id: {
          in: menuItemIds,
        },
        restaurantId: branch.restaurantId,
        isActive: true,
        OR: [
          {
            branchId: null,
          },
          {
            branchId: branch.id,
          },
        ],
      },
    });

    if (menuItems.length !== menuItemIds.length) {
      throw new BadRequestException('Seçilen ürünlerden bazıları bulunamadı veya aktif değil');
    }

    const menuItemMap = new Map(menuItems.map((item) => [item.id, item]));

    const orderItems = normalizedItems.map((item) => {
      const menuItem = menuItemMap.get(item.menuItemId);

      if (!menuItem || !item.quantity) {
        throw new BadRequestException('Ürün bilgisi geçersiz');
      }

      const unitPrice = Number(menuItem.price);
      const totalPrice = unitPrice * item.quantity;

      return {
        menuItemId: menuItem.id,
        name: menuItem.name,
        quantity: item.quantity,
        unitPrice,
        totalPrice,
        note: item.note,
      };
    });

    const total = orderItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const code = `QR-${Date.now()}`;

    return this.prisma.order.create({
      data: {
        restaurantId: branch.restaurantId,
        branchId: branch.id,
        code,
        type: OrderType.TABLE,
        tableNumber,
        total,
        customerName: optionalText(data.customerName),
        customerPhone: optionalText(data.customerPhone),
        note: optionalText(data.note),
        items: {
          create: orderItems,
        },
      },
      include: {
        branch: true,
        items: true,
      },
    });
  }
}
