import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { CACHE_FILE_NAMES } from "./constants";

import type { CacheEntry, DatasetIndexCacheEntry } from "./types";

export type CachePaths = {
  index: string;
  prices: string;
  stations: string;
};

export const getCachePaths = (cacheDir: string): CachePaths => ({
  index: `${cacheDir}/${CACHE_FILE_NAMES.index}`,
  prices: `${cacheDir}/${CACHE_FILE_NAMES.prices}`,
  stations: `${cacheDir}/${CACHE_FILE_NAMES.stations}`
});

export const readCacheEntry = async <TData>(path: string): Promise<CacheEntry<TData> | undefined> => {
  try {
    const fileContents = await readFile(path, "utf8");
    return JSON.parse(fileContents) as CacheEntry<TData>;
  } catch (error) {
    if (isMissingFileError(error)) {
      return undefined;
    }

    return undefined;
  }
};

export const readDatasetIndexCacheEntry = async (path: string): Promise<DatasetIndexCacheEntry | undefined> => {
  try {
    const fileContents = await readFile(path, "utf8");
    return JSON.parse(fileContents) as DatasetIndexCacheEntry;
  } catch (error) {
    if (isMissingFileError(error)) {
      return undefined;
    }

    return undefined;
  }
};

export const writeCacheEntry = async <TData>(path: string, entry: CacheEntry<TData>): Promise<void> => {
  await mkdir(dirname(path), {
    recursive: true
  });
  await writeFile(path, JSON.stringify(entry, null, 2));
};

export const writeDatasetIndexCacheEntry = async (
  path: string,
  entry: DatasetIndexCacheEntry
): Promise<void> => {
  await mkdir(dirname(path), {
    recursive: true
  });
  await writeFile(path, JSON.stringify(entry, null, 2));
};

export const isCacheFresh = (cachedAt: string, ttlMs: number, now = new Date()): boolean => {
  const cachedDate = new Date(cachedAt);

  if (Number.isNaN(cachedDate.valueOf())) {
    return false;
  }

  return now.valueOf() - cachedDate.valueOf() <= ttlMs;
};

const isMissingFileError = (error: unknown): boolean =>
  error instanceof Error && "code" in error && error["code"] === "ENOENT";
