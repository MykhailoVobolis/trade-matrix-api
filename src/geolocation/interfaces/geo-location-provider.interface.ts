export type GeoLocationLookupResult = {
  city: string | null;
};

export interface GeoLocationProvider {
  lookup(ipAddress: string): Promise<GeoLocationLookupResult>;
}
