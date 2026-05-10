import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MenuChannel, OrderStatus, OrderType, PaymentMethod } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const ORDER_STATUSES = Object.values(OrderStatus);
const ORDER_TYPES = Object.values(OrderType);
const PAYMENT_METHODS = Object.values(PaymentMethod);
const MENU_CHANNELS = Object.values(MenuChannel);

type RequestedOrderItem = {
  menuItemId?: string;
  quantity?: number | string;
  note?: string | null;
  selectedOptionIds?: string[];
  optionIds?: string[];
};

type NormalizedOrderItem = {
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  basePriceSnapshot: number;
  channelSnapshot: MenuChannel;
  appliedPriceSource: 'BASE' | 'CHANNEL_CUSTOM';
  totalPrice: number;
  note: string | null;
  selectedOptions: {
    optionId: string;
    groupName: string;
    optionName: string;
    priceDelta: number;
  }[];
};

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
    return 1;
  }

  return quantity;
}

function normalizeIdList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter((item) => item.length > 0),
    ),
  );
}

function parseMoney(value: unknown) {
  const parsedValue = Number(String(value ?? 0).replace(',', '.'));

  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  findByRestaurant(restaurantId: string) {
    return this.prisma.order.findMany({
      where: {
        restaurantId,
      },
      include: {
        branch: true,
        items: {
          orderBy: {
            createdAt: 'asc',
          },
          include: {
            menuItem: true,
            options: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOneByRestaurant(orderId: string, restaurantId: string) {
    const order = await this.prisma.order.findUnique({
      where: {
        id: orderId,
      },
      include: {
        branch: true,
        items: {
          orderBy: {
            createdAt: 'asc',
          },
          include: {
            options: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Sipariş bulunamadı');
    }

    if (order.restaurantId !== restaurantId) {
      throw new ForbiddenException('Bu siparişi görüntüleme yetkiniz yok');
    }

    return order;
  }

  private async generateOrderCode(restaurantId: string) {
    const existingOrders = await this.prisma.order.findMany({
      where: {
        restaurantId,
        code: {
          startsWith: 'ORD-',
        },
      },
      select: {
        code: true,
      },
    });

    const maxSequentialNumber = existingOrders.reduce((maxNumber, order) => {
      const match = /^ORD-(\d{1,6})$/.exec(order.code);

      if (!match) {
        return maxNumber;
      }

      const orderNumber = Number(match[1]);

      return Number.isFinite(orderNumber) ? Math.max(maxNumber, orderNumber) : maxNumber;
    }, 0);

    let nextNumber = maxSequentialNumber + 1;

    while (
      await this.prisma.order.findFirst({
        where: {
          code: `ORD-${nextNumber}`,
        },
      })
    ) {
      nextNumber += 1;
    }

    return `ORD-${nextNumber}`;
  }

  async create(data: {
    restaurantId: string;
    branchId: string;
    code?: string;
    type?: OrderType;
    channel?: MenuChannel;
    tableNumber?: string;
    status?: OrderStatus;
    total?: string | number;
    paymentMethod?: PaymentMethod;
    customerName?: string;
    customerPhone?: string;
    customerAddress?: string;
    note?: string;
    items?: RequestedOrderItem[];
  }) {
    if (!data.branchId) {
      throw new BadRequestException('branchId zorunludur');
    }

    if (data.type && !ORDER_TYPES.includes(data.type)) {
      throw new BadRequestException('Geçersiz sipariş tipi');
    }

    if (data.status && !ORDER_STATUSES.includes(data.status)) {
      throw new BadRequestException('Geçersiz sipariş durumu');
    }

    if (data.paymentMethod && !PAYMENT_METHODS.includes(data.paymentMethod)) {
      throw new BadRequestException('Geçersiz ödeme tipi');
    }

    if (data.channel && !MENU_CHANNELS.includes(data.channel)) {
      throw new BadRequestException('Geçersiz sipariş kanalı');
    }

    if (data.total !== undefined && parseMoney(data.total) < 0) {
      throw new BadRequestException('total negatif olamaz');
    }

    const orderType = data.type ?? OrderType.DELIVERY;
    const orderChannel = data.channel ?? MenuChannel.CALLER_ID;
    const orderCode = data.code?.trim() || (await this.generateOrderCode(data.restaurantId));
    const paymentMethod = data.paymentMethod ?? PaymentMethod.CASH;
    const tableNumber = optionalText(data.tableNumber);

    if (orderType === OrderType.TABLE && !tableNumber) {
      throw new BadRequestException('Masa siparişlerinde masa numarası zorunludur');
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

    if (branch.restaurantId !== data.restaurantId) {
      throw new ForbiddenException('Bu şube için sipariş oluşturma yetkiniz yok');
    }

    const requestedItems = Array.isArray(data.items) ? data.items : [];
    const requestedMenuItemIds = [
      ...new Set(
        requestedItems
          .map((item) => optionalText(item.menuItemId))
          .filter((itemId): itemId is string => Boolean(itemId)),
      ),
    ];

    if (requestedItems.length > 0 && requestedMenuItemIds.length === 0) {
      throw new BadRequestException('Siparişe eklenecek geçerli ürün bulunamadı');
    }

    const menuItems =
      requestedMenuItemIds.length > 0
        ? await this.prisma.menuItem.findMany({
            where: {
              id: {
                in: requestedMenuItemIds,
              },
              restaurantId: data.restaurantId,
              isActive: true,
              deletedAt: null,
              OR: [
                {
                  branchId: null,
                },
                {
                  branchId: data.branchId,
                },
              ],
            },
            include: {
              menuItemChannelSettings: {
                where: {
                  channel: orderChannel,
                },
              },
              optionGroups: {
                where: {
                  isActive: true,
                  OR: [
                    {
                      branchId: null,
                    },
                    {
                      branchId: data.branchId,
                    },
                  ],
                },
                include: {
                  options: {
                    where: {
                      isActive: true,
                      OR: [
                        {
                          branchId: null,
                        },
                        {
                          branchId: data.branchId,
                        },
                      ],
                    },
                  },
                },
              },
            },
          })
        : [];

    if (requestedMenuItemIds.length > 0 && menuItems.length !== requestedMenuItemIds.length) {
      throw new BadRequestException('Seçilen ürünlerden bazıları bulunamadı veya aktif değil');
    }

    const menuItemMap = new Map(menuItems.map((menuItem) => [menuItem.id, menuItem]));

    const normalizedItems: NormalizedOrderItem[] = requestedItems
      .map((item) => {
        const menuItemId = optionalText(item.menuItemId);

        if (!menuItemId) {
          return null;
        }

        const menuItem = menuItemMap.get(menuItemId);

        if (!menuItem) {
          throw new BadRequestException('Ürün bilgisi geçersiz');
        }

        const channelSetting = menuItem.menuItemChannelSettings[0] || null;

        if (channelSetting?.isEnabled === false) {
          throw new BadRequestException('Seçilen ürün bu sipariş kanalında kapalı');
        }

        const rawOptionIds =
          Array.isArray(item.selectedOptionIds) && item.selectedOptionIds.length > 0
            ? item.selectedOptionIds
            : item.optionIds;

        const selectedOptionIds = normalizeIdList(rawOptionIds);
        const optionMap = new Map(
          menuItem.optionGroups.flatMap((group) =>
            group.options.map((option) => [
              option.id,
              {
                optionId: option.id,
                groupName: group.name,
                optionName: option.name,
                priceDelta: Number(option.priceDelta),
              },
            ]),
          ),
        );

        const selectedOptions = selectedOptionIds.map((optionId) => optionMap.get(optionId));

        if (selectedOptions.some((option) => !option)) {
          throw new BadRequestException('Seçilen opsiyonlardan bazıları geçersiz');
        }

        const safeSelectedOptions = selectedOptions.filter(
          (option): option is NonNullable<typeof option> => Boolean(option),
        );
        const basePriceSnapshot = Number(menuItem.price);
        const hasChannelCustomPrice = channelSetting?.customPrice !== null && channelSetting?.customPrice !== undefined;
        const unitPrice = hasChannelCustomPrice ? Number(channelSetting.customPrice) : basePriceSnapshot;
        const appliedPriceSource = hasChannelCustomPrice ? 'CHANNEL_CUSTOM' : 'BASE';
        const optionTotal = safeSelectedOptions.reduce((sum, option) => sum + option.priceDelta, 0);
        const quantity = normalizeQuantity(item.quantity);
        const totalPrice = (unitPrice + optionTotal) * quantity;

        return {
          menuItemId: menuItem.id,
          name: menuItem.name,
          quantity,
          unitPrice,
          basePriceSnapshot,
          channelSnapshot: orderChannel,
          appliedPriceSource,
          totalPrice,
          note: optionalText(item.note),
          selectedOptions: safeSelectedOptions,
        };
      })
      .filter((item): item is NormalizedOrderItem => Boolean(item));

    if (requestedItems.length > 0 && normalizedItems.length === 0) {
      throw new BadRequestException('Siparişe eklenecek geçerli ürün bulunamadı');
    }

    const itemsTotal = normalizedItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const calculatedOrderTotal = normalizedItems.length > 0 ? itemsTotal : parseMoney(data.total);

    const order = await this.prisma.$transaction(async (tx) => {
      const createdOrder = await tx.order.create({
        data: {
          restaurantId: data.restaurantId,
          branchId: data.branchId,
          code: orderCode,
          type: orderType,
          channel: orderChannel,
          tableNumber: orderType === OrderType.TABLE ? tableNumber : null,
          status: data.status,
          paymentMethod,
          total: calculatedOrderTotal,
          customerName: optionalText(data.customerName),
          customerPhone: optionalText(data.customerPhone),
          customerAddress: orderType === OrderType.DELIVERY ? optionalText(data.customerAddress) : null,
          note: optionalText(data.note),
          ...(normalizedItems.length > 0
            ? {
                items: {
                  create: normalizedItems.map((item) => ({
                    menuItemId: item.menuItemId,
                    name: item.name,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    basePriceSnapshot: item.basePriceSnapshot,
                    channelSnapshot: item.channelSnapshot,
                    appliedPriceSource: item.appliedPriceSource,
                    totalPrice: item.totalPrice,
                    note: item.note,
                    ...(item.selectedOptions.length > 0
                      ? {
                          options: {
                            create: item.selectedOptions.map((option) => ({
                              optionId: option.optionId,
                              groupName: option.groupName,
                              optionName: option.optionName,
                              priceDelta: option.priceDelta,
                            })),
                          },
                        }
                      : {}),
                  })),
                },
              }
            : {}),
        },
        include: {
          branch: true,
          items: {
            orderBy: {
              createdAt: 'asc',
            },
            include: {
              options: true,
            },
          },
        },
      });

      const settings = await tx.restaurantSettings.findUnique({
        where: { restaurantId: data.restaurantId },
      });

      if (settings?.autoApproveOrders && createdOrder.status === OrderStatus.PENDING) {
        return tx.order.update({
          where: { id: createdOrder.id },
          data: { status: OrderStatus.ACCEPTED },
          include: {
            branch: true,
            items: {
              orderBy: {
                createdAt: 'asc',
              },
              include: {
                options: true,
              },
            },
          },
        });
      }

      return createdOrder;
    });

    return order;
  }

  async updateStatus(data: {
    orderId: string;
    restaurantId: string;
    status: OrderStatus;
    courierId?: string | null;
    courierName?: string | null;
  }) {
    if (!data.status) {
      throw new BadRequestException('status zorunludur');
    }

    if (!ORDER_STATUSES.includes(data.status)) {
      throw new BadRequestException('Geçersiz sipariş durumu');
    }

    let courierSnapshotName: string | null | undefined;

    if (data.status === OrderStatus.ON_DELIVERY) {
      if (optionalText(data.courierId)) {
        const courier = await this.prisma.courier.findFirst({
          where: {
            id: optionalText(data.courierId) || undefined,
            restaurantId: data.restaurantId,
            isActive: true,
          },
        });

        if (!courier) {
          throw new BadRequestException('Aktif kurye bulunamadı');
        }

        courierSnapshotName = courier.name;
      } else if (optionalText(data.courierName)) {
        courierSnapshotName = optionalText(data.courierName);
      } else {
        throw new BadRequestException('Yola çıkarılan sipariş için kurye seçimi zorunludur');
      }
    }

    const order = await this.prisma.order.findUnique({
      where: {
        id: data.orderId,
      },
      select: {
        id: true,
        restaurantId: true,
        branchId: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Sipariş bulunamadı');
    }

    if (order.restaurantId !== data.restaurantId) {
      throw new ForbiddenException('Bu siparişi güncelleme yetkiniz yok');
    }

    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.update({
        where: {
          id: data.orderId,
        },
        data: {
          status: data.status,
          courierId:
            data.status === OrderStatus.ON_DELIVERY && optionalText(data.courierId)
              ? optionalText(data.courierId) || undefined
              : undefined,
          courierName: data.status === OrderStatus.ON_DELIVERY ? courierSnapshotName : undefined,
        },
        include: {
          branch: true,
          items: {
            orderBy: {
              createdAt: 'asc',
            },
            include: {
              options: true,
            },
          },
        },
      });

      if (data.status === OrderStatus.ON_DELIVERY && optionalText(data.courierId)) {
        const courierId = optionalText(data.courierId)!;
        const existingAssignment = await tx.deliveryAssignment.findUnique({
          where: {
            orderId: data.orderId,
          },
        });

        if (existingAssignment) {
          await tx.deliveryAssignment.update({
            where: {
              id: existingAssignment.id,
            },
            data: {
              courierId,
              status: 'ASSIGNED',
              assignedAt: new Date(),
              deliveredAt: null,
              cancelledAt: null,
            },
          });
        } else {
          await tx.deliveryAssignment.create({
            data: {
              restaurantId: data.restaurantId,
              branchId: order.branchId,
              orderId: data.orderId,
              courierId,
              status: 'ASSIGNED',
            },
          });
        }
      }

      if (
        data.status === OrderStatus.DELIVERED ||
        data.status === OrderStatus.CANCELLED
      ) {
        const assignmentStatus =
          data.status === OrderStatus.DELIVERED ? 'DELIVERED' : 'CANCELLED';
        const timestampField =
          data.status === OrderStatus.DELIVERED
            ? { deliveredAt: new Date() }
            : { cancelledAt: new Date() };

        await tx.deliveryAssignment.updateMany({
          where: {
            orderId: data.orderId,
            status: { notIn: ['DELIVERED', 'CANCELLED'] },
          },
          data: {
            status: assignmentStatus,
            ...timestampField,
          },
        });
      }

      return order;
    });

    return updatedOrder;
  }
}
