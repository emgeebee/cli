import { PRICE_CACHE_TTL_MS, STATION_CACHE_TTL_MS } from "./constants";
import {
  getCachePaths,
  isCacheFresh,
  readCacheEntry,
  readDatasetIndexCacheEntry,
  writeCacheEntry,
  writeDatasetIndexCacheEntry
} from "./fileCache";
import { buildIndexedStations } from "./normalizers";

import type {
  CacheEntry,
  DatasetIndexCacheEntry,
  DatasetLoadResult,
  FuelFinderClient,
  RawFuelFinderPriceStation,
  RawFuelFinderStation
} from "./types";

export interface DatasetStore {
  getDataset: (options?: { refresh?: boolean }) => Promise<DatasetLoadResult>;
}

export const createDatasetStore = (
  cacheDir: string,
  fuelFinderClient: FuelFinderClient
): DatasetStore => {
  const cachePaths = getCachePaths(cacheDir);
  const hasCompatibleIndexStation = (station: DatasetIndexCacheEntry["data"][number]): boolean =>
    Array.isArray(station.qualityFlags);

  const loadOrRefreshCache = async <TData>(
    path: string,
    ttlMs: number,
    refresh: boolean,
    fetchData: () => Promise<TData>
  ): Promise<CacheEntry<TData>> => {
    const cachedEntry = await readCacheEntry<TData>(path);

    if (!refresh && cachedEntry && isCacheFresh(cachedEntry.cachedAt, ttlMs)) {
      return cachedEntry;
    }

    try {
      const nextEntry: CacheEntry<TData> = {
        cachedAt: new Date().toISOString(),
        data: await fetchData()
      };

      await writeCacheEntry(path, nextEntry);

      return nextEntry;
    } catch (error) {
      if (cachedEntry) {
        return cachedEntry;
      }

      throw error;
    }
  };

  const readIndexEntry = async (): Promise<DatasetIndexCacheEntry | undefined> => readDatasetIndexCacheEntry(cachePaths.index);

  return {
    getDataset: async (options = {}) => {
      const refresh = options.refresh ?? false;
      const stationEntry = await loadOrRefreshCache<RawFuelFinderStation[]>(
        cachePaths.stations,
        STATION_CACHE_TTL_MS,
        refresh,
        () => fuelFinderClient.getAllStations()
      );
      const priceEntry = await loadOrRefreshCache<RawFuelFinderPriceStation[]>(
        cachePaths.prices,
        PRICE_CACHE_TTL_MS,
        refresh,
        () => fuelFinderClient.getAllFuelPrices()
      );
      const indexEntry = await readIndexEntry();

      if (
        indexEntry &&
        indexEntry.data.every((station) => hasCompatibleIndexStation(station)) &&
        indexEntry.stationSourceCachedAt === stationEntry.cachedAt &&
        indexEntry.priceSourceCachedAt === priceEntry.cachedAt
      ) {
        return {
          builtAt: indexEntry.builtAt,
          priceSourceCachedAt: indexEntry.priceSourceCachedAt,
          stationSourceCachedAt: indexEntry.stationSourceCachedAt,
          stations: indexEntry.data
        };
      }

      const nextIndexEntry: DatasetIndexCacheEntry = {
        builtAt: new Date().toISOString(),
        data: buildIndexedStations(stationEntry.data, priceEntry.data),
        priceSourceCachedAt: priceEntry.cachedAt,
        stationSourceCachedAt: stationEntry.cachedAt
      };

      await writeDatasetIndexCacheEntry(cachePaths.index, nextIndexEntry);

      return {
        builtAt: nextIndexEntry.builtAt,
        priceSourceCachedAt: nextIndexEntry.priceSourceCachedAt,
        stationSourceCachedAt: nextIndexEntry.stationSourceCachedAt,
        stations: nextIndexEntry.data
      };
    }
  };
};
