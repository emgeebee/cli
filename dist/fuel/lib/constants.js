"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CACHE_FILE_NAMES = exports.NEAR_SORT_OPTIONS = exports.SUPPORTED_FUEL_TYPES = exports.LIKELY_TEST_STATION_PENALTY = exports.MAX_STALE_FRESHNESS_PENALTY = exports.STALE_FRESHNESS_PENALTY_PER_HOUR = exports.FRESHNESS_PENALTIES = exports.FRESHNESS_AGING_MAX_MINUTES = exports.FRESHNESS_FRESH_MAX_MINUTES = exports.PRICE_CACHE_TTL_MS = exports.STATION_CACHE_TTL_MS = exports.TOKEN_EXPIRY_BUFFER_SECONDS = exports.FUEL_FINDER_BATCH_TIMEOUT_MS = exports.REQUEST_TIMEOUT_MS = exports.DEFAULT_NEAR_SORT = exports.DEFAULT_RADIUS_MILES = exports.MAX_LIMIT = exports.DEFAULT_LIMIT = exports.JSON_SCHEMA_VERSION = void 0;
exports.JSON_SCHEMA_VERSION = "1";
exports.DEFAULT_LIMIT = 10;
exports.MAX_LIMIT = 50;
exports.DEFAULT_RADIUS_MILES = 5;
exports.DEFAULT_NEAR_SORT = "best";
exports.REQUEST_TIMEOUT_MS = 10_000;
/** Paginated Fuel Finder payloads can exceed the default HTTP timeout on slow links. */
exports.FUEL_FINDER_BATCH_TIMEOUT_MS = 120_000;
exports.TOKEN_EXPIRY_BUFFER_SECONDS = 60;
exports.STATION_CACHE_TTL_MS = 60 * 60 * 1_000;
exports.PRICE_CACHE_TTL_MS = 15 * 60 * 1_000;
exports.FRESHNESS_FRESH_MAX_MINUTES = 30;
exports.FRESHNESS_AGING_MAX_MINUTES = 180;
exports.FRESHNESS_PENALTIES = {
    aging: 1.5,
    fresh: 0,
    stale: 4,
    unknown: 6
};
exports.STALE_FRESHNESS_PENALTY_PER_HOUR = 0.75;
exports.MAX_STALE_FRESHNESS_PENALTY = 18;
exports.LIKELY_TEST_STATION_PENALTY = 18;
exports.SUPPORTED_FUEL_TYPES = [
    "E10",
    "E5",
    "B7_STANDARD",
    "B7_PREMIUM",
    "B10",
    "HVO"
];
exports.NEAR_SORT_OPTIONS = ["best", "price", "distance", "freshest"];
exports.CACHE_FILE_NAMES = {
    index: "index.json",
    prices: "prices.json",
    stations: "stations.json"
};
