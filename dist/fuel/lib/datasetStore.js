"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDatasetStore = void 0;
const constants_1 = require("./constants");
const fileCache_1 = require("./fileCache");
const normalizers_1 = require("./normalizers");
const createDatasetStore = (cacheDir, fuelFinderClient) => {
    const cachePaths = (0, fileCache_1.getCachePaths)(cacheDir);
    const hasCompatibleIndexStation = (station) => Array.isArray(station.qualityFlags);
    const loadOrRefreshCache = async (path, ttlMs, refresh, fetchData) => {
        const cachedEntry = await (0, fileCache_1.readCacheEntry)(path);
        if (!refresh && cachedEntry && (0, fileCache_1.isCacheFresh)(cachedEntry.cachedAt, ttlMs)) {
            return cachedEntry;
        }
        try {
            const nextEntry = {
                cachedAt: new Date().toISOString(),
                data: await fetchData()
            };
            await (0, fileCache_1.writeCacheEntry)(path, nextEntry);
            return nextEntry;
        }
        catch (error) {
            if (cachedEntry) {
                return cachedEntry;
            }
            throw error;
        }
    };
    const readIndexEntry = async () => (0, fileCache_1.readDatasetIndexCacheEntry)(cachePaths.index);
    return {
        getDataset: async (options = {}) => {
            const refresh = options.refresh ?? false;
            const stationEntry = await loadOrRefreshCache(cachePaths.stations, constants_1.STATION_CACHE_TTL_MS, refresh, () => fuelFinderClient.getAllStations());
            const priceEntry = await loadOrRefreshCache(cachePaths.prices, constants_1.PRICE_CACHE_TTL_MS, refresh, () => fuelFinderClient.getAllFuelPrices());
            const indexEntry = await readIndexEntry();
            if (indexEntry &&
                indexEntry.data.every((station) => hasCompatibleIndexStation(station)) &&
                indexEntry.stationSourceCachedAt === stationEntry.cachedAt &&
                indexEntry.priceSourceCachedAt === priceEntry.cachedAt) {
                return {
                    builtAt: indexEntry.builtAt,
                    priceSourceCachedAt: indexEntry.priceSourceCachedAt,
                    stationSourceCachedAt: indexEntry.stationSourceCachedAt,
                    stations: indexEntry.data
                };
            }
            const nextIndexEntry = {
                builtAt: new Date().toISOString(),
                data: (0, normalizers_1.buildIndexedStations)(stationEntry.data, priceEntry.data),
                priceSourceCachedAt: priceEntry.cachedAt,
                stationSourceCachedAt: stationEntry.cachedAt
            };
            await (0, fileCache_1.writeDatasetIndexCacheEntry)(cachePaths.index, nextIndexEntry);
            return {
                builtAt: nextIndexEntry.builtAt,
                priceSourceCachedAt: nextIndexEntry.priceSourceCachedAt,
                stationSourceCachedAt: nextIndexEntry.stationSourceCachedAt,
                stations: nextIndexEntry.data
            };
        }
    };
};
exports.createDatasetStore = createDatasetStore;
