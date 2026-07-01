import {
  ensureSolarCacheLoaded,
  migrateLegacySolarCacheFromConfig,
  readServiceCache,
  updateServiceCache,
} from "./cache";
import type { SolarResponse } from "./solarApi";

const DAY_MS = 24 * 60 * 60 * 1000;
const UK_TZ = "Europe/London";

export const SOLAR_MONTHLY_YIELD_MONTHS = 6;

type DailyYield = {
  date: string;
  value: number;
};

type CachedSolarMonthlyYield = {
  average: number;
  total: number;
  days: number;
  updatedAt: string;
};

export type SolarMonthlyYieldCache = Record<string, CachedSolarMonthlyYield>;

export type SolarMonthlyYieldRow = {
  month: string;
  average: number | null;
  total: number | null;
  days: number;
  daysInMonth: number;
  complete: boolean;
  cached: boolean;
};

function parseDateKey(key: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(date.getTime()) ? null : date;
}

function dayKeyUK(date: Date = new Date()): string {
  return date.toLocaleDateString("en-CA", { timeZone: UK_TZ });
}

function currentMonthKey(now: Date): string {
  return dayKeyUK(now).slice(0, 7);
}

function nextMonthKey(monthKey: string): string {
  const [yearRaw, monthRaw] = monthKey.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const date = new Date(Date.UTC(year, month, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthKeyOffset(monthKey: string, offset: number): string {
  const [yearRaw, monthRaw] = monthKey.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const date = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function daysInMonthKey(monthKey: string): number {
  const start = new Date(`${monthKey}-01T00:00:00Z`);
  const end = new Date(`${nextMonthKey(monthKey)}-01T00:00:00Z`);
  return Math.round((end.getTime() - start.getTime()) / DAY_MS);
}

function monthKeysBackInclusive(now: Date, months: number): string[] {
  const current = currentMonthKey(now);
  const safeMonths = Math.max(1, Math.floor(months));
  return Array.from({ length: safeMonths }, (_, index) =>
    monthKeyOffset(current, index - safeMonths + 1),
  );
}

function normalizeDailyYields(data: SolarResponse): DailyYield[] {
  return Object.entries(data.yield)
    .map(([date, value]) => ({ date, value }))
    .filter((entry) => parseDateKey(entry.date) && Number.isFinite(entry.value))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function normalizeCachedMonthlyYield(value: unknown): CachedSolarMonthlyYield | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const average = Number(record.average);
  const total = Number(record.total);
  const days = Number(record.days);
  if (
    !Number.isFinite(average) ||
    !Number.isFinite(total) ||
    !Number.isFinite(days) ||
    days <= 0
  ) {
    return null;
  }
  return {
    average,
    total,
    days,
    updatedAt: String(record.updatedAt || ""),
  };
}

export function readSolarMonthlyYieldCache(): SolarMonthlyYieldCache {
  const raw = readServiceCache("solar").monthlyYield;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};

  const cache: SolarMonthlyYieldCache = {};
  for (const [month, value] of Object.entries(raw)) {
    if (!/^\d{4}-\d{2}$/.test(month)) continue;
    const normalized = normalizeCachedMonthlyYield(value);
    if (normalized) {
      cache[month] = normalized;
    }
  }
  return cache;
}

export function saveSolarMonthlyYieldCache(cache: SolarMonthlyYieldCache): void {
  updateServiceCache("solar", { monthlyYield: cache });
}

function monthlyYieldFromDaily(
  data: SolarResponse,
  currentMonth: string,
  immutableCachedMonths: Set<string>,
): SolarMonthlyYieldCache {
  const sums: Record<string, { total: number; days: number }> = {};
  for (const entry of normalizeDailyYields(data)) {
    const month = entry.date.slice(0, 7);
    if (month < currentMonth && immutableCachedMonths.has(month)) continue;
    sums[month] ||= { total: 0, days: 0 };
    sums[month].total += entry.value;
    sums[month].days += 1;
  }

  const updatedAt = new Date().toISOString();
  const monthly: SolarMonthlyYieldCache = {};
  for (const [month, sum] of Object.entries(sums)) {
    if (sum.days <= 0) continue;
    monthly[month] = {
      average: sum.total / sum.days,
      total: sum.total,
      days: sum.days,
      updatedAt,
    };
  }
  return monthly;
}

function completedCachedMonths(cache: SolarMonthlyYieldCache, currentMonth: string): Set<string> {
  return new Set(
    Object.entries(cache)
      .filter(([month, record]) => month < currentMonth && record.days >= daysInMonthKey(month))
      .map(([month]) => month),
  );
}

export async function solarMonthlyYieldRowsFromData(
  data: SolarResponse,
  now: Date = new Date(),
  months = SOLAR_MONTHLY_YIELD_MONTHS,
): Promise<SolarMonthlyYieldRow[]> {
  await ensureSolarCacheLoaded();
  const currentMonth = currentMonthKey(now);
  const cache = readSolarMonthlyYieldCache();
  const immutableCachedMonths = completedCachedMonths(cache, currentMonth);
  const computed = monthlyYieldFromDaily(data, currentMonth, immutableCachedMonths);
  let updated = false;

  for (const [month, record] of Object.entries(computed)) {
    if (month >= currentMonth || cache[month]) continue;
    if (record.days < daysInMonthKey(month)) continue;
    cache[month] = record;
    updated = true;
  }

  if (updated) {
    saveSolarMonthlyYieldCache(cache);
  }

  return monthKeysBackInclusive(now, months).map((month) => {
    const cached = cache[month];
    const record = month < currentMonth ? cached ?? computed[month] : computed[month] ?? cached;
    const daysInMonth = daysInMonthKey(month);
    return {
      month,
      average: record?.average ?? null,
      total: record?.total ?? null,
      days: record?.days ?? 0,
      daysInMonth,
      complete: month < currentMonth && (record?.days ?? 0) >= daysInMonth,
      cached: Boolean(cached),
    };
  });
}

export function formatSolarMonthLabel(monthKey: string): string {
  const date = new Date(`${monthKey}-01T00:00:00Z`);
  return date.toLocaleDateString("en-GB", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  });
}
