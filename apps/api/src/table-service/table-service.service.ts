import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TableSessionItemStatus, TableSessionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

function cleanText(value?: string | null) {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}
function cleanCode(value?: string | null) {
  const text = cleanText(value)?.toUpperCase() ?? '';
  return text.replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

@Injectable()
export class TableServiceService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureBranch(restaurantId: string, branchId: string) {
    const branch = await this.prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch) throw new NotFoundException('Şube bulunamadı');
    if (branch.restaurantId !== restaurantId) throw new ForbiddenException('Bu şubeye erişim yok');
    return branch;
  }

  private async ensureTable(restaurantId: string, branchId: string, tableId: string) {
    const table = await this.prisma.restaurantTable.findUnique({ where: { id: tableId } });
    if (!table || !table.isActive) throw new NotFoundException('Masa bulunamadı');
    if (table.restaurantId !== restaurantId || table.branchId !== branchId) {
      throw new ForbiddenException('Masa bu şubeye ait değil');
    }
    return table;
  }

  getDiningAreas(restaurantId: string, branchId: string) {
    return this.prisma.diningArea.findMany({ where: { restaurantId, branchId, isActive: true }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
  }

  async createDiningArea(restaurantId: string, data: { branchId: string; name: string; sortOrder?: number }) {
    await this.ensureBranch(restaurantId, data.branchId);
    if (!cleanText(data.name)) throw new BadRequestException('name zorunludur');
    return this.prisma.diningArea.create({ data: { restaurantId, branchId: data.branchId, name: cleanText(data.name) || '', sortOrder: data.sortOrder ?? 0 } });
  }

  async patchDiningArea(restaurantId: string, id: string, data: { name?: string; sortOrder?: number; isActive?: boolean }) {
    const area = await this.prisma.diningArea.findUnique({ where: { id } });
    if (!area) throw new NotFoundException('Alan bulunamadı');
    if (area.restaurantId !== restaurantId) throw new ForbiddenException('Bu alanı güncelleme yetkiniz yok');
    return this.prisma.diningArea.update({ where: { id }, data: { name: data.name === undefined ? undefined : cleanText(data.name) || '', sortOrder: data.sortOrder, isActive: data.isActive } });
  }

  getTables(restaurantId: string, branchId: string) {
    return this.prisma.restaurantTable.findMany({ where: { restaurantId, branchId, isActive: true }, include: { diningArea: true }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
  }

  async createTable(restaurantId: string, data: { branchId: string; diningAreaId?: string; name: string; code?: string; capacity?: number; sortOrder?: number }) {
    await this.ensureBranch(restaurantId, data.branchId);
    if (!cleanText(data.name)) throw new BadRequestException('name zorunludur');
    const tableName = cleanText(data.name) || '';
    const finalCode = cleanCode(data.code) || cleanCode(tableName);
    if (!finalCode) throw new BadRequestException('code zorunludur');
    if (data.diningAreaId) {
      const area = await this.prisma.diningArea.findUnique({ where: { id: data.diningAreaId } });
      if (!area || !area.isActive || area.restaurantId !== restaurantId || area.branchId !== data.branchId) throw new BadRequestException('Geçersiz diningAreaId');
    }
    return this.prisma.restaurantTable.create({ data: { restaurantId, branchId: data.branchId, diningAreaId: data.diningAreaId, code: finalCode, name: tableName, capacity: data.capacity, sortOrder: data.sortOrder ?? 0 } });
  }

  async patchTable(restaurantId: string, id: string, data: { diningAreaId?: string | null; name?: string; capacity?: number | null; sortOrder?: number; isActive?: boolean }) {
    const table = await this.prisma.restaurantTable.findUnique({ where: { id } });
    if (!table) throw new NotFoundException('Masa bulunamadı');
    if (table.restaurantId !== restaurantId) throw new ForbiddenException('Bu masayı güncelleme yetkiniz yok');
    if (data.diningAreaId !== undefined && data.diningAreaId !== null) {
      const area = await this.prisma.diningArea.findUnique({ where: { id: data.diningAreaId } });
      if (!area || !area.isActive || area.restaurantId !== restaurantId || area.branchId !== table.branchId) throw new BadRequestException('Geçersiz diningAreaId');
    }
    return this.prisma.restaurantTable.update({ where: { id }, data: { diningAreaId: data.diningAreaId, name: data.name === undefined ? undefined : cleanText(data.name) || '', capacity: data.capacity, sortOrder: data.sortOrder, isActive: data.isActive }, include: { diningArea: true } });
  }

  getOpenSessions(restaurantId: string, branchId: string) { return this.prisma.tableSession.findMany({ where: { restaurantId, branchId, status: { in: [TableSessionStatus.OPEN, TableSessionStatus.PAYMENT_PENDING] } }, include: { table: true }, orderBy: { openedAt: 'desc' } }); }

  async openSession(restaurantId: string, userId: string, data: { branchId: string; tableId: string }) {
    await this.ensureBranch(restaurantId, data.branchId);
    await this.ensureTable(restaurantId, data.branchId, data.tableId);
    const existing = await this.prisma.tableSession.findFirst({ where: { tableId: data.tableId, status: { in: [TableSessionStatus.OPEN, TableSessionStatus.PAYMENT_PENDING] } } });
    if (existing) throw new BadRequestException('Bu masa için açık adisyon zaten var');
    return this.prisma.tableSession.create({ data: { restaurantId, branchId: data.branchId, tableId: data.tableId, openedByUserId: userId } });
  }

  async getSessionById(restaurantId: string, id: string) {
    const s = await this.prisma.tableSession.findUnique({ where: { id }, include: { table: true, items: { include: { options: true }, orderBy: { createdAt: 'asc' } } } });
    if (!s) throw new NotFoundException('Adisyon bulunamadı');
    if (s.restaurantId !== restaurantId) throw new ForbiddenException('Bu adisyonu görüntüleme yetkiniz yok');
    return s;
  }

  async addSessionItem(restaurantId: string, sessionId: string, data: { menuItemId?: string; name: string; quantity: number; unitPrice: string | number; note?: string }) {
    const session = await this.getSessionById(restaurantId, sessionId);
    if (session.status !== TableSessionStatus.OPEN && session.status !== TableSessionStatus.PAYMENT_PENDING) throw new BadRequestException('Kapalı adisyona ürün eklenemez');
    if (data.menuItemId) {
      const menuItem = await this.prisma.menuItem.findUnique({ where: { id: data.menuItemId } });
      if (!menuItem || !menuItem.isActive || menuItem.restaurantId !== restaurantId) {
        throw new BadRequestException('Geçersiz menuItemId');
      }
      if (menuItem.branchId && menuItem.branchId !== session.branchId) {
        throw new BadRequestException('Menu item bu şubede geçerli değil');
      }
    }
    const quantity = Number(data.quantity ?? 1);
    if (!Number.isInteger(quantity) || quantity <= 0) throw new BadRequestException('quantity pozitif tam sayı olmalıdır');
    const unitPrice = new Prisma.Decimal(data.unitPrice ?? 0);
    if (unitPrice.lessThan(0)) throw new BadRequestException('unitPrice negatif olamaz');
    return this.prisma.tableSessionItem.create({ data: { sessionId, menuItemId: data.menuItemId, name: cleanText(data.name) || '', quantity, unitPrice, totalPrice: unitPrice.mul(quantity), note: cleanText(data.note) } });
  }

  async patchSessionItem(restaurantId: string, sessionId: string, itemId: string, data: { quantity?: number; unitPrice?: string | number; note?: string; status?: TableSessionItemStatus }) {
    const session = await this.getSessionById(restaurantId, sessionId);
    if (session.status === TableSessionStatus.CLOSED || session.status === TableSessionStatus.CANCELLED) {
      throw new BadRequestException('Kapalı adisyonda düzenleme yapılamaz');
    }
    const item = await this.prisma.tableSessionItem.findUnique({ where: { id: itemId } });
    if (!item || item.sessionId !== sessionId) throw new NotFoundException('Adisyon ürünü bulunamadı');
    if (data.quantity !== undefined && (!Number.isInteger(data.quantity) || data.quantity <= 0)) {
      throw new BadRequestException('quantity pozitif tam sayı olmalıdır');
    }
    if (data.unitPrice !== undefined && new Prisma.Decimal(data.unitPrice).lessThan(0)) {
      throw new BadRequestException('unitPrice negatif olamaz');
    }
    const quantity = data.quantity ?? item.quantity;
    const unitPrice = data.unitPrice === undefined ? new Prisma.Decimal(item.unitPrice) : new Prisma.Decimal(data.unitPrice);
    return this.prisma.tableSessionItem.update({ where: { id: itemId }, data: { quantity, unitPrice, totalPrice: unitPrice.mul(quantity), note: data.note === undefined ? undefined : cleanText(data.note), status: data.status } });
  }

  setPaymentPending(restaurantId: string, id: string) { return this.setSessionStatus(restaurantId, id, TableSessionStatus.PAYMENT_PENDING); }
  closeSession(restaurantId: string, id: string, userId: string) { return this.setSessionStatus(restaurantId, id, TableSessionStatus.CLOSED, userId); }
  cancelSession(restaurantId: string, id: string, reason?: string) { return this.setSessionStatus(restaurantId, id, TableSessionStatus.CANCELLED, undefined, reason); }

  private async setSessionStatus(restaurantId: string, id: string, status: TableSessionStatus, closedByUserId?: string, cancelledReason?: string) {
    await this.getSessionById(restaurantId, id);
    return this.prisma.tableSession.update({ where: { id }, data: { status, closedAt: status === TableSessionStatus.CLOSED || status === TableSessionStatus.CANCELLED ? new Date() : undefined, closedByUserId, cancelledReason: cleanText(cancelledReason) } });
  }
}
