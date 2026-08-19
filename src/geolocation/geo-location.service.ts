import { Inject, Injectable, Logger } from '@nestjs/common';
import { GEO_LOCATION_PROVIDER } from './constants/geo-location-provider.token';
import type { GeoLocationProvider } from './interfaces/geo-location-provider.interface';

@Injectable()
export class GeoLocationService {
  private readonly logger = new Logger(GeoLocationService.name);

  constructor(
    @Inject(GEO_LOCATION_PROVIDER)
    private readonly geoLocationProvider: GeoLocationProvider,
  ) {}

  async lookupCity(ipAddress?: string): Promise<string | null> {
    const normalizedIp = this.normalizeIpAddress(ipAddress);

    if (!normalizedIp) {
      this.logger.log({
        scope: 'geo_location_lookup',
        rawIpAddress: ipAddress ?? null,
        normalizedIpAddress: null,
        outcome: 'skipped',
        reason: 'missing_or_empty_ip',
        city: null,
      });

      return null;
    }

    if (this.isPrivateIpAddress(normalizedIp)) {
      this.logger.log({
        scope: 'geo_location_lookup',
        rawIpAddress: ipAddress ?? null,
        normalizedIpAddress: normalizedIp,
        outcome: 'skipped',
        reason: 'private_or_local_ip',
        city: null,
      });

      return null;
    }

    const result = await this.geoLocationProvider.lookup(normalizedIp);

    this.logger.log({
      scope: 'geo_location_lookup',
      rawIpAddress: ipAddress ?? null,
      normalizedIpAddress: normalizedIp,
      outcome: 'resolved',
      reason: null,
      city: result.city ?? null,
    });

    return result.city;
  }

  private normalizeIpAddress(ipAddress?: string): string | null {
    const normalizedIp = ipAddress?.trim();

    if (!normalizedIp) {
      return null;
    }

    const firstForwardedIp = normalizedIp.split(',')[0]?.trim();

    if (!firstForwardedIp) {
      return null;
    }

    if (firstForwardedIp.startsWith('::ffff:')) {
      return firstForwardedIp.slice('::ffff:'.length);
    }

    if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/u.test(firstForwardedIp)) {
      return firstForwardedIp.replace(/:\d+$/u, '');
    }

    if (/^\[[^\]]+\]:\d+$/u.test(firstForwardedIp)) {
      return firstForwardedIp.replace(/^\[([^\]]+)\]:\d+$/u, '$1');
    }

    return firstForwardedIp;
  }

  private isPrivateIpAddress(ipAddress: string): boolean {
    if (
      ipAddress === 'localhost' ||
      ipAddress === '127.0.0.1' ||
      ipAddress === '0.0.0.0' ||
      ipAddress === '::1'
    ) {
      return true;
    }

    if (ipAddress.includes(':')) {
      const lowerIp = ipAddress.toLowerCase();

      return (
        lowerIp.startsWith('fc') ||
        lowerIp.startsWith('fd') ||
        lowerIp.startsWith('fe80:')
      );
    }

    const octets = ipAddress.split('.').map(Number);

    if (octets.length !== 4 || octets.some((octet) => Number.isNaN(octet))) {
      return false;
    }

    const [firstOctet, secondOctet] = octets;

    return (
      firstOctet === 10 ||
      (firstOctet === 172 && secondOctet >= 16 && secondOctet <= 31) ||
      (firstOctet === 192 && secondOctet === 168) ||
      (firstOctet === 169 && secondOctet === 254)
    );
  }
}
