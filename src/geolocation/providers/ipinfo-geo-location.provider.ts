import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GeoLocationLookupResult,
  GeoLocationProvider,
} from '../interfaces/geo-location-provider.interface';

type IpInfoResponse = {
  city?: string;
};

@Injectable()
export class IpInfoGeoLocationProvider implements GeoLocationProvider {
  constructor(private readonly configService: ConfigService) {}

  async lookup(ipAddress: string): Promise<GeoLocationLookupResult> {
    const token = this.configService.get<string>('IPINFO_TOKEN');

    if (!token) {
      return { city: null };
    }

    try {
      const response = await fetch(
        `https://ipinfo.io/${encodeURIComponent(ipAddress)}/json?token=${encodeURIComponent(
          token,
        )}`,
        { signal: AbortSignal.timeout(1500) },
      );

      if (!response.ok) {
        return { city: null };
      }

      const data = (await response.json()) as IpInfoResponse;

      return {
        city: data.city?.trim() || null,
      };
    } catch {
      return { city: null };
    }
  }
}
