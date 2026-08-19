import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GEO_LOCATION_PROVIDER } from './constants/geo-location-provider.token';
import { GeoLocationService } from './geo-location.service';
import { IpInfoGeoLocationProvider } from './providers/ipinfo-geo-location.provider';

@Module({
  imports: [ConfigModule],
  providers: [
    GeoLocationService,
    IpInfoGeoLocationProvider,
    {
      provide: GEO_LOCATION_PROVIDER,
      useExisting: IpInfoGeoLocationProvider,
    },
  ],
  exports: [GeoLocationService],
})
export class GeoLocationModule {}
