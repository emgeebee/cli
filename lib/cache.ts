import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import { readPhoneCliConfig, writePhoneCliConfig } from "../config";
import { getDocument, readOptionalDocsToken, saveDocument } from "./docsApi";

const CACHE_DIR_NAME = "phone_cli";
const FLUSH_DEBOUNCE_MS = 500;

export const SERVICE_DOC_IDS = {
  octo: "phone-cli-octo",
  solar: "phone-cli-solar",
} as const;

export type ServiceName = keyof typeof SERVICE_DOC_IDS;

export type OctoServiceCache = {
  gasPrices?: Record<string, unknown>;
  electricityPrices?: Record<string, unknown>;
  monthlyAverages?: Record<string, unknown>;
  dailyTotals?: Record<string, unknown>;
};

export type SolarServiceCache = {
  monthlyYield?: Record<string, unknown>;
};

type ServiceCacheMap = {
  octo: OctoServiceCache;
  solar: SolarServiceCache;
};

const SERVICE_TITLES: Record<ServiceName, string> = {
  octo: "phone-cli octo cache",
  solar: "phone-cli solar cache",
};

const memory: { [K in ServiceName]?: ServiceCacheMap[K] } = {};
const loaded = new Set<ServiceName>();
const dirty = new Set<ServiceName>();
const flushTimers: Partial<Record<ServiceName, ReturnType<typeof setTimeout>>> = {};

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

/** Legacy local paths — used only for one-time migration into remote docs. */
export const cachePaths = {
  octoGasPrices: () => join(getCacheDir(), "octo", "gas-prices.json"),
  octoElectricityPrices: () => join(getCacheDir(), "octo", "electricity-prices.json"),
  octoMonthlyAverages: () => join(getCacheDir(), "octo", "monthly-averages.json"),
  octoDailyTotals: () => join(getCacheDir(), "octo", "daily-totals.json"),
  solarMonthlyYield: () => join(getCacheDir(), "solar", "monthly-yield.json"),
} as const;

function readLocalJsonFile<T>(path: string): T | undefined {
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

function writeLocalJsonFile<T>(path: string, data: T): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function emptyServiceData<S extends ServiceName>(service: S): ServiceCacheMap[S] {
  return {} as ServiceCacheMap[S];
}

function hasOctoLocalData(data: OctoServiceCache): boolean {
  return Boolean(
    (data.gasPrices && Object.keys(data.gasPrices).length > 0) ||
      (data.electricityPrices && Object.keys(data.electricityPrices).length > 0) ||
      (data.monthlyAverages && Object.keys(data.monthlyAverages).length > 0) ||
      (data.dailyTotals && Object.keys(data.dailyTotals).length > 0),
  );
}

function hasSolarLocalData(data: SolarServiceCache): boolean {
  return Boolean(data.monthlyYield && Object.keys(data.monthlyYield).length > 0);
}

function loadOctoFromLocalFiles(): OctoServiceCache {
  ensureOctoMonthlyAveragesMigrated();
  const legacy = migrateLegacyOctoCacheFromConfig(["gas", "electricity", "monthlyAverageCache"]);
  return {
    gasPrices:
      readLocalJsonFile<Record<string, unknown>>(cachePaths.octoGasPrices()) ??
      (legacy.gas && typeof legacy.gas === "object" && !Array.isArray(legacy.gas)
        ? (legacy.gas as Record<string, unknown>)
        : undefined),
    electricityPrices:
      readLocalJsonFile<Record<string, unknown>>(cachePaths.octoElectricityPrices()) ??
      (legacy.electricity &&
      typeof legacy.electricity === "object" &&
      !Array.isArray(legacy.electricity)
        ? (legacy.electricity as Record<string, unknown>)
        : undefined),
    monthlyAverages:
      readLocalJsonFile<Record<string, unknown>>(cachePaths.octoMonthlyAverages()) ??
      (legacy.monthlyAverageCache &&
      typeof legacy.monthlyAverageCache === "object" &&
      !Array.isArray(legacy.monthlyAverageCache)
        ? (legacy.monthlyAverageCache as Record<string, unknown>)
        : undefined),
    dailyTotals: readLocalJsonFile<Record<string, unknown>>(cachePaths.octoDailyTotals()),
  };
}

function loadSolarFromLocalFiles(): SolarServiceCache {
  const legacy = migrateLegacySolarCacheFromConfig()?.monthlyYieldCache;
  return {
    monthlyYield:
      readLocalJsonFile<Record<string, unknown>>(cachePaths.solarMonthlyYield()) ??
      (legacy && typeof legacy === "object" && !Array.isArray(legacy)
        ? (legacy as Record<string, unknown>)
        : undefined),
  };
}

function loadServiceFromLocalFiles<S extends ServiceName>(service: S): ServiceCacheMap[S] {
  if (service === "octo") {
    return loadOctoFromLocalFiles() as ServiceCacheMap[S];
  }
  return loadSolarFromLocalFiles() as ServiceCacheMap[S];
}

function serviceHasData<S extends ServiceName>(service: S, data: ServiceCacheMap[S]): boolean {
  if (service === "octo") {
    return hasOctoLocalData(data as OctoServiceCache);
  }
  return hasSolarLocalData(data as SolarServiceCache);
}

function mergeRecordFields(
  local?: Record<string, unknown>,
  remote?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const l = local && typeof local === "object" && !Array.isArray(local) ? local : {};
  const r = remote && typeof remote === "object" && !Array.isArray(remote) ? remote : {};
  const merged = { ...l, ...r };
  return Object.keys(merged).length > 0 ? merged : undefined;
}

function mergeOctoServiceCache(
  remote: OctoServiceCache | null | undefined,
  local: OctoServiceCache,
): OctoServiceCache {
  const r = remote ?? {};
  return {
    gasPrices: mergeRecordFields(
      local.gasPrices as Record<string, unknown> | undefined,
      r.gasPrices as Record<string, unknown> | undefined,
    ),
    electricityPrices: mergeRecordFields(
      local.electricityPrices as Record<string, unknown> | undefined,
      r.electricityPrices as Record<string, unknown> | undefined,
    ),
    monthlyAverages: mergeRecordFields(
      local.monthlyAverages as Record<string, unknown> | undefined,
      r.monthlyAverages as Record<string, unknown> | undefined,
    ),
    dailyTotals: mergeRecordFields(
      local.dailyTotals as Record<string, unknown> | undefined,
      r.dailyTotals as Record<string, unknown> | undefined,
    ),
  };
}

function mergeSolarServiceCache(
  remote: SolarServiceCache | null | undefined,
  local: SolarServiceCache,
): SolarServiceCache {
  const r = remote ?? {};
  return {
    monthlyYield: mergeRecordFields(
      local.monthlyYield as Record<string, unknown> | undefined,
      r.monthlyYield as Record<string, unknown> | undefined,
    ),
  };
}

function mergeServiceCacheData<S extends ServiceName>(
  service: S,
  remote: ServiceCacheMap[S] | null | undefined,
  local: ServiceCacheMap[S],
): ServiceCacheMap[S] {
  if (service === "octo") {
    return mergeOctoServiceCache(
      remote as OctoServiceCache | null | undefined,
      local as OctoServiceCache,
    ) as ServiceCacheMap[S];
  }
  return mergeSolarServiceCache(
    remote as SolarServiceCache | null | undefined,
    local as SolarServiceCache,
  ) as ServiceCacheMap[S];
}

async function loadServiceCache<S extends ServiceName>(service: S): Promise<void> {
  if (loaded.has(service)) return;
  loaded.add(service);

  const local = loadServiceFromLocalFiles(service);
  const token = await readOptionalDocsToken();

  let remote: ServiceCacheMap[S] | null = null;
  if (token) {
    try {
      remote = await getDocument<ServiceCacheMap[S]>(SERVICE_DOC_IDS[service], token);
    } catch {
      // Fall through to local merge.
    }
  }

  const merged = mergeServiceCacheData(service, remote, local);
  memory[service] = merged;

  if (token && serviceHasData(service, merged)) {
    const baseline = remote ?? emptyServiceData(service);
    if (JSON.stringify(merged) !== JSON.stringify(baseline)) {
      try {
        await saveDocument(SERVICE_DOC_IDS[service], SERVICE_TITLES[service], merged, token);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Cache migration upload failed (${service}): ${message}`);
      }
    }
  }
}

export async function ensureServiceCacheLoaded(service: ServiceName): Promise<void> {
  await loadServiceCache(service);
}

export async function ensureOctoCacheLoaded(): Promise<void> {
  await ensureServiceCacheLoaded("octo");
}

export async function ensureSolarCacheLoaded(): Promise<void> {
  await ensureServiceCacheLoaded("solar");
}

export function readServiceCache<S extends ServiceName>(service: S): ServiceCacheMap[S] {
  return (memory[service] ?? emptyServiceData(service)) as ServiceCacheMap[S];
}

export function updateServiceCache<S extends ServiceName>(
  service: S,
  patch: Partial<ServiceCacheMap[S]>,
): void {
  const current = readServiceCache(service);
  memory[service] = { ...current, ...patch } as ServiceCacheMap[S];
  dirty.add(service);
  scheduleServiceFlush(service);
}

function scheduleServiceFlush(service: ServiceName): void {
  const existing = flushTimers[service];
  if (existing) clearTimeout(existing);
  flushTimers[service] = setTimeout(() => {
    flushTimers[service] = undefined;
    void flushServiceCache(service).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Cache save failed (${service}): ${message}`);
    });
  }, FLUSH_DEBOUNCE_MS);
}

function cancelServiceFlushTimer(service: ServiceName): void {
  const existing = flushTimers[service];
  if (!existing) return;
  clearTimeout(existing);
  flushTimers[service] = undefined;
}

export async function flushServiceCache(service: ServiceName): Promise<void> {
  cancelServiceFlushTimer(service);
  if (!dirty.has(service)) return;
  const token = await readOptionalDocsToken();
  if (!token) {
    console.error(`Cache save skipped (${service}): missing config.cal.token`);
    return;
  }
  const data = readServiceCache(service);
  await saveDocument(SERVICE_DOC_IDS[service], SERVICE_TITLES[service], data, token);
  mirrorServiceCacheToLocalFiles(service, data);
  dirty.delete(service);
}

function mirrorServiceCacheToLocalFiles<S extends ServiceName>(
  service: S,
  data: ServiceCacheMap[S],
): void {
  if (service === "solar") {
    const solar = data as SolarServiceCache;
    if (solar.monthlyYield && Object.keys(solar.monthlyYield).length > 0) {
      writeLocalJsonFile(cachePaths.solarMonthlyYield(), solar.monthlyYield);
    }
    return;
  }

  const octo = data as OctoServiceCache;
  if (octo.gasPrices && Object.keys(octo.gasPrices).length > 0) {
    writeLocalJsonFile(cachePaths.octoGasPrices(), octo.gasPrices);
  }
  if (octo.electricityPrices && Object.keys(octo.electricityPrices).length > 0) {
    writeLocalJsonFile(cachePaths.octoElectricityPrices(), octo.electricityPrices);
  }
  if (octo.monthlyAverages && Object.keys(octo.monthlyAverages).length > 0) {
    writeLocalJsonFile(cachePaths.octoMonthlyAverages(), octo.monthlyAverages);
  }
  if (octo.dailyTotals && Object.keys(octo.dailyTotals).length > 0) {
    writeLocalJsonFile(cachePaths.octoDailyTotals(), octo.dailyTotals);
  }
}

export async function flushAllServiceCaches(): Promise<void> {
  for (const service of Object.keys(SERVICE_DOC_IDS) as ServiceName[]) {
    cancelServiceFlushTimer(service);
  }
  await Promise.all((Object.keys(SERVICE_DOC_IDS) as ServiceName[]).map((service) => flushServiceCache(service)));
}

/** @deprecated Use remote service cache via readServiceCache/updateServiceCache. */
export function readJsonCacheFile<T>(path: string): T | undefined {
  return readLocalJsonFile<T>(path);
}

/** @deprecated Use remote service cache via updateServiceCache. */
export function writeJsonCacheFile<T>(path: string, data: T): void {
  writeLocalJsonFile(path, data);
}

/** Move legacy monthly averages from config into local cache files (migration helper). */
export function ensureOctoMonthlyAveragesMigrated(): void {
  const path = cachePaths.octoMonthlyAverages();
  const legacy = migrateLegacyOctoCacheFromConfig(["monthlyAverageCache"])
    .monthlyAverageCache;
  if (!legacy || typeof legacy !== "object" || Array.isArray(legacy)) {
    return;
  }
  const existing = readLocalJsonFile<Record<string, unknown>>(path);
  if (!existing || Object.keys(existing).length === 0) {
    writeLocalJsonFile(path, legacy);
  }
}

type LegacyOctoCacheKeys = "gas" | "electricity" | "monthlyAverageCache";

/** Move legacy octo cache blobs from ~/.phone_cli.json into local cache files. */
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

/** Move legacy solar cache blobs from ~/.phone_cli.json into local cache files. */
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
