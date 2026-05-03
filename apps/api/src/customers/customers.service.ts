import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type CustomerAddressInput = {
  title?: string | null;
  type?: string | null;
  district?: string | null;
  neighborhood?: string | null;
  street?: string | null;
  buildingNo?: string | null;
  floorNo?: string | null;
  doorNo?: string | null;
  description?: string | null;
  fullAddress?: string | null;
  isDefault?: boolean | null;
};

type CustomerInput = {
  branchId?: string | null;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  addresses?: CustomerAddressInput[];
};

function optionalText(value?: string | null) {
  const trimmed = String(value || '').trim();

  return trimmed.length > 0 ? trimmed : null;
}

function normalizePhone(value?: string | null) {
  const digits = String(value || '').replace(/\D/g, '');

  if (!digits) {
    return null;
  }

  return digits.length > 10 ? digits.slice(-10) : digits;
}

function buildFullAddress(address: CustomerAddressInput) {
  const providedFullAddress = optionalText(address.fullAddress);

  if (providedFullAddress) {
    return providedFullAddress;
  }

  const parts = [
    optionalText(address.district),
    optionalText(address.neighborhood),
    optionalText(address.street),
    optionalText(address.buildingNo) ? `Bina No: ${optionalText(address.buildingNo)}` : null,
    optionalText(address.floorNo) ? `Kat: ${optionalText(address.floorNo)}` : null,
    optionalText(address.doorNo) ? `Kapı: ${optionalText(address.doorNo)}` : null,
    optionalText(address.description),
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(', ') : null;
}

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  private includeAddresses() {
    return {
      addresses: {
        where: {
          deletedAt: null,
        },
        orderBy: [
          { isDefault: 'desc' as const },
          { createdAt: 'asc' as const },
        ],
      },
    };
  }

  private async assertBranchBelongsToRestaurant(restaurantId: string, branchId?: string | null) {
    if (!branchId) {
      return;
    }

    const branch = await this.prisma.branch.findFirst({
      where: {
        id: branchId,
        restaurantId,
      },
      select: {
        id: true,
      },
    });

    if (!branch) {
      throw new BadRequestException('Şube bulunamadı veya bu restorana ait değil');
    }
  }

  async list(restaurantId: string, query?: string) {
    const trimmedQuery = optionalText(query);
    const phoneQuery = normalizePhone(query);

    const where: Prisma.CustomerWhereInput = {
      restaurantId,
      deletedAt: null,
    };

    if (trimmedQuery) {
      where.OR = [
        { name: { contains: trimmedQuery, mode: 'insensitive' } },
        { phone: { contains: trimmedQuery, mode: 'insensitive' } },
        { email: { contains: trimmedQuery, mode: 'insensitive' } },
      ];

      if (phoneQuery) {
        where.OR.push({ phoneNormalized: { contains: phoneQuery } });
      }
    }

    return this.prisma.customer.findMany({
      where,
      include: this.includeAddresses(),
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
    });
  }

  async findByPhone(restaurantId: string, phone: string) {
    const phoneNormalized = normalizePhone(phone);

    if (!phoneNormalized) {
      throw new BadRequestException('Telefon numarası zorunlu');
    }

    return this.prisma.customer.findFirst({
      where: {
        restaurantId,
        phoneNormalized,
        deletedAt: null,
      },
      include: this.includeAddresses(),
      orderBy: {
        updatedAt: 'desc',
      },
    });
  }

  async get(restaurantId: string, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: {
        id,
        restaurantId,
        deletedAt: null,
      },
      include: this.includeAddresses(),
    });

    if (!customer) {
      throw new NotFoundException('Müşteri bulunamadı');
    }

    return customer;
  }

  async create(restaurantId: string, data: CustomerInput) {
    const name = optionalText(data.name);
    const phone = optionalText(data.phone);
    const phoneNormalized = normalizePhone(phone);

    if (!name) {
      throw new BadRequestException('Müşteri adı zorunlu');
    }

    await this.assertBranchBelongsToRestaurant(restaurantId, data.branchId);

    if (phoneNormalized) {
      const existingCustomer = await this.prisma.customer.findFirst({
        where: {
          restaurantId,
          phoneNormalized,
          deletedAt: null,
        },
        select: {
          id: true,
        },
      });

      if (existingCustomer) {
        throw new ConflictException('Bu telefon numarasıyla kayıtlı müşteri zaten var');
      }
    }

    const addresses = Array.isArray(data.addresses) ? data.addresses : [];
    const defaultAddressIndex = addresses.findIndex((address) => Boolean(address.isDefault));

    return this.prisma.customer.create({
      data: {
        restaurantId,
        branchId: optionalText(data.branchId),
        name,
        phone,
        phoneNormalized,
        email: optionalText(data.email),
        notes: optionalText(data.notes),
        addresses: {
          create: addresses.map((address, index) => ({
            title: optionalText(address.title),
            type: optionalText(address.type) || 'Ev',
            district: optionalText(address.district),
            neighborhood: optionalText(address.neighborhood),
            street: optionalText(address.street),
            buildingNo: optionalText(address.buildingNo),
            floorNo: optionalText(address.floorNo),
            doorNo: optionalText(address.doorNo),
            description: optionalText(address.description),
            fullAddress: buildFullAddress(address),
            isDefault: defaultAddressIndex >= 0 ? index === defaultAddressIndex : index === 0,
          })),
        },
      },
      include: this.includeAddresses(),
    });
  }

  async update(restaurantId: string, id: string, data: CustomerInput) {
    await this.get(restaurantId, id);
    await this.assertBranchBelongsToRestaurant(restaurantId, data.branchId);

    const phone = optionalText(data.phone);
    const phoneNormalized = normalizePhone(phone);

    if (phoneNormalized) {
      const existingCustomer = await this.prisma.customer.findFirst({
        where: {
          restaurantId,
          phoneNormalized,
          deletedAt: null,
          NOT: {
            id,
          },
        },
        select: {
          id: true,
        },
      });

      if (existingCustomer) {
        throw new ConflictException('Bu telefon numarası başka müşteride kayıtlı');
      }
    }

    return this.prisma.customer.update({
      where: {
        id,
      },
      data: {
        branchId: data.branchId === undefined ? undefined : optionalText(data.branchId),
        name: data.name === undefined ? undefined : optionalText(data.name) || undefined,
        phone: data.phone === undefined ? undefined : phone,
        phoneNormalized: data.phone === undefined ? undefined : phoneNormalized,
        email: data.email === undefined ? undefined : optionalText(data.email),
        notes: data.notes === undefined ? undefined : optionalText(data.notes),
      },
      include: this.includeAddresses(),
    });
  }

  async softDelete(restaurantId: string, id: string) {
    await this.get(restaurantId, id);

    return this.prisma.customer.update({
      where: {
        id,
      },
      data: {
        isActive: false,
        deletedAt: new Date(),
        addresses: {
          updateMany: {
            where: {
              deletedAt: null,
            },
            data: {
              isActive: false,
              deletedAt: new Date(),
            },
          },
        },
      },
    });
  }

  async createAddress(restaurantId: string, customerId: string, data: CustomerAddressInput) {
    await this.get(restaurantId, customerId);

    if (data.isDefault) {
      await this.prisma.customerAddress.updateMany({
        where: {
          customerId,
          deletedAt: null,
        },
        data: {
          isDefault: false,
        },
      });
    }

    return this.prisma.customerAddress.create({
      data: {
        customerId,
        title: optionalText(data.title),
        type: optionalText(data.type) || 'Ev',
        district: optionalText(data.district),
        neighborhood: optionalText(data.neighborhood),
        street: optionalText(data.street),
        buildingNo: optionalText(data.buildingNo),
        floorNo: optionalText(data.floorNo),
        doorNo: optionalText(data.doorNo),
        description: optionalText(data.description),
        fullAddress: buildFullAddress(data),
        isDefault: Boolean(data.isDefault),
      },
    });
  }

  async updateAddress(restaurantId: string, customerId: string, addressId: string, data: CustomerAddressInput) {
    await this.get(restaurantId, customerId);

    const address = await this.prisma.customerAddress.findFirst({
      where: {
        id: addressId,
        customerId,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!address) {
      throw new NotFoundException('Adres bulunamadı');
    }

    if (data.isDefault) {
      await this.prisma.customerAddress.updateMany({
        where: {
          customerId,
          deletedAt: null,
          NOT: {
            id: addressId,
          },
        },
        data: {
          isDefault: false,
        },
      });
    }

    return this.prisma.customerAddress.update({
      where: {
        id: addressId,
      },
      data: {
        title: data.title === undefined ? undefined : optionalText(data.title),
        type: data.type === undefined ? undefined : optionalText(data.type) || 'Ev',
        district: data.district === undefined ? undefined : optionalText(data.district),
        neighborhood: data.neighborhood === undefined ? undefined : optionalText(data.neighborhood),
        street: data.street === undefined ? undefined : optionalText(data.street),
        buildingNo: data.buildingNo === undefined ? undefined : optionalText(data.buildingNo),
        floorNo: data.floorNo === undefined ? undefined : optionalText(data.floorNo),
        doorNo: data.doorNo === undefined ? undefined : optionalText(data.doorNo),
        description: data.description === undefined ? undefined : optionalText(data.description),
        fullAddress: buildFullAddress(data),
        isDefault: data.isDefault === undefined ? undefined : Boolean(data.isDefault),
      },
    });
  }

  async softDeleteAddress(restaurantId: string, customerId: string, addressId: string) {
    await this.get(restaurantId, customerId);

    const address = await this.prisma.customerAddress.findFirst({
      where: {
        id: addressId,
        customerId,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!address) {
      throw new NotFoundException('Adres bulunamadı');
    }

    return this.prisma.customerAddress.update({
      where: {
        id: addressId,
      },
      data: {
        isActive: false,
        isDefault: false,
        deletedAt: new Date(),
      },
    });
  }
}
