import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TableSessionItemStatus, TableSessionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const OPEN_SESSION_STATUSES = [TableSessionStatus.OPEN, TableSessionStatus.PAYMENT_PENDING];

type SessionItemOptionInput = {
  optionId?: string | null;
  groupName?: string;
  optionName?: string;
  priceDelta?: string | number;
};

function cleanText(value?: string | null) {
  if (typeof value !== 'string') return null;

  const text = value.trim();

  return text.length > 0 ? text : null;
}

function normalizeTableCode(value?: string | null, fallback?: string | null) {
  const source = cleanText(value) ?? cleanText(fallback);

  if (!source) return null;

  const normalized = source
    .replace(/[ıİ]/g, 'I')
    .replace(/[ğĞ]/g, 'G')
    .replace(/[üÜ]/g, 'U')
    .replace(/[şŞ]/g, 'S')
    .replace(/[öÖ]/g, 'O')
    .replace(/[çÇ]/g, 'C')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toUpperCase();

  return normalized.length > 0 ? normalized : null;
}

function parseDecimal(value: string | number | Prisma.Decimal | undefined | null, fieldName: string) {
  try {
    const decimal = new Prisma.Decimal(value ?? 0);

    if (!decimal.isFinite()) {
      throw new Error('Invalid decimal');
    }

    return decimal;
  } catch {
    throw new BadRequestException(`${fieldName} geçerli bir sayı olmalıdır`);
  }
}

function parseOptionalDate(value?: string | Date | null) {
  if (value === undefined) return undefined;
  if (value === null) return null;

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException('reservedAt geçerli bir tarih olmalıdır');
  }

  return date;
}

function isPrismaUniqueError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

@Injectable()
export class TableServiceService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureBranch(restaurantId: string, branchId?: string | null) {
    if (!cleanText(branchId)) {
      throw new BadRequestException('branchId zorunludur');
    }

    const branch = await this.prisma.branch.findUnique({
      where: { id: cleanText(branchId) || '' },
    });

    if (!branch) {
      throw new NotFoundException('Şube bulunamadı');
    }

    if (branch.restaurantId !== restaurantId) {
      throw new ForbiddenException('Bu şubeye erişim yok');
    }

    return branch;
  }

  private async ensureDiningArea(restaurantId: string, branchId: string, diningAreaId: string) {
    const area = await this.prisma.diningArea.findUnique({
      where: { id: diningAreaId },
    });

    if (!area || !area.isActive) {
      throw new NotFoundException('Salon / alan bulunamadı');
    }

    if (area.restaurantId !== restaurantId || area.branchId !== branchId) {
      throw new ForbiddenException('Salon / alan bu şubeye ait değil');
    }

    return area;
  }

  private async ensureTable(restaurantId: string, branchId: string, tableId: string) {
    const table = await this.prisma.restaurantTable.findUnique({
      where: { id: tableId },
    });

    if (!table || !table.isActive) {
      throw new NotFoundException('Masa bulunamadı');
    }

    if (table.restaurantId !== restaurantId || table.branchId !== branchId) {
      throw new ForbiddenException('Masa bu şubeye ait değil');
    }

    return table;
  }

  private async ensureEditableSession(restaurantId: string, sessionId: string) {
    const session = await this.getSessionById(restaurantId, sessionId);

    if (session.status === TableSessionStatus.CLOSED || session.status === TableSessionStatus.CANCELLED) {
      throw new BadRequestException('Kapalı veya iptal edilmiş adisyon düzenlenemez');
    }

    return session;
  }

  private async ensureMenuItem(restaurantId: string, branchId: string, menuItemId?: string | null) {
    if (!cleanText(menuItemId)) return null;

    const menuItem = await this.prisma.menuItem.findFirst({
      where: {
        id: cleanText(menuItemId) || '',
        restaurantId,
        isActive: true,
      },
    });

    if (!menuItem) {
      throw new NotFoundException('Menü ürünü bulunamadı');
    }

    if (menuItem.branchId && menuItem.branchId !== branchId) {
      throw new ForbiddenException('Menü ürünü bu şubeye ait değil');
    }

    return menuItem;
  }

  private async prepareSessionOptions(
    restaurantId: string,
    branchId: string,
    menuItemId: string | null,
    options?: SessionItemOptionInput[],
  ) {
    const prepared: {
      optionId: string | null;
      groupName: string;
      optionName: string;
      priceDelta: Prisma.Decimal;
    }[] = [];

    let optionsTotal = new Prisma.Decimal(0);

    for (const rawOption of options ?? []) {
      const optionId = cleanText(rawOption.optionId);

      if (optionId) {
        const option = await this.prisma.menuItemOption.findFirst({
          where: {
            id: optionId,
            restaurantId,
            isActive: true,
          },
          include: {
            group: true,
          },
        });

        if (!option || !option.group || !option.group.isActive) {
          throw new BadRequestException('Geçersiz ürün seçeneği');
        }

        if (option.branchId && option.branchId !== branchId) {
          throw new ForbiddenException('Ürün seçeneği bu şubeye ait değil');
        }

        if (option.group.branchId && option.group.branchId !== branchId) {
          throw new ForbiddenException('Seçenek grubu bu şubeye ait değil');
        }

        if (menuItemId && option.group.menuItemId !== menuItemId) {
          throw new BadRequestException('Seçilen opsiyon bu ürüne ait değil');
        }

        const priceDelta = new Prisma.Decimal(option.priceDelta ?? 0);

        prepared.push({
          optionId: option.id,
          groupName: option.group.name,
          optionName: option.name,
          priceDelta,
        });

        optionsTotal = optionsTotal.add(priceDelta);
        continue;
      }

      const groupName = cleanText(rawOption.groupName);
      const optionName = cleanText(rawOption.optionName);

      if (!groupName || !optionName) {
        throw new BadRequestException('Manuel opsiyon için groupName ve optionName zorunludur');
      }

      const priceDelta = parseDecimal(rawOption.priceDelta ?? 0, 'priceDelta');

      prepared.push({
        optionId: null,
        groupName,
        optionName,
        priceDelta,
      });

      optionsTotal = optionsTotal.add(priceDelta);
    }

    return { prepared, optionsTotal };
  }

  async getDiningAreas(restaurantId: string, branchId: string) {
    await this.ensureBranch(restaurantId, branchId);

    return this.prisma.diningArea.findMany({
      where: {
        restaurantId,
        branchId,
        isActive: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async createDiningArea(
    restaurantId: string,
    data: { branchId: string; name: string; sortOrder?: number },
  ) {
    await this.ensureBranch(restaurantId, data.branchId);

    const name = cleanText(data.name);

    if (!name) {
      throw new BadRequestException('Salon / alan adı zorunludur');
    }

    return this.prisma.diningArea.create({
      data: {
        restaurantId,
        branchId: data.branchId,
        name,
        sortOrder: data.sortOrder ?? 0,
      },
    });
  }

  async patchDiningArea(
    restaurantId: string,
    id: string,
    data: { name?: string; sortOrder?: number; isActive?: boolean },
  ) {
    const area = await this.prisma.diningArea.findUnique({
      where: { id },
    });

    if (!area) {
      throw new NotFoundException('Salon / alan bulunamadı');
    }

    if (area.restaurantId !== restaurantId) {
      throw new ForbiddenException('Bu salon / alanı güncelleme yetkiniz yok');
    }

    if (data.name !== undefined && !cleanText(data.name)) {
      throw new BadRequestException('Salon / alan adı boş olamaz');
    }

    return this.prisma.diningArea.update({
      where: { id },
      data: {
        name: data.name === undefined ? undefined : cleanText(data.name) || undefined,
        sortOrder: data.sortOrder,
        isActive: data.isActive,
      },
    });
  }

  async getTables(restaurantId: string, branchId: string) {
    await this.ensureBranch(restaurantId, branchId);

    return this.prisma.restaurantTable.findMany({
      where: {
        restaurantId,
        branchId,
        isActive: true,
      },
      include: {
        diningArea: true,
        sessions: {
          where: {
            status: {
              in: OPEN_SESSION_STATUSES,
            },
          },
          include: {
            items: {
              include: {
                options: true,
              },
              orderBy: {
                createdAt: 'asc',
              },
            },
          },
          orderBy: {
            openedAt: 'desc',
          },
          take: 1,
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async createTable(
    restaurantId: string,
    data: {
      branchId: string;
      diningAreaId?: string;
      name: string;
      code?: string;
      capacity?: number;
      sortOrder?: number;
    },
  ) {
    await this.ensureBranch(restaurantId, data.branchId);

    const name = cleanText(data.name);

    if (!name) {
      throw new BadRequestException('Masa adı zorunludur');
    }

    if (data.diningAreaId) {
      await this.ensureDiningArea(restaurantId, data.branchId, data.diningAreaId);
    }

    const code = normalizeTableCode(data.code, name);

    if (!code) {
      throw new BadRequestException('Masa kodu oluşturulamadı');
    }

    try {
      return await this.prisma.restaurantTable.create({
        data: {
          restaurantId,
          branchId: data.branchId,
          diningAreaId: data.diningAreaId,
          name,
          code: code ?? undefined,
          capacity: data.capacity,
          sortOrder: data.sortOrder ?? 0,
        },
        include: {
          diningArea: true,
        },
      });
    } catch (error) {
      if (isPrismaUniqueError(error)) {
        throw new ConflictException('Bu şubede aynı masa kodu zaten var');
      }

      throw error;
    }
  }

  async patchTable(
    restaurantId: string,
    id: string,
    data: {
      diningAreaId?: string | null;
      name?: string;
      code?: string;
      capacity?: number | null;
      sortOrder?: number;
      isActive?: boolean;
      isReserved?: boolean;
      reservedName?: string | null;
      reservedPhone?: string | null;
      reservedNote?: string | null;
      reservedAt?: string | Date | null;
    },
  ) {
    const table = await this.prisma.restaurantTable.findUnique({
      where: { id },
    });

    if (!table) {
      throw new NotFoundException('Masa bulunamadı');
    }

    if (table.restaurantId !== restaurantId) {
      throw new ForbiddenException('Bu masayı güncelleme yetkiniz yok');
    }

    if (data.diningAreaId !== undefined && data.diningAreaId !== null) {
      await this.ensureDiningArea(restaurantId, table.branchId, data.diningAreaId);
    }

    if (data.name !== undefined && !cleanText(data.name)) {
      throw new BadRequestException('Masa adı boş olamaz');
    }

    const code = data.code === undefined ? undefined : normalizeTableCode(data.code, data.name ?? table.name);

    if (data.code !== undefined && !code) {
      throw new BadRequestException('Masa kodu boş olamaz');
    }

    if (data.isActive === false) {
      const openSession = await this.prisma.tableSession.findFirst({
        where: {
          tableId: id,
          status: {
            in: OPEN_SESSION_STATUSES,
          },
        },
      });

      if (openSession) {
        throw new BadRequestException('Açık adisyonu olan masa silinemez / pasife alınamaz');
      }
    }

    const reservedAt = parseOptionalDate(data.reservedAt);

    try {
      return await this.prisma.restaurantTable.update({
        where: { id },
        data: {
          diningAreaId: data.diningAreaId,
          name: data.name === undefined ? undefined : cleanText(data.name) || undefined,
          code: code ?? undefined,
          capacity: data.capacity,
          sortOrder: data.sortOrder,
          isActive: data.isActive,
          isReserved: data.isReserved,
          reservedName:
            data.isReserved === false
              ? null
              : data.reservedName === undefined
                ? undefined
                : cleanText(data.reservedName),
          reservedPhone:
            data.isReserved === false
              ? null
              : data.reservedPhone === undefined
                ? undefined
                : cleanText(data.reservedPhone),
          reservedNote:
            data.isReserved === false
              ? null
              : data.reservedNote === undefined
                ? undefined
                : cleanText(data.reservedNote),
          reservedAt: data.isReserved === false ? null : reservedAt,
        },
        include: {
          diningArea: true,
        },
      });
    } catch (error) {
      if (isPrismaUniqueError(error)) {
        throw new ConflictException('Bu şubede aynı masa kodu zaten var');
      }

      throw error;
    }
  }

  async reserveTable(
    restaurantId: string,
    id: string,
    data: {
      reservedName?: string | null;
      reservedPhone?: string | null;
      reservedNote?: string | null;
      reservedAt?: string | Date | null;
    },
  ) {
    const table = await this.prisma.restaurantTable.findUnique({
      where: { id },
    });

    if (!table || !table.isActive) {
      throw new NotFoundException('Masa bulunamadı');
    }

    if (table.restaurantId !== restaurantId) {
      throw new ForbiddenException('Bu masayı rezerve etme yetkiniz yok');
    }

    const openSession = await this.prisma.tableSession.findFirst({
      where: {
        tableId: id,
        status: {
          in: OPEN_SESSION_STATUSES,
        },
      },
    });

    if (openSession) {
      throw new BadRequestException('Açık adisyonu olan masa rezerve edilemez');
    }

    return this.prisma.restaurantTable.update({
      where: { id },
      data: {
        isReserved: true,
        reservedName: cleanText(data.reservedName),
        reservedPhone: cleanText(data.reservedPhone),
        reservedNote: cleanText(data.reservedNote),
        reservedAt: parseOptionalDate(data.reservedAt) ?? new Date(),
      },
      include: {
        diningArea: true,
      },
    });
  }

  async clearTableReservation(restaurantId: string, id: string) {
    const table = await this.prisma.restaurantTable.findUnique({
      where: { id },
    });

    if (!table) {
      throw new NotFoundException('Masa bulunamadı');
    }

    if (table.restaurantId !== restaurantId) {
      throw new ForbiddenException('Bu masanın rezervasyonunu güncelleme yetkiniz yok');
    }

    return this.prisma.restaurantTable.update({
      where: { id },
      data: {
        isReserved: false,
        reservedName: null,
        reservedPhone: null,
        reservedNote: null,
        reservedAt: null,
      },
      include: {
        diningArea: true,
      },
    });
  }

  async getOpenSessions(restaurantId: string, branchId: string) {
    await this.ensureBranch(restaurantId, branchId);

    return this.prisma.tableSession.findMany({
      where: {
        restaurantId,
        branchId,
        status: {
          in: OPEN_SESSION_STATUSES,
        },
      },
      include: {
        table: {
          include: {
            diningArea: true,
          },
        },
        items: {
          include: {
            options: true,
            menuItem: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
      orderBy: {
        openedAt: 'desc',
      },
    });
  }

  async openSession(restaurantId: string, userId: string, data: { branchId: string; tableId: string }) {
    await this.ensureBranch(restaurantId, data.branchId);
    await this.ensureTable(restaurantId, data.branchId, data.tableId);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.tableSession.findFirst({
          where: {
            tableId: data.tableId,
            status: {
              in: OPEN_SESSION_STATUSES,
            },
          },
        });

        if (existing) {
          throw new BadRequestException('Bu masa için açık adisyon zaten var');
        }

        const session = await tx.tableSession.create({
          data: {
            restaurantId,
            branchId: data.branchId,
            tableId: data.tableId,
            openedByUserId: userId,
          },
          include: {
            table: {
              include: {
                diningArea: true,
              },
            },
            items: {
              include: {
                options: true,
              },
              orderBy: {
                createdAt: 'asc',
              },
            },
          },
        });

        await tx.restaurantTable.update({
          where: {
            id: data.tableId,
          },
          data: {
            isReserved: false,
            reservedName: null,
            reservedPhone: null,
            reservedNote: null,
            reservedAt: null,
          },
        });

        return session;
      });
    } catch (error) {
      if (isPrismaUniqueError(error)) {
        throw new ConflictException('Bu masa için açık adisyon zaten var');
      }

      throw error;
    }
  }

  async getSessionById(restaurantId: string, id: string) {
    const session = await this.prisma.tableSession.findUnique({
      where: { id },
      include: {
        table: {
          include: {
            diningArea: true,
          },
        },
        items: {
          include: {
            options: true,
            menuItem: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Adisyon bulunamadı');
    }

    if (session.restaurantId !== restaurantId) {
      throw new ForbiddenException('Bu adisyonu görüntüleme yetkiniz yok');
    }

    return session;
  }

  async addSessionItem(
    restaurantId: string,
    sessionId: string,
    data: {
      menuItemId?: string;
      name?: string;
      quantity?: number;
      unitPrice?: string | number;
      note?: string;
      options?: SessionItemOptionInput[];
    },
  ) {
    const session = await this.ensureEditableSession(restaurantId, sessionId);
    const menuItem = await this.ensureMenuItem(restaurantId, session.branchId, data.menuItemId);

    const quantity = Number(data.quantity ?? 1);

    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new BadRequestException('Adet pozitif tam sayı olmalıdır');
    }

    const name = cleanText(data.name) ?? menuItem?.name;

    if (!name) {
      throw new BadRequestException('Ürün adı zorunludur');
    }

    const unitPrice =
      data.unitPrice === undefined && menuItem
        ? new Prisma.Decimal(menuItem.price)
        : parseDecimal(data.unitPrice ?? 0, 'Birim fiyat');

    if (unitPrice.lessThan(0)) {
      throw new BadRequestException('Birim fiyat negatif olamaz');
    }

    const menuItemId = menuItem?.id ?? null;
    const { prepared, optionsTotal } = await this.prepareSessionOptions(
      restaurantId,
      session.branchId,
      menuItemId,
      data.options,
    );

    const totalPrice = unitPrice.add(optionsTotal).mul(quantity);

    return this.prisma.tableSessionItem.create({
      data: {
        sessionId,
        menuItemId,
        name,
        quantity,
        unitPrice,
        totalPrice,
        note: cleanText(data.note),
        options:
          prepared.length > 0
            ? {
                create: prepared.map((option) => ({
                  optionId: option.optionId,
                  groupName: option.groupName,
                  optionName: option.optionName,
                  priceDelta: option.priceDelta,
                })),
              }
            : undefined,
      },
      include: {
        options: true,
        menuItem: true,
      },
    });
  }

  async patchSessionItem(
    restaurantId: string,
    sessionId: string,
    itemId: string,
    data: {
      quantity?: number;
      unitPrice?: string | number;
      note?: string;
      status?: TableSessionItemStatus;
    },
  ) {
    await this.ensureEditableSession(restaurantId, sessionId);

    const item = await this.prisma.tableSessionItem.findUnique({
      where: { id: itemId },
      include: {
        options: true,
      },
    });

    if (!item || item.sessionId !== sessionId) {
      throw new NotFoundException('Adisyon ürünü bulunamadı');
    }

    const quantity = data.quantity ?? item.quantity;

    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new BadRequestException('Adet pozitif tam sayı olmalıdır');
    }

    const unitPrice =
      data.unitPrice === undefined
        ? new Prisma.Decimal(item.unitPrice)
        : parseDecimal(data.unitPrice, 'Birim fiyat');

    if (unitPrice.lessThan(0)) {
      throw new BadRequestException('Birim fiyat negatif olamaz');
    }

    if (data.status && !Object.values(TableSessionItemStatus).includes(data.status)) {
      throw new BadRequestException('Geçersiz ürün durumu');
    }

    const nextStatus = data.status ?? item.status;
    const optionsTotal = item.options.reduce(
      (total, option) => total.add(new Prisma.Decimal(option.priceDelta)),
      new Prisma.Decimal(0),
    );

    const totalPrice =
      nextStatus === TableSessionItemStatus.VOID
        ? new Prisma.Decimal(0)
        : unitPrice.add(optionsTotal).mul(quantity);

    return this.prisma.tableSessionItem.update({
      where: { id: itemId },
      data: {
        quantity,
        unitPrice,
        totalPrice,
        note: data.note === undefined ? undefined : cleanText(data.note),
        status: data.status,
      },
      include: {
        options: true,
        menuItem: true,
      },
    });
  }

  setPaymentPending(restaurantId: string, id: string) {
    return this.setSessionStatus(restaurantId, id, TableSessionStatus.PAYMENT_PENDING);
  }

  closeSession(restaurantId: string, id: string, userId: string) {
    return this.setSessionStatus(restaurantId, id, TableSessionStatus.CLOSED, userId);
  }

  cancelSession(restaurantId: string, id: string, reason?: string) {
    return this.setSessionStatus(restaurantId, id, TableSessionStatus.CANCELLED, undefined, reason);
  }

  private async setSessionStatus(
    restaurantId: string,
    id: string,
    status: TableSessionStatus,
    closedByUserId?: string,
    cancelledReason?: string,
  ) {
    const session = await this.getSessionById(restaurantId, id);

    if (session.status === TableSessionStatus.CLOSED || session.status === TableSessionStatus.CANCELLED) {
      throw new BadRequestException('Kapalı veya iptal edilmiş adisyon tekrar güncellenemez');
    }

    if (status === TableSessionStatus.PAYMENT_PENDING && session.status !== TableSessionStatus.OPEN) {
      throw new BadRequestException('Sadece açık adisyon ödeme bekliyor durumuna alınabilir');
    }

    return this.prisma.tableSession.update({
      where: { id },
      data: {
        status,
        closedAt:
          status === TableSessionStatus.CLOSED || status === TableSessionStatus.CANCELLED
            ? new Date()
            : undefined,
        closedByUserId,
        cancelledReason: cleanText(cancelledReason),
      },
      include: {
        table: {
          include: {
            diningArea: true,
          },
        },
        items: {
          include: {
            options: true,
            menuItem: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });
  }
}
