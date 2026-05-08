// apps/api/src/deliveries/courier-auth.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { randomBytes } from 'crypto';

@Injectable()
export class CourierAuthService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Esnek login: phone+pin (klasik) veya sadece pin (hızlı, küçük ekiplerde) kabul eder.
   * PIN-only modda PIN'in restoran içinde unique olması beklenir.
   */
  async loginWithPin(input: { phone?: string; pin?: string; pinCode?: string }) {
    const pin = (input.pin || input.pinCode || '').trim();
    const phone = (input.phone || '').trim();

    if (!pin) throw new UnauthorizedException('PIN gerekli');

    let courier = null as null | Awaited<ReturnType<typeof this.prisma.courier.findFirst>>;

    if (phone) {
      const phoneNorm = phone.replace(/\D/g, '');
      courier = await this.prisma.courier.findFirst({
        where: {
          isActive: true,
          OR: [{ phone }, { phone: phoneNorm }],
        },
      });
      if (!courier) throw new UnauthorizedException('Kurye bulunamadı');
      if (courier.pinCode !== pin) throw new UnauthorizedException('PIN hatalı');
    } else {
      // PIN-only: aktif kuryeler arasında PIN'i eşleşen ilk kuryeyi al
      const matches = await this.prisma.courier.findMany({
        where: { isActive: true, pinCode: pin },
        take: 2,
      });
      if (matches.length === 0) throw new UnauthorizedException('PIN hatalı');
      if (matches.length > 1) {
        throw new UnauthorizedException(
          'Bu PIN birden fazla kuryede tanımlı. Lütfen telefon numarasıyla giriş yapın.',
        );
      }
      courier = matches[0];
    }

    const token = randomBytes(32).toString('hex');
    await this.prisma.courier.update({
      where: { id: courier.id },
      data: { authToken: token, isOnline: true },
    });

    return {
      token,
      courier: {
        id: courier.id,
        name: courier.name,
        phone: courier.phone,
        restaurantId: courier.restaurantId,
      },
    };
  }

  async validateToken(token: string) {
    if (!token) throw new UnauthorizedException();
    const courier = await this.prisma.courier.findFirst({
      where: { authToken: token, isActive: true },
    });
    if (!courier) throw new UnauthorizedException('Geçersiz token');
    return courier;
  }

  async logout(token: string) {
    const courier = await this.validateToken(token);
    await this.prisma.courier.update({
      where: { id: courier.id },
      data: { authToken: null, isOnline: false },
    });
    return { success: true };
  }
}
