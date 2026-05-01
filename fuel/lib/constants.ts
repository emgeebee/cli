import type { FreshnessBand, FuelType, NearSort } from "./types";

export const JSON_SCHEMA_VERSION = "1";

export const DEFAULT_LIMIT = 10;
export const MAX_LIMIT = 50;
export const DEFAULT_RADIUS_MILES = 5;
export const DEFAULT_NEAR_SORT: NearSort = "best";

export const REQUEST_TIMEOUT_MS = 10_000;

/** Paginated Fuel Finder payloads can exceed the default HTTP timeout on slow links. */
export const FUEL_FINDER_BATCH_TIMEOUT_MS = 120_000;

export const TOKEN_EXPIRY_BUFFER_SECONDS = 60;

export const STATION_CACHE_TTL_MS = 60 * 60 * 1_000;
export const PRICE_CACHE_TTL_MS = 15 * 60 * 1_000;

export const FRESHNESS_FRESH_MAX_MINUTES = 30;
export const FRESHNESS_AGING_MAX_MINUTES = 180;

export const FRESHNESS_PENALTIES: Record<FreshnessBand, number> = {
  aging: 1.5,
  fresh: 0,
  stale: 4,
  unknown: 6
};

export const STALE_FRESHNESS_PENALTY_PER_HOUR = 0.75;
export const MAX_STALE_FRESHNESS_PENALTY = 18;
export const LIKELY_TEST_STATION_PENALTY = 18;

export const SUPPORTED_FUEL_TYPES: FuelType[] = [
  "E10",
  "E5",
  "B7_STANDARD",
  "B7_PREMIUM",
  "B10",
  "HVO"
];

export const NEAR_SORT_OPTIONS: NearSort[] = ["best", "price", "distance", "freshest"];

export const CACHE_FILE_NAMES = {
  index: "index.json",
  prices: "prices.json",
  stations: "stations.json"
} as const;
