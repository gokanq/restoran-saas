// apps/api/src/deliveries/mapbox.service.ts
import { Injectable, Logger } from '@nestjs/common';

interface DirectionsResult {
  distance: number; // km
  duration: number; // dakika
  geometry: string; // encoded polyline
}

@Injectable()
export class MapboxService {
  private readonly logger = new Logger(MapboxService.name);
  private readonly token = process.env.MAPBOX_TOKEN || '';

  async getDirections(
    fromLat: number,
    fromLng: number,
    toLat: number,
    toLng: number,
  ): Promise<DirectionsResult | null> {
    if (!this.token) {
      this.logger.warn('MAPBOX_TOKEN tanımlı değil, Haversine fallback kullanılıyor');
      return this.fallback(fromLat, fromLng, toLat, toLng);
    }

    try {
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${fromLng},${fromLat};${toLng},${toLat}?geometries=polyline&overview=full&access_token=${this.token}`;
      const response = await fetch(url);

      if (!response.ok) {
        this.logger.error(`Mapbox API hatası: ${response.status}`);
        return this.fallback(fromLat, fromLng, toLat, toLng);
      }

      const data: any = await response.json();
      const route = data.routes?.[0];

      if (!route) {
        return this.fallback(fromLat, fromLng, toLat, toLng);
      }

      return {
        distance: Math.round((route.distance / 1000) * 100) / 100,
        duration: Math.round(route.duration / 60),
        geometry: route.geometry,
      };
    } catch (e: any) {
      this.logger.error('Mapbox directions hatası', e.message);
      return this.fallback(fromLat, fromLng, toLat, toLng);
    }
  }

  // Haversine formülü ile kuş uçuşu mesafe (fallback)
  private fallback(lat1: number, lng1: number, lat2: number, lng2: number): DirectionsResult {
    const distance = this.haversine(lat1, lng1, lat2, lng2);
    const duration = Math.round((distance / 30) * 60); // 30 km/h ortalama hız
    return { distance, duration, geometry: '' };
  }

  haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // km
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 100) / 100;
  }

  private toRad(deg: number) {
    return (deg * Math.PI) / 180;
  }

  // Mapbox geocoding - adres -> koordinat
  async geocode(address: string): Promise<{ lat: number; lng: number } | null> {
    if (!this.token || !address) return null;
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?country=tr&access_token=${this.token}`;
      const response = await fetch(url);
      if (!response.ok) return null;
      const data: any = await response.json();
      const coords = data.features?.[0]?.center;
      if (!coords) return null;
      return { lat: coords[1], lng: coords[0] };
    } catch {
      return null;
    }
  }
}
