export type OutputMode = "json" | "text";

export interface OutputOptions {
  color?: boolean;
  json?: boolean;
  output?: string;
  text?: boolean;
}

export interface SuccessEnvelope<TData> {
  command: string;
  data: TData;
  ok: true;
  requestedAt: string;
  schemaVersion: string;
}

export interface ErrorEnvelope {
  command: string;
  error: {
    code: string;
    details?: unknown;
    message: string;
    retryable: boolean;
  };
  ok: false;
  requestedAt: string;
  schemaVersion: string;
}

export type DayOfWeek =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export type FuelType = "E10" | "E5" | "B7_STANDARD" | "B7_PREMIUM" | "B10" | "HVO";

export type FreshnessBand = "fresh" | "aging" | "stale" | "unknown";

export type NearSort = "best" | "price" | "distance" | "freshest";

export type StationQualityFlag = "likely_test_station";

export type AdvisoryCode =
  | "ALL_PRICES_STALE_OR_UNKNOWN"
  | "ALL_RESULTS_STALE_OR_UNKNOWN"
  | "LIKELY_TEST_STATION"
  | "LIKELY_TEST_STATIONS_EXCLUDED"
  | "MOST_RESULTS_STALE_OR_UNKNOWN";

export interface Advisory {
  code: AdvisoryCode;
  message: string;
  severity: "warning";
}

export type FreshnessCounts = Record<FreshnessBand, number>;

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface ResolvedLocation extends Coordinates {
  displayValue: string;
  kind: "coordinates" | "postcode";
  postcode?: string;
}

export interface DayOpening {
  close: string | null;
  is24Hours: boolean;
  open: string | null;
}

export interface BankHolidayOpening {
  closeTime: string | null;
  is24Hours: boolean;
  openTime: string | null;
  type: string;
}

export interface OpeningTimes {
  bankHoliday: BankHolidayOpening | null;
  usualDays: Partial<Record<DayOfWeek, DayOpening>>;
}

export interface StationLocation extends Coordinates {
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  country: string;
  county: string | null;
  postcode: string;
}

export interface FuelPrice {
  effectiveAt: string | null;
  fuelType: FuelType;
  lastUpdatedAt: string | null;
  pencePerLitre: number;
}

export interface FuelPriceView extends FuelPrice {
  freshnessBand: FreshnessBand;
  freshnessMinutes: number | null;
}

export interface StationCandidate {
  addressLine1: string;
  brandName: string;
  nodeId: string;
  postcode: string;
  tradingName: string;
}

export interface IndexedStation {
  amenities: string[];
  availableFuelTypes: FuelType[];
  brandName: string;
  isMotorwayServiceStation: boolean;
  isSupermarketServiceStation: boolean;
  location: StationLocation;
  nodeId: string;
  openingTimes: OpeningTimes | null;
  permanentClosure: boolean;
  permanentClosureDate: string | null;
  prices: Partial<Record<FuelType, FuelPrice>>;
  publicPhoneNumber: string | null;
  qualityFlags: StationQualityFlag[];
  searchText: string;
  temporaryClosure: boolean;
  tradingName: string;
}

export interface NearStationResult {
  addressLine1: string;
  addressLine2: string | null;
  amenities: string[];
  availableFuelTypes: FuelType[];
  brandName: string;
  city: string;
  country: string;
  county: string | null;
  distanceMiles: number;
  freshnessBand: FreshnessBand;
  freshnessMinutes: number | null;
  isMotorwayServiceStation: boolean;
  isSupermarketServiceStation: boolean;
  lastUpdatedAt: string | null;
  nodeId: string;
  postcode: string;
  qualityFlags: StationQualityFlag[];
  selectedFuelType: FuelType;
  selectedPricePencePerLitre: number;
  tradingName: string;
}

export interface StationDetail {
  amenities: string[];
  availableFuelTypes: FuelType[];
  brandName: string;
  isMotorwayServiceStation: boolean;
  isSupermarketServiceStation: boolean;
  lastUpdatedAt: string | null;
  location: StationLocation;
  nodeId: string;
  openingTimes: OpeningTimes | null;
  permanentClosure: boolean;
  permanentClosureDate: string | null;
  prices: FuelPriceView[];
  publicPhoneNumber: string | null;
  qualityFlags: StationQualityFlag[];
  temporaryClosure: boolean;
  tradingName: string;
}

export interface NearQualitySummary {
  advisories: Advisory[];
  excludedLikelyTestStations: number;
  freshnessCounts: FreshnessCounts;
}

export interface StationQualitySummary {
  advisories: Advisory[];
}

export interface NearCommandData {
  input: {
    fuelType: FuelType;
    limit: number;
    location: string;
    radiusMiles: number;
    refresh: boolean;
    sort: NearSort;
  };
  quality: NearQualitySummary;
  resolvedLocation: ResolvedLocation;
  stations: NearStationResult[];
}

export interface StationCommandData {
  input: {
    query: string;
    refresh: boolean;
  };
  quality: StationQualitySummary;
  station: StationDetail;
}

export interface StationListCommandData {
  input: {
    fuelType: FuelType;
    list: string;
    refresh: boolean;
  };
  stations: Array<{
    availableFuelTypes: FuelType[];
    brandName: string;
    display?: string;
    freshnessBand: FreshnessBand | null;
    freshnessMinutes: number | null;
    lastUpdatedAt: string | null;
    nodeId: string;
    postcode: string;
    qualityFlags: StationQualityFlag[];
    /** Config `sort` key; lower first. Omitted in config sorts last. */
    sortOrder: number;
    selectedFuelType: FuelType | null;
    selectedPricePencePerLitre: number | null;
    tradingName: string;
  }>;
}

export interface CacheEntry<TData> {
  cachedAt: string;
  data: TData;
}

export interface DatasetIndexCacheEntry {
  builtAt: string;
  data: IndexedStation[];
  priceSourceCachedAt: string;
  stationSourceCachedAt: string;
}

export interface DatasetLoadResult {
  builtAt: string;
  priceSourceCachedAt: string;
  stationSourceCachedAt: string;
  stations: IndexedStation[];
}

export interface FuelFinderAccessToken {
  accessToken: string;
  expiresInSeconds: number;
  tokenType: string;
}

export interface FuelFinderClient {
  getAllFuelPrices: () => Promise<RawFuelFinderPriceStation[]>;
  getAllStations: () => Promise<RawFuelFinderStation[]>;
}

export interface PostcodesClient {
  lookupPostcode: (postcode: string) => Promise<{
    latitude: number;
    longitude: number;
    postcode: string;
  }>;
}

export interface FuelService {
  findStation: (query: string, options: { refresh: boolean }) => Promise<StationCommandData>;
  findStationList: (
    listName: string,
    options: {
      fuelType: FuelType;
      refresh: boolean;
      queries: Array<{ display?: string; searchText: string; sort?: number }>;
    }
  ) => Promise<StationListCommandData>;
  findStationsNear: (
    location: string,
    options: {
      fuelType: FuelType;
      limit: number;
      radiusMiles: number;
      refresh: boolean;
      sort: NearSort;
    }
  ) => Promise<NearCommandData>;
}

export interface AppConfig {
  cacheDir: string;
  defaultFuelType?: FuelType;
  fuelFinderBaseUrl: string;
  fuelFinderClientId?: string;
  fuelFinderClientSecret?: string;
}

export interface RawFuelFinderStation {
  amenities: string[];
  brand_name: string | null;
  fuel_types: string[];
  is_motorway_service_station: boolean | null;
  is_same_trading_and_brand_name: boolean | null;
  is_supermarket_service_station: boolean | null;
  location: {
    address_line_1: string | null;
    address_line_2: string | null;
    city: string | null;
    country: string | null;
    county: string | null;
    latitude: number | null;
    longitude: number | null;
    postcode: string | null;
  };
  node_id: string;
  opening_times: {
    bank_holiday: {
      close_time: string | null;
      is_24_hours: boolean | null;
      open_time: string | null;
      type: string | null;
    } | null;
    usual_days: Partial<
      Record<
        DayOfWeek,
        {
          close: string | null;
          is_24_hours: boolean | null;
          open: string | null;
        }
      >
    >;
  } | null;
  permanent_closure: boolean | null;
  permanent_closure_date: string | null;
  public_phone_number: number | string | null;
  temporary_closure: boolean | null;
  trading_name: string | null;
}

export interface RawFuelFinderPriceStation {
  fuel_prices: Array<{
    fuel_type: string;
    price: number;
    price_change_effective_timestamp: string | null;
    price_last_updated: string | null;
  }>;
  node_id: string;
  public_phone_number: number | string | null;
  trading_name: string | null;
}
