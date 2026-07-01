import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import { readPhoneCliConfig, writePhoneCliConfig } from "../config";

const CACHE_DIR_NAME = "phone_cli";

function getDefaultCacheDir(): string {
  const xdgCacheHome = process.env["XDG_CACHE_HOME"]?.trim();
  if (xdgCacheHome) {
    return join(xdgCacheHome, CACHE_DIR_NAME);
  }
  if (process.platform === "darwin") {
    return join(homedir(), "Library", "Caches", CACHE_DIR_NAME);
  }
  if (process.platform === "win32") {
    const localAppData = process.env["LOCALAPPDATA"]?.trim();
    return localAppData
      ? join(localAppData, CACHE_DIR_NAME)
      : join(homedir(), "AppData", "Local", CACHE_DIR_NAME);
  }
  return join(homedir(), ".cache", CACHE_DIR_NAME);
}

export function getCacheDir(): string {
  const configured = readPhoneCliConfig().cacheDir?.trim();
  return configured || getDefaultCacheDir();
}

export const cachePaths = {
  octoGasPrices: () => join(getCacheDir(), "octo", "gas-prices.json"),
  octoElectricityPrices: () => join(getCacheDir(), "octo", "electricity-prices.json"),
  octoMonthlyAverages: () => join(getCacheDir(), "octo", "monthly-averages.json"),
  solarMonthlyYield: () => join(getCacheDir(), "solar", "monthly-yield.json"),
} as const;

export function readJsonCacheFile<T>(path: string): T | undefined {
  try {
    const raw = readFileSync(path, "utf8");
    return JSON.parse(raw) as T;
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error != null &&
      "code" in error &&
      (error as { code?: unknown }).code === "ENOENT"
    ) {
      return undefined;
    }
    return undefined;
  }
}

export function writeJsonCacheFile<T>(path: string, data: T): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

/** Move legacy monthly averages from config into cache (runs even outside monthly stats window). */
export function ensureOctoMonthlyAveragesMigrated(): void {
  const path = cachePaths.octoMonthlyAverages();
  const legacy = migrateLegacyOctoCacheFromConfig(["monthlyAverageCache"])
    .monthlyAverageCache;
  if (!legacy || typeof legacy !== "object" || Array.isArray(legacy)) {
    return;
  }
  const existing = readJsonCacheFile<Record<string, unknown>>(path);
  if (!existing || Object.keys(existing).length === 0) {
    writeJsonCacheFile(path, legacy);
  }
}

type LegacyOctoCacheKeys = "gas" | "electricity" | "monthlyAverageCache";

/** Move legacy octo cache blobs from ~/.phone_cli.json into cache files. */
export function migrateLegacyOctoCacheFromConfig(
  keys: LegacyOctoCacheKeys[],
): Record<LegacyOctoCacheKeys, unknown> {
  const migrated: Record<LegacyOctoCacheKeys, unknown> = {
    gas: undefined,
    electricity: undefined,
    monthlyAverageCache: undefined,
  };
  const config = readPhoneCliConfig();
  const octo = config.octo;
  if (!octo || typeof octo !== "object" || Array.isArray(octo)) {
    return migrated;
  }

  let changed = false;
  const nextOcto = { ...octo } as Record<string, unknown>;
  for (const key of keys) {
    const value = nextOcto[key];
    if (value === undefined) continue;
    migrated[key] = value;
    delete nextOcto[key];
    changed = true;
  }

  if (changed) {
    config.octo = nextOcto;
    writePhoneCliConfig(config);
  }
  return migrated;
}

/** Move legacy solar cache blobs from ~/.phone_cli.json into cache files. */
export function migrateLegacySolarCacheFromConfig(): Record<string, unknown> | undefined {
  const config = readPhoneCliConfig();
  const solar = config.solar;
  if (!solar || typeof solar !== "object" || Array.isArray(solar)) {
    return undefined;
  }

  const nextSolar = { ...solar } as Record<string, unknown>;
  const monthlyYieldCache = nextSolar.monthlyYieldCache;
  if (monthlyYieldCache === undefined) {
    return undefined;
  }

  delete nextSolar.monthlyYieldCache;
  config.solar = nextSolar;
  writePhoneCliConfig(config);
  return { monthlyYieldCache };
}

export function cacheFileExists(path: string): boolean {
  return existsSync(path);
}
