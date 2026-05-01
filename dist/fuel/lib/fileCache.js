"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isCacheFresh = exports.writeDatasetIndexCacheEntry = exports.writeCacheEntry = exports.readDatasetIndexCacheEntry = exports.readCacheEntry = exports.getCachePaths = void 0;
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const constants_1 = require("./constants");
const getCachePaths = (cacheDir) => ({
    index: `${cacheDir}/${constants_1.CACHE_FILE_NAMES.index}`,
    prices: `${cacheDir}/${constants_1.CACHE_FILE_NAMES.prices}`,
    stations: `${cacheDir}/${constants_1.CACHE_FILE_NAMES.stations}`
});
exports.getCachePaths = getCachePaths;
const readCacheEntry = async (path) => {
    try {
        const fileContents = await (0, promises_1.readFile)(path, "utf8");
        return JSON.parse(fileContents);
    }
    catch (error) {
        if (isMissingFileError(error)) {
            return undefined;
        }
        return undefined;
    }
};
exports.readCacheEntry = readCacheEntry;
const readDatasetIndexCacheEntry = async (path) => {
    try {
        const fileContents = await (0, promises_1.readFile)(path, "utf8");
        return JSON.parse(fileContents);
    }
    catch (error) {
        if (isMissingFileError(error)) {
            return undefined;
        }
        return undefined;
    }
};
exports.readDatasetIndexCacheEntry = readDatasetIndexCacheEntry;
const writeCacheEntry = async (path, entry) => {
    await (0, promises_1.mkdir)((0, node_path_1.dirname)(path), {
        recursive: true
    });
    await (0, promises_1.writeFile)(path, JSON.stringify(entry, null, 2));
};
exports.writeCacheEntry = writeCacheEntry;
const writeDatasetIndexCacheEntry = async (path, entry) => {
    await (0, promises_1.mkdir)((0, node_path_1.dirname)(path), {
        recursive: true
    });
    await (0, promises_1.writeFile)(path, JSON.stringify(entry, null, 2));
};
exports.writeDatasetIndexCacheEntry = writeDatasetIndexCacheEntry;
const isCacheFresh = (cachedAt, ttlMs, now = new Date()) => {
    const cachedDate = new Date(cachedAt);
    if (Number.isNaN(cachedDate.valueOf())) {
        return false;
    }
    return now.valueOf() - cachedDate.valueOf() <= ttlMs;
};
exports.isCacheFresh = isCacheFresh;
const isMissingFileError = (error) => error instanceof Error && "code" in error && error["code"] === "ENOENT";
