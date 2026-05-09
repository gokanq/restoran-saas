import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, OrderType, PaymentMethod } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const ORDER_STATUSES = Object.values(OrderStatus);
const ORDER_TYPES = Object.values(OrderType);
const PAYMENT_METHODS = Object.values(PaymentMethod);

function optionalText(value?: string | null) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : null;
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
    tableNumber?: string;
    status?: OrderStatus;
    total?: string | number;
    paymentMethod?: PaymentMethod;
    customerName?: string;
    customerPhone?: string;
    customerAddress?: string;
    note?: string;
    items?: {
      menuItemId?: string;
      quantity?: number | string;
      note?: string | null;
    }[];
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

    if (data.total !== undefined && Number(data.total) < 0) {
      throw new BadRequestException('total negatif olamaz');
    }

    const orderType = data.type ?? OrderType.DELIVERY;
    const orderCode = data.code?.trim() || (await this.generateOrderCode(data.restaurantId));
    const paymentMethod = data.paymentMethod ?? PaymentMethod.CASH;

    if (data.paymentMethod && !PAYMENT_METHODS.includes(data.paymentMethod)) {
      throw new BadRequestException('Geçersiz ödeme tipi');
    }

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

    const menuItems =
      requestedMenuItemIds.length > 0
        ? await this.prisma.menuItem.findMany({
            where: {
              id: {
                in: requestedMenuItemIds,
              },
              restaurantId: data.restaurantId,
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
            select: {
              id: true,
              name: true,
              price: true,
            },
          })
        : [];

    const menuItemMap = new Map(menuItems.map((menuItem) => [menuItem.id, menuItem]));

    const normalizedItems = requestedItems
      .map((item) => {
        const menuItemId = optionalText(item.menuItemId);

        if (!menuItemId) {
          return null;
        }

        const menuItem = menuItemMap.get(menuItemId);

        if (!menuItem) {
          return null;
        }

        const rawQuantity = Number(item.quantity ?? 1);
        const quantity = Number.isFinite(rawQuantity) && rawQuantity > 0 ? Math.floor(rawQuantity) : 1;
        const unitPrice = Number(menuItem.price);
        const totalPrice = unitPrice * quantity;

        return {
          menuItemId: menuItem.id,
          name: menuItem.name,
          quantity,
          unitPrice,
          totalPrice,
          note: optionalText(item.note),
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    if (requestedItems.length > 0 && normalizedItems.length === 0) {
      throw new BadRequestException('Siparişe eklenecek geçerli ürün bulunamadı');
    }

    const itemsTotal = normalizedItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const calculatedOrderTotal = normalizedItems.length > 0 ? itemsTotal : data.total ?? 0;

    const order = await this.prisma.order.create({
      data: {
        restaurantId: data.restaurantId,
        branchId: data.branchId,
        code: orderCode,
        type: orderType,
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
                  totalPrice: item.totalPrice,
                  note: item.note,
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
        },
      },
    });

    // Auto-approve if enabled
    try {
      const settings = await this.prisma.restaurantSettings.findUnique({
        where: { restaurantId: data.restaurantId },
      });
      if (settings?.autoApproveOrders && order.status === 'PENDING') {
        await this.prisma.order.update({
          where: { id: order.id },
          data: { status: 'ACCEPTED' },
        });
        order.status = 'ACCEPTED';
      }
    } catch (e) {
      // ignore auto-approve errors
    }

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

    // Atomik güncelleme: Order + DeliveryAssignment birlikte kapanır.
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
        },
      },
    });


      // ON_DELIVERY: DeliveryAssignment yoksa oluştur veya mevcut kaydı tekrar aktif hale getir.
      // Sipariş panelinden "Yola Çıkar" yapıldığında teslimat panelinin Aktif listesi bu kayda bakıyor.
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
