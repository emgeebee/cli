import { writeFileSync } from "node:fs";
import { getConfigPath, readPhoneCliConfig } from "../config";

/** `octo.gas` in ~/.phone_cli.json — YYYY-MM-DD to inc-VAT pence rate(s). */
export type GasPriceCache = Record<string, number[]>;

/** `octo.electricity` in ~/.phone_cli.json — YYYY-MM-DD to half-hourly rate slots. */
export type CachedElectricityRate = {
  valid_from: string;
  valid_to: string;
  value_inc_vat: number;
};

export type ElectricityPriceCache = Record<string, CachedElectricityRate[]>;

export const ELECTRICITY_PERIOD_LABELS = ["< 6", "6-9", "9-4", "4-7", "> 7"] as const;

const ELECTRICITY_PERIODS: Array<{ label: (typeof ELECTRICITY_PERIOD_LABELS)[number]; minHour: number; maxHour: number }> = [
  { label: "< 6", minHour: 0, maxHour: 6 },
  { label: "6-9", minHour: 6, maxHour: 9 },
  { label: "9-4", minHour: 9, maxHour: 16 },
  { label: "4-7", minHour: 16, maxHour: 19 },
  { label: "> 7", minHour: 19, maxHour: 24 },
];

export type OctopusAgreement = {
  tariff_code?: string;
  valid_from?: string;
  valid_to?: string | null;
};

export type OctopusMeterPoint = {
  mpan?: string;
  mprn?: string;
  meters?: Array<{
    serial_number?: string;
    active_from?: string;
  }>;
  agreements?: OctopusAgreement[];
};

export type OctopusProperty = {
  electricity_meter_points?: OctopusMeterPoint[];
  gas_meter_points?: OctopusMeterPoint[];
};

export type OctopusAccountResponse = {
  properties?: OctopusProperty[];
};

export type OctopusRate = {
  valid_from?: string;
  valid_to?: string;
  value_inc_vat?: number;
  value_exc_vat?: number;
};

export type TariffDerivation = {
  electricityMeters: Array<{ mpan: string; serial: string }>;
  gasMeters: Array<{ mprn: string; serial: string }>;
  etariff: OctopusAgreement;
  gtariff: OctopusAgreement;
  etariffPrices: string;
  gtariffPrices: string;
  etariffStanding: string;
  gtariffStanding: string;
};

export const OCTOPUS_BASE_URL = "https://api.octopus.energy/v1";
export const DAY_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX_AGE_DAYS = 2;
const UK_TZ = "Europe/London";
const ANSI_RESET = "\x1b[0m";
const ANSI_GREEN = "\x1b[32m";
const ANSI_YELLOW = "\x1b[33m";
const ANSI_ORANGE = "\x1b[38;5;208m";
const ANSI_RED = "\x1b[31m";

export type FuelType = "electricity" | "gas";

export function resolveOctoCredentials(): {
  token: string;
  accountNumber: string;
  gasKwhPerUnit: number;
} {
  const parseGasFactor = (value: string | undefined): number | null => {
    if (!value) return null;
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) {
      throw new Error("OCTOPUS_GAS_KWH_PER_UNIT must be a positive number.");
    }
    return n;
  };

  const config = readPhoneCliConfig();
  const octo = config.octo || {};
  const token = String(octo.basicAuthToken || octo.token || "").trim();
  const accountNumber = String(octo.accountNumber || "").trim();
  const envGasFactor = String(
    octo.gasKwhPerUnit || octo.gas_kwh_per_unit || "",
  ).trim();
  const configuredGasFactor = parseGasFactor(
    String(octo.gasKwhPerUnit || octo.gas_kwh_per_unit || "").trim() ||
      undefined,
  );
  if (!token || !accountNumber) {
    throw new Error(
      [
        "Missing Octopus credentials.",
        `Configure ${getConfigPath()} with:`,
        `{ "octo": { "basicAuthToken": "...", "accountNumber": "A-..." } }`,
      ].join(" "),
    );
  }
  return {
    token,
    accountNumber,
    gasKwhPerUnit: parseGasFactor(envGasFactor) ?? configuredGasFactor ?? 11.2,
  };
}

function latestAgreement(
  agreements: OctopusAgreement[] | undefined,
): OctopusAgreement {
  if (!agreements || agreements.length === 0) {
    throw new Error("No agreement found on meter point.");
  }
  const sorted = [...agreements].sort((a, b) => {
    const aTs = new Date(a.valid_from || "").getTime();
    const bTs = new Date(b.valid_from || "").getTime();
    return aTs - bTs;
  });
  return sorted[sorted.length - 1];
}

function productFromTariffCode(tariffCode: string): string {
  const parts = tariffCode.split("-").slice(0, -1).slice(2);
  if (parts.length === 0) {
    throw new Error(
      `Unable to derive product code from tariff code: ${tariffCode}`,
    );
  }
  return parts.join("-");
}

export function deriveTariffs(account: OctopusAccountResponse): TariffDerivation {
  const property = account.properties?.[0];
  if (!property) {
    throw new Error("No property found on account.");
  }

  const ePoints = property.electricity_meter_points || [];
  const gPoints = property.gas_meter_points || [];
  const emPoint = ePoints[0];
  const gmPoint = gPoints[0];
  if (!emPoint || !gmPoint) {
    throw new Error("Electricity and gas meter points are required.");
  }
  const meterRefs = (
    points: OctopusMeterPoint[] | undefined,
    key: "mpan" | "mprn",
  ): Array<{ mpxn: string; serial: string }> => {
    const refs: Array<{ mpxn: string; serial: string }> = [];
    for (const point of points || []) {
      const mpxn = String(point[key] || "").trim();
      if (!mpxn) continue;
      for (const meter of point.meters || []) {
        const serial = String(meter.serial_number || "").trim();
        if (!serial) continue;
        refs.push({ mpxn, serial });
      }
    }
    const seen = new Set<string>();
    return refs.filter((ref) => {
      const id = `${ref.mpxn}::${ref.serial}`;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  };

  const electricityMeters = meterRefs(ePoints, "mpan").map((m) => ({
    mpan: m.mpxn,
    serial: m.serial,
  }));
  const gasMeters = meterRefs(gPoints, "mprn").map((m) => ({
    mprn: m.mpxn,
    serial: m.serial,
  }));
  if (electricityMeters.length === 0 || gasMeters.length === 0) {
    throw new Error("Missing electricity or gas meter serials on account.");
  }

  const etariff = latestAgreement(emPoint.agreements);
  const gtariff = latestAgreement(gmPoint.agreements);
  if (!etariff.tariff_code || !gtariff.tariff_code) {
    throw new Error("Missing tariff_code on one or more agreements.");
  }

  const eProduct = productFromTariffCode(etariff.tariff_code);
  const gProduct = productFromTariffCode(gtariff.tariff_code);

  return {
    electricityMeters,
    gasMeters,
    etariff,
    gtariff,
    etariffPrices: `${OCTOPUS_BASE_URL}/products/${eProduct}/electricity-tariffs/${etariff.tariff_code}/standard-unit-rates/`,
    gtariffPrices: `${OCTOPUS_BASE_URL}/products/${gProduct}/gas-tariffs/${gtariff.tariff_code}/standard-unit-rates/`,
    etariffStanding: `${OCTOPUS_BASE_URL}/products/${eProduct}/electricity-tariffs/${etariff.tariff_code}/standing-charges/`,
    gtariffStanding: `${OCTOPUS_BASE_URL}/products/${gProduct}/gas-tariffs/${gtariff.tariff_code}/standing-charges/`,
  };
}

export async function fetchOctopusJson<T>(url: string, token: string): Promise<T> {
  const raw = token.trim();

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${Buffer.from(`${raw}`).toString("base64")}`,
    },
  });
  if (response.ok) {
    return (await response.json()) as T;
  }
  if (response.status !== 401) {
    throw new Error(
      `Octopus API request failed (${response.status}) for ${url}`,
    );
  }

  throw new Error(`Octopus API request failed (${response.status}) for ${url}`);
}

type PagedResults<T> = {
  next?: string | null;
  results?: T[];
};

export async function fetchAllOctopusResults<T>(
  url: string,
  token: string,
): Promise<T[]> {
  const all: T[] = [];
  let nextUrl: string | null = url;
  let pageGuard = 0;

  while (nextUrl) {
    pageGuard += 1;
    if (pageGuard > 500) {
      throw new Error("Too many Octopus API pages while fetching results.");
    }
    const page = await fetchOctopusJson<PagedResults<T>>(nextUrl, token);
    all.push(...(page.results || []));
    nextUrl = page.next || null;
  }

  return all;
}

export function toIsoNoMs(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function ratesUrlWithWindow(baseUrl: string, from: Date, to: Date): string {
  const url = new URL(baseUrl);
  url.searchParams.set("period_from", toIsoNoMs(from));
  url.searchParams.set("period_to", toIsoNoMs(to));
  return url.toString();
}

function shouldUseColor(): boolean {
  return Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
}

function colorize(text: string, color: string): string {
  if (!shouldUseColor()) return text;
  return `${color}${text}${ANSI_RESET}`;
}

function formatWindow(rate: OctopusRate): string {
  const from = rate.valid_from ? new Date(rate.valid_from) : null;
  const to = rate.valid_to ? new Date(rate.valid_to) : null;
  if (
    !from ||
    Number.isNaN(from.getTime()) ||
    !to ||
    Number.isNaN(to.getTime())
  ) {
    return "unknown";
  }
  const dayLabel = from.toLocaleDateString("en-GB", {
    weekday: "short",
    timeZone: UK_TZ,
  });
  const day = from.toLocaleDateString("en-GB", {
    day: "numeric",
    timeZone: UK_TZ,
  });
  const month = from.toLocaleDateString("en-GB", {
    month: "numeric",
    timeZone: UK_TZ,
  });
  const startTime = from.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: UK_TZ,
  });
  const endTime = to.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: UK_TZ,
  });
  const capDay =
    dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1).toLowerCase();
  return `${capDay} ${day}/${month} ${startTime} -> ${endTime}`;
}

export function colorForRate(rateIncVat: number, fuel: FuelType): string {
  if (fuel === "electricity") {
    if (rateIncVat <= 5) return ANSI_GREEN;
    if (rateIncVat <= 12) return ANSI_YELLOW;
    if (rateIncVat < 20) return ANSI_ORANGE;
    return ANSI_RED;
  }

  if (rateIncVat < 4) return ANSI_GREEN;
  if (rateIncVat <= 5) return ANSI_YELLOW;
  if (rateIncVat < 6) return ANSI_ORANGE;
  return ANSI_RED;
}

export function formatRateLine(rate: OctopusRate, fuel: FuelType): string {
  const inc =
    rate.value_inc_vat == null ? "?" : `${rate.value_inc_vat.toFixed(4)}p`;
  if (rate.value_inc_vat == null) {
    return inc;
  }
  const colored = colorize(inc, colorForRate(rate.value_inc_vat, fuel));
  if (!rate.valid_from) {
    return colored;
  }
  const window = formatWindow(rate);
  if (window === "unknown") {
    return colored;
  }
  return `${window} | ${colored}`;
}

export function dayKeyUK(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: UK_TZ });
}

export function ukTomorrowYmd(now: Date = new Date()): string {
  const [year, month, day] = dayKeyUK(now).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + 1));
  return date.toISOString().slice(0, 10);
}

export function gasRatesForDay(rates: OctopusRate[], dayYmd: string): OctopusRate[] {
  return rates
    .filter((rate) => rate.valid_from && dayKeyUK(new Date(rate.valid_from)) === dayYmd)
    .sort((a, b) => new Date(a.valid_from || "").getTime() - new Date(b.valid_from || "").getTime());
}

function cacheEntryAgeDays(dayYmd: string, now: Date): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayYmd)) return null;
  const [tY, tM, tD] = dayKeyUK(now).split("-").map(Number);
  const [y, m, d] = dayYmd.split("-").map(Number);
  const todayUtc = Date.UTC(tY, tM - 1, tD);
  const entryUtc = Date.UTC(y, m - 1, d);
  if (Number.isNaN(entryUtc)) return null;
  return Math.floor((todayUtc - entryUtc) / DAY_MS);
}

function pruneStaleDateKeyedCache<T extends Record<string, unknown>>(
  cache: T,
  now: Date = new Date(),
): { cache: T; pruned: boolean } {
  let pruned = false;
  const next = { ...cache };
  for (const dayKey of Object.keys(next)) {
    const ageDays = cacheEntryAgeDays(dayKey, now);
    if (ageDays != null && ageDays > CACHE_MAX_AGE_DAYS) {
      delete next[dayKey];
      pruned = true;
    }
  }
  return { cache: next, pruned };
}

function normalizeCachedDayPrices(value: unknown): number[] | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return [value];
  }
  if (!Array.isArray(value)) return null;
  const prices = value.filter((entry): entry is number => typeof entry === "number" && Number.isFinite(entry));
  return prices.length > 0 ? prices : null;
}

export function readGasPriceCache(now: Date = new Date()): GasPriceCache {
  const config = readPhoneCliConfig();
  const octo = config.octo || {};
  const raw = octo.gas;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const cache: GasPriceCache = {};
  for (const [dayKey, value] of Object.entries(raw)) {
    const prices = normalizeCachedDayPrices(value);
    if (prices) {
      cache[dayKey] = prices;
    }
  }
  const { cache: pruned, pruned: didPrune } = pruneStaleDateKeyedCache(cache, now);
  if (didPrune) {
    saveGasPriceCache(pruned);
  }
  return pruned;
}

function writeOctoConfigSection(section: string, value: unknown): void {
  const configPath = getConfigPath();
  const config = readPhoneCliConfig() as Record<string, unknown>;
  const octo = ((config.octo || {}) as Record<string, unknown>);
  octo[section] = value;
  config.octo = octo;
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

export function saveGasPriceCache(cache: GasPriceCache): void {
  writeOctoConfigSection("gas", cache);
}

function hasCachedDay(cache: GasPriceCache, dayYmd: string): boolean {
  const prices = cache[dayYmd];
  return Array.isArray(prices) && prices.length > 0;
}

function pricesFromDayRates(rates: OctopusRate[], dayYmd: string): number[] {
  return gasRatesForDay(rates, dayYmd)
    .map((rate) => rate.value_inc_vat)
    .filter((value): value is number => value != null && Number.isFinite(value));
}

function syntheticRatesFromPrices(prices: number[]): OctopusRate[] {
  return prices.map((value) => ({ value_inc_vat: value }));
}

async function ensureGasPricesCached(dayKeys: string[], now: Date): Promise<GasPriceCache> {
  const cache = readGasPriceCache(now);
  const missing = dayKeys.filter((dayKey) => !hasCachedDay(cache, dayKey));
  if (missing.length === 0) {
    return cache;
  }

  const from = new Date(now);
  const to = new Date(from.getTime() + 2 * DAY_MS);
  const fetched = await fetchGasRates(from, to);
  let updated = false;
  for (const dayKey of missing) {
    const prices = pricesFromDayRates(fetched, dayKey);
    if (prices.length > 0) {
      cache[dayKey] = prices;
      updated = true;
    }
  }
  if (updated) {
    saveGasPriceCache(cache);
  }
  return cache;
}

export async function loadGasRatesForDays(
  dayKeys: string[],
  now: Date = new Date(),
): Promise<OctopusRate[]> {
  const cache = await ensureGasPricesCached(dayKeys, now);
  const rates: OctopusRate[] = [];
  for (const dayKey of dayKeys) {
    const prices = cache[dayKey];
    if (prices?.length) {
      rates.push(...syntheticRatesFromPrices(prices));
    }
  }
  return rates;
}

export async function fetchGasRates(from: Date, to: Date): Promise<OctopusRate[]> {
  const { token, accountNumber } = resolveOctoCredentials();
  const accountUrl = `${OCTOPUS_BASE_URL}/accounts/${accountNumber}/`;
  const account = await fetchOctopusJson<OctopusAccountResponse>(accountUrl, token);
  const derived = deriveTariffs(account);
  const url = ratesUrlWithWindow(derived.gtariffPrices, from, to);
  return fetchAllOctopusResults<OctopusRate>(url, token);
}

export async function loadTodayTomorrowGasRates(now: Date = new Date()): Promise<{
  today: OctopusRate[];
  tomorrow: OctopusRate[];
}> {
  const todayYmd = dayKeyUK(now);
  const tomorrowYmd = ukTomorrowYmd(now);
  const cache = await ensureGasPricesCached([todayYmd, tomorrowYmd], now);
  return {
    today: syntheticRatesFromPrices(cache[todayYmd] ?? []),
    tomorrow: syntheticRatesFromPrices(cache[tomorrowYmd] ?? []),
  };
}

function formatGasPrice(rate: OctopusRate): string {
  const inc = rate.value_inc_vat;
  if (inc == null) return "?";
  const text = `${inc.toFixed(4)}p`;
  return colorize(text, colorForRate(inc, "gas"));
}

export function formatDayGasLine(label: string, rates: OctopusRate[]): string {
  if (rates.length === 0) return `${label} gas: -`;
  return `${label} gas: ${rates.map(formatGasPrice).join(", ")}`;
}

function normalizeCachedElectricityDay(value: unknown): CachedElectricityRate[] | null {
  if (!Array.isArray(value)) return null;
  const rates: CachedElectricityRate[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const validFrom = String(record.valid_from || "").trim();
    const validTo = String(record.valid_to || "").trim();
    const price = record.value_inc_vat;
    if (!validFrom || !validTo || typeof price !== "number" || !Number.isFinite(price)) {
      continue;
    }
    rates.push({
      valid_from: validFrom,
      valid_to: validTo,
      value_inc_vat: price,
    });
  }
  return rates.length > 0 ? rates : null;
}

export function readElectricityPriceCache(now: Date = new Date()): ElectricityPriceCache {
  const config = readPhoneCliConfig();
  const octo = config.octo || {};
  const raw = octo.electricity;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const cache: ElectricityPriceCache = {};
  for (const [dayKey, value] of Object.entries(raw)) {
    const rates = normalizeCachedElectricityDay(value);
    if (rates) {
      cache[dayKey] = rates;
    }
  }
  const { cache: pruned, pruned: didPrune } = pruneStaleDateKeyedCache(cache, now);
  if (didPrune) {
    saveElectricityPriceCache(pruned);
  }
  return pruned;
}

export function saveElectricityPriceCache(cache: ElectricityPriceCache): void {
  writeOctoConfigSection("electricity", cache);
}

function hasCachedElectricityDay(cache: ElectricityPriceCache, dayYmd: string): boolean {
  const rates = cache[dayYmd];
  return Array.isArray(rates) && rates.length > 0;
}

function electricityRatesToCache(rates: OctopusRate[]): CachedElectricityRate[] {
  return rates
    .filter((rate) => rate.valid_from && rate.valid_to && rate.value_inc_vat != null)
    .map((rate) => ({
      valid_from: rate.valid_from!,
      valid_to: rate.valid_to!,
      value_inc_vat: rate.value_inc_vat!,
    }));
}

function cachedElectricityToRates(cached: CachedElectricityRate[]): OctopusRate[] {
  return cached.map((rate) => ({
    valid_from: rate.valid_from,
    valid_to: rate.valid_to,
    value_inc_vat: rate.value_inc_vat,
  }));
}

export async function fetchElectricityRates(from: Date, to: Date): Promise<OctopusRate[]> {
  const { token, accountNumber } = resolveOctoCredentials();
  const accountUrl = `${OCTOPUS_BASE_URL}/accounts/${accountNumber}/`;
  const account = await fetchOctopusJson<OctopusAccountResponse>(accountUrl, token);
  const derived = deriveTariffs(account);
  const url = ratesUrlWithWindow(derived.etariffPrices, from, to);
  return fetchAllOctopusResults<OctopusRate>(url, token);
}

async function ensureElectricityPricesCached(dayKeys: string[], now: Date): Promise<ElectricityPriceCache> {
  const cache = readElectricityPriceCache(now);
  const missing = dayKeys.filter((dayKey) => !hasCachedElectricityDay(cache, dayKey));
  if (missing.length === 0) {
    return cache;
  }

  const from = new Date(now);
  const to = new Date(from.getTime() + 2 * DAY_MS);
  const fetched = await fetchElectricityRates(from, to);
  let updated = false;
  for (const dayKey of missing) {
    const cached = electricityRatesToCache(gasRatesForDay(fetched, dayKey));
    if (cached.length > 0) {
      cache[dayKey] = cached;
      updated = true;
    }
  }
  if (updated) {
    saveElectricityPriceCache(cache);
  }
  return cache;
}

export async function loadElectricityRatesForDays(
  dayKeys: string[],
  now: Date = new Date(),
): Promise<OctopusRate[]> {
  const cache = await ensureElectricityPricesCached(dayKeys, now);
  const rates: OctopusRate[] = [];
  for (const dayKey of dayKeys) {
    const cached = cache[dayKey];
    if (cached?.length) {
      rates.push(...cachedElectricityToRates(cached));
    }
  }
  return rates;
}

export async function loadTodayElectricityRates(now: Date = new Date()): Promise<OctopusRate[]> {
  return loadElectricityRatesForDays([dayKeyUK(now)], now);
}

export async function loadTodayTomorrowElectricityRates(now: Date = new Date()): Promise<{
  today: OctopusRate[];
  tomorrow: OctopusRate[];
}> {
  const todayYmd = dayKeyUK(now);
  const tomorrowYmd = ukTomorrowYmd(now);
  const cache = await ensureElectricityPricesCached([todayYmd, tomorrowYmd], now);
  return {
    today: cachedElectricityToRates(cache[todayYmd] ?? []),
    tomorrow: cachedElectricityToRates(cache[tomorrowYmd] ?? []),
  };
}

function ukHourFromIso(iso: string): number | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const hour = Number(date.toLocaleTimeString("en-GB", {
    hour: "numeric",
    hour12: false,
    timeZone: UK_TZ,
  }));
  return Number.isFinite(hour) ? hour : null;
}

export function averageElectricityByPeriod(
  rates: OctopusRate[],
): Record<(typeof ELECTRICITY_PERIOD_LABELS)[number], number | null> {
  const buckets = Object.fromEntries(
    ELECTRICITY_PERIODS.map((period) => [period.label, [] as number[]]),
  ) as Record<(typeof ELECTRICITY_PERIOD_LABELS)[number], number[]>;

  for (const rate of rates) {
    if (rate.value_inc_vat == null || !rate.valid_from) continue;
    const hour = ukHourFromIso(rate.valid_from);
    if (hour == null) continue;
    const period = ELECTRICITY_PERIODS.find(
      (entry) => hour >= entry.minHour && hour < entry.maxHour,
    );
    if (period) {
      buckets[period.label].push(rate.value_inc_vat);
    }
  }

  return Object.fromEntries(
    ELECTRICITY_PERIODS.map((period) => {
      const values = buckets[period.label];
      const average = values.length > 0
        ? values.reduce((sum, value) => sum + value, 0) / values.length
        : null;
      return [period.label, average];
    }),
  ) as Record<(typeof ELECTRICITY_PERIOD_LABELS)[number], number | null>;
}

function formatElectricityPrice(pence: number): string {
  const text = `${pence.toFixed(2)}p`;
  return colorize(text, colorForRate(pence, "electricity"));
}

export function formatElectricityPeriodAvgLine(
  label: (typeof ELECTRICITY_PERIOD_LABELS)[number],
  pence: number | null,
  dayLabel?: string,
): string {
  const prefix = dayLabel ? `${dayLabel} avg ${label}` : `avg ${label}`;
  return pence == null ? `${prefix}: -` : `${prefix}: ${formatElectricityPrice(pence)}`;
}

export function formatElectricityPeriodAvgLines(
  rates: OctopusRate[],
  dayLabel?: string,
): string[] {
  const averages = averageElectricityByPeriod(rates);
  return ELECTRICITY_PERIOD_LABELS.flatMap((label) => {
    const pence = averages[label];
    if (pence == null) return [];
    return [formatElectricityPeriodAvgLine(label, pence, dayLabel)];
  });
}
