#!/usr/bin/env node

import { writeFileSync } from "node:fs";
import { getConfigPath, readPhoneCliConfig } from "./config";

type OctopusAgreement = {
  tariff_code?: string;
  valid_from?: string;
  valid_to?: string | null;
};

type OctopusMeterPoint = {
  mpan?: string;
  mprn?: string;
  meters?: Array<{
    serial_number?: string;
    active_from?: string;
  }>;
  agreements?: OctopusAgreement[];
};

type OctopusProperty = {
  electricity_meter_points?: OctopusMeterPoint[];
  gas_meter_points?: OctopusMeterPoint[];
};

type OctopusAccountResponse = {
  properties?: OctopusProperty[];
};

type OctopusRate = {
  valid_from?: string;
  valid_to?: string;
  value_inc_vat?: number;
  value_exc_vat?: number;
};

type OctopusRatesResponse = {
  next?: string | null;
  results?: OctopusRate[];
};

type TariffDerivation = {
  electricityMeters: Array<{ mpan: string; serial: string }>;
  gasMeters: Array<{ mprn: string; serial: string }>;
  etariff: OctopusAgreement;
  gtariff: OctopusAgreement;
  etariffPrices: string;
  gtariffPrices: string;
  etariffStanding: string;
  gtariffStanding: string;
};

type OctopusConsumption = {
  interval_start?: string;
  interval_end?: string;
  consumption?: number;
};

type OctopusConsumptionResponse = {
  next?: string | null;
  results?: OctopusConsumption[];
};

const OCTOPUS_BASE_URL = "https://api.octopus.energy/v1";
const DAY_MS = 24 * 60 * 60 * 1000;
const ANSI_RESET = "\x1b[0m";
const ANSI_GREEN = "\x1b[32m";
const ANSI_YELLOW = "\x1b[33m";
const ANSI_ORANGE = "\x1b[38;5;208m";
const ANSI_RED = "\x1b[31m";
const ANSI_BRIGHT_GREEN = "\x1b[92m";
const ANSI_AMBER_GAS = "\x1b[38;5;214m";
const ANSI_BRIGHT_RED = "\x1b[91m";
const ANSI_REGEX = /\x1b\[[0-9;]*m/g;
type FuelType = "electricity" | "gas";
type DailyTotals = Record<string, number>;
type MonthlyAverages = {
  eCost: number;
  gCost: number;
  eKwh: number;
  gKwh: number;
  days: number;
  updatedAt: string;
};
type MonthlyAverageCache = Record<string, MonthlyAverages>;

function usage(): void {
  console.log("Usage:");
  console.log("  octo");
  console.log("");
  console.log("Credentials can come from :");
  console.log(`  Config file: ${getConfigPath()} (section: "octo")`);
  console.log("");
  console.log("Optional:");
  console.log("  OCTOPUS_GAS_KWH_PER_UNIT (default 11.2)");
}

function resolveOctoCredentials(): {
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
  // Mirrors: tariff_code.split('-').slice(0, -1).slice(2).join('-')
  const parts = tariffCode.split("-").slice(0, -1).slice(2);
  if (parts.length === 0) {
    throw new Error(
      `Unable to derive product code from tariff code: ${tariffCode}`,
    );
  }
  return parts.join("-");
}

function deriveTariffs(account: OctopusAccountResponse): TariffDerivation {
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
    // Deduplicate pairs.
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

async function fetchOctopusJson<T>(url: string, token: string): Promise<T> {
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

async function fetchAllOctopusResults<T>(
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

function toIsoNoMs(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function ratesUrlWithWindow(baseUrl: string, from: Date, to: Date): string {
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
    timeZone: "Europe/London",
  });
  const day = from.toLocaleDateString("en-GB", {
    day: "numeric",
    timeZone: "Europe/London",
  });
  const month = from.toLocaleDateString("en-GB", {
    month: "numeric",
    timeZone: "Europe/London",
  });
  const startTime = from.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/London",
  });
  const endTime = to.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/London",
  });
  const capDay =
    dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1).toLowerCase();
  return `${capDay} ${day}/${month} ${startTime} -> ${endTime}`;
}

function colorForRate(rateIncVat: number, fuel: FuelType): string {
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

function formatRateLine(rate: OctopusRate, fuel: FuelType): string {
  const window = formatWindow(rate);
  const inc =
    rate.value_inc_vat == null ? "?" : `${rate.value_inc_vat.toFixed(4)}p`;
  if (rate.value_inc_vat == null) {
    return `${window} | ${inc}`;
  }
  return `${window} | ${colorize(inc, colorForRate(rate.value_inc_vat, fuel))}`;
}

function printRates(title: string, rates: OctopusRate[], fuel: FuelType): void {
  console.log("");
  console.log(title);
  if (rates.length === 0) {
    console.log("- No rates returned for selected window.");
    return;
  }
  const sorted = [...rates].sort((a, b) => {
    const aTs = new Date(a.valid_from || "").getTime();
    const bTs = new Date(b.valid_from || "").getTime();
    return aTs - bTs;
  });
  for (const rate of sorted) {
    console.log(`- ${formatRateLine(rate, fuel)}`);
  }
}

function padCell(value: string, width: number): string {
  const visible = value.replace(ANSI_REGEX, "").length;
  return value + " ".repeat(Math.max(0, width - visible));
}

function makeAsciiTable(headers: string[], rows: string[][]): string[] {
  const widths = headers.map((header, idx) =>
    Math.max(
      header.replace(ANSI_REGEX, "").length,
      ...rows.map((row) => (row[idx] || "").replace(ANSI_REGEX, "").length),
    ),
  );
  const border = `+-${widths.map((w) => "-".repeat(w)).join("-+-")}-+`;
  const headerLine = `| ${headers.map((h, i) => padCell(h, widths[i])).join(" | ")} |`;
  const body = rows.map(
    (row) =>
      `| ${row.map((v, i) => padCell(v || "", widths[i])).join(" | ")} |`,
  );
  return [border, headerLine, border, ...body, border];
}

function dayKeyUK(date: Date): string {
  const y = date.toLocaleDateString("en-CA", { timeZone: "Europe/London" });
  return y; // YYYY-MM-DD
}

function dayLabelShort(dayKey: string): string {
  const d = new Date(`${dayKey}T00:00:00Z`);
  const weekday = d.toLocaleDateString("en-GB", {
    weekday: "short",
    timeZone: "Europe/London",
  });
  const day = d.toLocaleDateString("en-GB", {
    day: "numeric",
    timeZone: "Europe/London",
  });
  const month = d.toLocaleDateString("en-GB", {
    month: "numeric",
    timeZone: "Europe/London",
  });
  const capDay =
    weekday.charAt(0).toUpperCase() + weekday.slice(1).toLowerCase();
  return `${capDay} ${day}/${month}`;
}

function aggregateDailyIncVat(rates: OctopusRate[]): DailyTotals {
  const totals: DailyTotals = {};
  for (const rate of rates) {
    if (rate.value_inc_vat == null || !rate.valid_from) continue;
    const key = dayKeyUK(new Date(rate.valid_from));
    totals[key] = (totals[key] || 0) + rate.value_inc_vat;
  }
  return totals;
}

function lookupUnitRatePence(rates: OctopusRate[], atIso: string): number {
  const at = new Date(atIso).getTime();
  if (Number.isNaN(at)) return 0;
  let fallback: number | null = null;

  for (const rate of rates) {
    if (rate.value_inc_vat == null) continue;
    const from = rate.valid_from
      ? new Date(rate.valid_from).getTime()
      : Number.NaN;
    const to = rate.valid_to
      ? new Date(rate.valid_to).getTime()
      : Number.POSITIVE_INFINITY;
    if (Number.isNaN(from)) continue;

    // Track latest known rate starting before this timestamp.
    if (at >= from) {
      fallback = rate.value_inc_vat;
    }

    if (at >= from && at < to) return rate.value_inc_vat;
  }
  return fallback ?? 0;
}

function standingChargePerDayPence(standingRates: OctopusRate[]): number {
  if (standingRates.length === 0) return 0;
  const now = Date.now();
  const active =
    standingRates.find((rate) => {
      const from = rate.valid_from
        ? new Date(rate.valid_from).getTime()
        : Number.NaN;
      const to = rate.valid_to ? new Date(rate.valid_to).getTime() : Number.NaN;
      return (
        !Number.isNaN(from) &&
        !Number.isNaN(to) &&
        now >= from &&
        now < to &&
        rate.value_inc_vat != null
      );
    }) ||
    [...standingRates]
      .sort(
        (a, b) =>
          new Date(b.valid_from || "").getTime() -
          new Date(a.valid_from || "").getTime(),
      )
      .find((rate) => rate.value_inc_vat != null);
  return active?.value_inc_vat || 0;
}

function aggregateDailyBilledPence(
  consumption: OctopusConsumption[],
  unitRates: OctopusRate[],
  standingPencePerDay: number,
  unitToKwhFactor: number = 1,
): DailyTotals {
  const totals: DailyTotals = {};
  const seenDays = new Set<string>();

  for (const row of consumption) {
    const start = row.interval_start;
    const kwh = row.consumption;
    if (!start || kwh == null) continue;
    const day = dayKeyUK(new Date(start));
    seenDays.add(day);
    const unitPence = lookupUnitRatePence(unitRates, start);
    totals[day] = (totals[day] || 0) + kwh * unitToKwhFactor * unitPence;
  }

  for (const day of seenDays) {
    totals[day] = (totals[day] || 0) + standingPencePerDay;
  }
  return totals;
}

function aggregateDailyConsumedKwh(
  consumption: OctopusConsumption[],
  unitToKwhFactor: number = 1,
): DailyTotals {
  const totals: DailyTotals = {};
  for (const row of consumption) {
    const start = row.interval_start;
    const units = row.consumption;
    if (!start || units == null) continue;
    const day = dayKeyUK(new Date(start));
    totals[day] = (totals[day] || 0) + units * unitToKwhFactor;
  }
  return totals;
}

function formatPence(value: number): string {
  return `${value.toFixed(2)}p`;
}

function formatKwh(value: number): string {
  return `${value.toFixed(2)}kWh`;
}

function formatPoundsFromPence(valuePence: number): string {
  return `£${(valuePence / 100).toFixed(2)}`;
}

function rankedColorByDay(
  dayKeys: string[],
  totals: DailyTotals,
  fuel: FuelType,
): Record<string, string> {
  // Leave the most recent 2 days uncolored, rank the older 12 days.
  const rankableDays = dayKeys.slice(0, Math.max(0, dayKeys.length - 2));
  const entries = rankableDays.map((day) => ({ day, value: totals[day] || 0 }));
  entries.sort((a, b) => a.value - b.value);

  const palette =
    fuel === "electricity"
      ? { low: ANSI_GREEN, mid: ANSI_ORANGE, high: ANSI_RED }
      : { low: ANSI_BRIGHT_GREEN, mid: ANSI_AMBER_GAS, high: ANSI_BRIGHT_RED };

  const map: Record<string, string> = {};
  for (let i = 0; i < entries.length; i += 1) {
    const bucket = i < 4 ? palette.low : i < 8 ? palette.mid : palette.high;
    map[entries[i].day] = bucket;
  }
  return map;
}

function lastNDaysKeysInclusive(end: Date, days: number): string[] {
  const keys: string[] = [];
  const anchor = new Date(end.getTime());
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(anchor.getTime() - i * DAY_MS);
    keys.push(dayKeyUK(d));
  }
  return keys;
}

function monthKeysBackInclusive(now: Date, months: number): string[] {
  const keys: string[] = [];
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    keys.push(`${y}-${m}`);
  }
  return keys;
}

function sortMonthKeysAsc(keys: string[]): string[] {
  return [...keys].sort((a, b) => a.localeCompare(b));
}

function startOfMonthUtc(monthKey: string): Date {
  return new Date(`${monthKey}-01T00:00:00Z`);
}

function nextMonthKey(monthKey: string): string {
  const [yRaw, mRaw] = monthKey.split("-");
  const y = Number(yRaw);
  const m = Number(mRaw);
  const d = new Date(Date.UTC(y, m, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(monthKey: string): string {
  const d = startOfMonthUtc(monthKey);
  return d.toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
    timeZone: "Europe/London",
  });
}

function monthKeyFromDayKey(dayKey: string): string {
  return dayKey.slice(0, 7);
}

function currentMonthKey(now: Date): string {
  return dayKeyUK(now).slice(0, 7);
}

/** Finished UK month preceding `yyyy-mm` (e.g. Feb 2026 → 2026-01). */
function priorCalendarMonthKey(monthKeyYm: string): string {
  const [ys, ms] = monthKeyYm.split("-");
  let y = Number(ys);
  let m = Number(ms);
  m -= 1;
  if (m < 1) {
    m = 12;
    y -= 1;
  }
  return `${y}-${String(m).padStart(2, "0")}`;
}

/** London calendar day-of-month (`dayKeyUK` uses Europe/London). */
function londonCalendarDayOfMonth(now: Date): number {
  const dk = dayKeyUK(now);
  return Number(dk.slice(8));
}

/** UK days 1–2 of the month: defer monthly tables (API still settling); also skip persisting the just-finished month. */
function isDeferredMonthlyStatsWindowUk(now: Date): boolean {
  return londonCalendarDayOfMonth(now) <= 2;
}

/** Omit the most recent UK calendar days from monthly averages (incomplete consumption). */
const MONTHLY_AVG_EXCLUDED_TRAILING_UK_DAYS = 2;

/** UK `YYYY-MM-DD` minus whole calendar days (Europe/London anchor from `dayKeyUK`). */
function ukDayKeyMinusCalendarDays(dayKey: string, subtractDays: number): string {
  const [yRaw, mRaw, dRaw] = dayKey.split("-").map(Number);
  const d = new Date(Date.UTC(yRaw, mRaw - 1, dRaw));
  d.setUTCDate(d.getUTCDate() - subtractDays);
  const y = d.getUTCFullYear();
  const mo = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  return `${y}-${String(mo).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Latest UK day key included in averages (e.g. on the 9th, that is the 7th — today and yesterday omitted). */
function latestUkDayKeyIncludedInMonthlyAverages(now: Date): string {
  return ukDayKeyMinusCalendarDays(
    dayKeyUK(now),
    MONTHLY_AVG_EXCLUDED_TRAILING_UK_DAYS,
  );
}

function filterDailyTotalsThroughDayInclusive(totals: DailyTotals, lastDayInclusive: string): DailyTotals {
  const out: DailyTotals = {};
  for (const [k, v] of Object.entries(totals)) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(k) && k <= lastDayInclusive) {
      out[k] = v;
    }
  }
  return out;
}

function suppressCachingPendingPriorFinishedMonthUk(now: Date): boolean {
  return isDeferredMonthlyStatsWindowUk(now);
}

/** Drop prior UK month during grace so this run recomputes; returns true if an entry was removed. */
function evictUnsettledPriorMonthFromCache(cache: MonthlyAverageCache, now: Date): boolean {
  if (!suppressCachingPendingPriorFinishedMonthUk(now)) return false;
  const prior = priorCalendarMonthKey(currentMonthKey(now));
  if (!cache[prior]) return false;
  delete cache[prior];
  return true;
}

function isFinishedMonth(monthKey: string, now: Date): boolean {
  return monthKey < currentMonthKey(now);
}

/** Persist a finished month's averages only once values are unlikely to revise (outside prior-month grace). */
function shouldPersistFinishedMonthTotals(monthKey: string, now: Date): boolean {
  if (!isFinishedMonth(monthKey, now)) return false;
  if (
    suppressCachingPendingPriorFinishedMonthUk(now) &&
    monthKey === priorCalendarMonthKey(currentMonthKey(now))
  ) {
    return false;
  }
  return true;
}

function monthlyAverageCacheFromConfig(): MonthlyAverageCache {
  const config = readPhoneCliConfig();
  const octo = (config.octo || {}) as Record<string, unknown>;
  const raw = octo.monthlyAverageCache;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const cache: MonthlyAverageCache = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!/^\d{4}-\d{2}$/.test(key)) continue;
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const rec = value as Record<string, unknown>;
    const eCost = Number(rec.eCost);
    const gCost = Number(rec.gCost);
    const eKwh = Number(rec.eKwh);
    const gKwh = Number(rec.gKwh);
    const days = Number(rec.days);
    if (
      !Number.isFinite(eCost) ||
      !Number.isFinite(gCost) ||
      !Number.isFinite(eKwh) ||
      !Number.isFinite(gKwh) ||
      !Number.isFinite(days) ||
      days <= 0
    ) {
      continue;
    }
    cache[key] = {
      eCost,
      gCost,
      eKwh,
      gKwh,
      days,
      updatedAt: String(rec.updatedAt || ""),
    };
  }
  return cache;
}

function saveMonthlyAverageCache(cache: MonthlyAverageCache): void {
  const configPath = getConfigPath();
  const config = readPhoneCliConfig() as Record<string, unknown>;
  const octo = ((config.octo || {}) as Record<string, unknown>);
  octo.monthlyAverageCache = cache;
  config.octo = octo;
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

function monthlyAveragesFromDaily(
  eDailyCost: DailyTotals,
  gDailyCost: DailyTotals,
  eDailyKwh: DailyTotals,
  gDailyKwh: DailyTotals,
): MonthlyAverageCache {
  const keys = new Set<string>([
    ...Object.keys(eDailyCost),
    ...Object.keys(gDailyCost),
    ...Object.keys(eDailyKwh),
    ...Object.keys(gDailyKwh),
  ]);
  const sums: Record<string, { eCost: number; gCost: number; eKwh: number; gKwh: number; days: number }> = {};
  for (const dayKey of keys) {
    const month = monthKeyFromDayKey(dayKey);
    sums[month] ||= { eCost: 0, gCost: 0, eKwh: 0, gKwh: 0, days: 0 };
    sums[month].eCost += eDailyCost[dayKey] || 0;
    sums[month].gCost += gDailyCost[dayKey] || 0;
    sums[month].eKwh += eDailyKwh[dayKey] || 0;
    sums[month].gKwh += gDailyKwh[dayKey] || 0;
    sums[month].days += 1;
  }
  const out: MonthlyAverageCache = {};
  const nowIso = new Date().toISOString();
  for (const [month, sum] of Object.entries(sums)) {
    if (sum.days <= 0) continue;
    out[month] = {
      eCost: sum.eCost / sum.days,
      gCost: sum.gCost / sum.days,
      eKwh: sum.eKwh / sum.days,
      gKwh: sum.gKwh / sum.days,
      days: sum.days,
      updatedAt: nowIso,
    };
  }
  return out;
}

function mergeDailyTotals(base: DailyTotals, extra: DailyTotals): DailyTotals {
  const merged: DailyTotals = { ...base };
  for (const [day, value] of Object.entries(extra)) {
    merged[day] = (merged[day] || 0) + value;
  }
  return merged;
}

function printPast14DaysHorizontal(
  eDailyCost: DailyTotals,
  gDailyCost: DailyTotals,
  eDailyKwh: DailyTotals,
  gDailyKwh: DailyTotals,
  now: Date,
): void {
  const dayKeys = lastNDaysKeysInclusive(now, 14);
  const eColorByDay = rankedColorByDay(dayKeys, eDailyCost, "electricity");
  const gColorByDay = rankedColorByDay(dayKeys, gDailyCost, "gas");

  console.log("");
  console.log("Past 14 days (daily totals, inc VAT + consumed kWh)");
  const headers = [
    "Date",
    "⚡ cost",
    "Gas cost",
    "Total cost",
    "⚡ kWh",
    "Gas kWh",
  ];
  const rows = dayKeys.map((k) => [
    dayLabelShort(k),
    colorize(formatPence(eDailyCost[k] || 0), eColorByDay[k] || ANSI_RESET),
    colorize(formatPence(gDailyCost[k] || 0), gColorByDay[k] || ANSI_RESET),
    formatPence((eDailyCost[k] || 0) + (gDailyCost[k] || 0)),
    formatKwh(eDailyKwh[k] || 0),
    formatKwh(gDailyKwh[k] || 0),
  ]);

  for (const line of makeAsciiTable(headers, rows)) {
    console.log(line);
  }
}

function averageForPeriod(days: string[], daily: DailyTotals): number {
  if (days.length === 0) return 0;
  let total = 0;
  for (const day of days) {
    total += daily[day] || 0;
  }
  return total / days.length;
}

function printAverageMonthlySummary(
  months: string[],
  cache: MonthlyAverageCache,
  now: Date,
): void {
  void now;
  const rows = months.map((month) => {
    const item = cache[month];
    if (!item) return [monthLabel(month), "-", "-", "-", "-", "-"];
    return [
      monthLabel(month),
      formatPence(item.eCost),
      formatPence(item.gCost),
      formatPence(item.eCost + item.gCost),
      formatKwh(item.eKwh),
      formatKwh(item.gKwh),
    ];
  });

  console.log("");
  console.log(
    `Average daily totals by calendar month (inc VAT + consumed kWh)`,
  );
  for (const line of makeAsciiTable(
    ["Month", "⚡ cost", "Gas cost", "Total cost", "⚡ kWh", "Gas kWh"],
    rows,
  )) {
    console.log(line);
  }
}

function previousMonthKey(now: Date): string {
  return priorCalendarMonthKey(currentMonthKey(now));
}

function printFinalMonthTotals(cache: MonthlyAverageCache, now: Date): void {
  const currentKey = currentMonthKey(now);
  const prevKey = previousMonthKey(now);
  const skipped = MONTHLY_AVG_EXCLUDED_TRAILING_UK_DAYS;

  const rows = [
    {
      key: currentKey,
      label: `${monthLabel(currentKey)}`,
    },
    {
      key: prevKey,
      label: `${monthLabel(prevKey)}`,
    },
  ].map((item) => {
    const rec = cache[item.key];
    if (!rec) {
      return [item.label, "-", "-", "-"];
    }
    const eTotal = rec.eCost * rec.days;
    const gTotal = rec.gCost * rec.days;
    return [
      item.label,
      formatPoundsFromPence(eTotal),
      formatPoundsFromPence(gTotal),
      formatPoundsFromPence(eTotal + gTotal),
    ];
  });

  console.log("");
  console.log("Monthly total cost summary");
  for (const line of makeAsciiTable(
    ["Month", "⚡ total", "Gas total", "Total"],
    rows,
  )) {
    console.log(line);
  }
}

async function main(): Promise<void> {
  try {
    const args = process.argv.slice(2);
    if (args[0] === "--help" || args[0] === "-h") {
      usage();
      return;
    }
    if (args.length > 0) {
      throw new Error("This command takes no arguments.");
    }

    const { token, accountNumber, gasKwhPerUnit } = resolveOctoCredentials();

    const accountUrl = `${OCTOPUS_BASE_URL}/accounts/${accountNumber}/`;
    const account = await fetchOctopusJson<OctopusAccountResponse>(
      accountUrl,
      token,
    );
    const derived = deriveTariffs(account);

    const from = new Date();
    const to = new Date(from.getTime() + 2 * DAY_MS);
    const historyFrom = new Date(from.getTime() - 35 * DAY_MS);
    const eRatesUrl = ratesUrlWithWindow(derived.etariffPrices, from, to);
    const gRatesUrl = ratesUrlWithWindow(derived.gtariffPrices, from, to);
    const eHistoryUrl = ratesUrlWithWindow(
      derived.etariffPrices,
      historyFrom,
      from,
    );
    const gHistoryUrl = ratesUrlWithWindow(
      derived.gtariffPrices,
      historyFrom,
      from,
    );
    const eStandingUrl = ratesUrlWithWindow(
      derived.etariffStanding,
      historyFrom,
      from,
    );
    const gStandingUrl = ratesUrlWithWindow(
      derived.gtariffStanding,
      historyFrom,
      from,
    );
    const eConsumptionUrls = derived.electricityMeters.map(
      (meter) =>
        `${OCTOPUS_BASE_URL}/electricity-meter-points/${encodeURIComponent(meter.mpan)}` +
        `/meters/${encodeURIComponent(meter.serial)}/consumption/` +
        `?period_from=${encodeURIComponent(toIsoNoMs(historyFrom))}` +
        `&period_to=${encodeURIComponent(toIsoNoMs(from))}` +
        `&order_by=period`,
    );
    const gConsumptionUrls = derived.gasMeters.map(
      (meter) =>
        `${OCTOPUS_BASE_URL}/gas-meter-points/${encodeURIComponent(meter.mprn)}` +
        `/meters/${encodeURIComponent(meter.serial)}/consumption/` +
        `?period_from=${encodeURIComponent(toIsoNoMs(historyFrom))}` +
        `&period_to=${encodeURIComponent(toIsoNoMs(from))}` +
        `&order_by=period`,
    );

    const [
      electricityResults,
      gasResults,
      eHistoryResults,
      gHistoryResults,
      eStandingResults,
      gStandingResults,
    ] = await Promise.all([
      fetchAllOctopusResults<OctopusRate>(eRatesUrl, token),
      fetchAllOctopusResults<OctopusRate>(gRatesUrl, token),
      fetchAllOctopusResults<OctopusRate>(eHistoryUrl, token),
      fetchAllOctopusResults<OctopusRate>(gHistoryUrl, token),
      fetchAllOctopusResults<OctopusRate>(eStandingUrl, token),
      fetchAllOctopusResults<OctopusRate>(gStandingUrl, token),
    ]);

    const [eConsumptionPages, gConsumptionPages] = await Promise.all([
      Promise.all(
        eConsumptionUrls.map((url) =>
          fetchAllOctopusResults<OctopusConsumption>(url, token),
        ),
      ),
      Promise.all(
        gConsumptionUrls.map((url) =>
          fetchAllOctopusResults<OctopusConsumption>(url, token),
        ),
      ),
    ]);
    const eConsumptionResults = eConsumptionPages.flat();
    const gConsumptionResults = gConsumptionPages.flat();

    console.log(`Octopus account ${accountNumber}`);
    console.log(`Window: ${toIsoNoMs(from)} -> ${toIsoNoMs(to)}`);
    console.log(`Electric tariff: ${derived.etariff.tariff_code}`);
    console.log(`Gas tariff: ${derived.gtariff.tariff_code}`);
    console.log(`Gas conversion: ${gasKwhPerUnit} kWh/unit`);

    printRates(
      "Electricity rates (inc VAT)",
      electricityResults,
      "electricity",
    );
    printRates("Gas rates (inc VAT)", gasResults, "gas");

    const eDaily = aggregateDailyBilledPence(
      eConsumptionResults,
      eHistoryResults,
      standingChargePerDayPence(eStandingResults),
      1,
    );
    const gDaily = aggregateDailyBilledPence(
      gConsumptionResults,
      gHistoryResults,
      standingChargePerDayPence(gStandingResults),
      gasKwhPerUnit,
    );
    const eDailyKwh = aggregateDailyConsumedKwh(eConsumptionResults, 1);
    const gDailyKwh = aggregateDailyConsumedKwh(
      gConsumptionResults,
      gasKwhPerUnit,
    );
    printPast14DaysHorizontal(eDaily, gDaily, eDailyKwh, gDailyKwh, from);

    if (isDeferredMonthlyStatsWindowUk(from)) {
      console.log("");
      console.log("Average daily totals by calendar month: not ready yet");
      console.log("");
      console.log("Monthly total cost summary: not ready yet");
    } else {
      const lastUkDayInAvg = latestUkDayKeyIncludedInMonthlyAverages(from);

      const fetchWindowMonths = monthKeysBackInclusive(from, 3);
      const monthlyCache = monthlyAverageCacheFromConfig();
      const unsettledPriorEvicted = evictUnsettledPriorMonthFromCache(
        monthlyCache,
        from,
      );
      const monthlyForDisplay: MonthlyAverageCache = { ...monthlyCache };
      const cachedMonths = sortMonthKeysAsc(Object.keys(monthlyCache));
      const monthKeys = sortMonthKeysAsc(
        Array.from(new Set([...cachedMonths, ...fetchWindowMonths])),
      );
      const missingMonths = fetchWindowMonths.filter((m) => !monthlyCache[m]);

      let eMonthlyDaily = { ...eDaily };
      let gMonthlyDaily = { ...gDaily };
      let eMonthlyKwh = { ...eDailyKwh };
      let gMonthlyKwh = { ...gDailyKwh };

      if (missingMonths.length > 0) {
        const oldestMissing = missingMonths[0];
        const newestMissing = missingMonths[missingMonths.length - 1];
        const monthlyFrom = startOfMonthUtc(oldestMissing);
        const monthlyTo = startOfMonthUtc(nextMonthKey(newestMissing));

        // Reuse already fetched 35-day dataset; only fetch the older missing gap.
        const gapEnd = monthlyTo < historyFrom ? monthlyTo : historyFrom;
        if (monthlyFrom < gapEnd) {
          const eMonthlyHistoryUrl = ratesUrlWithWindow(
            derived.etariffPrices,
            monthlyFrom,
            gapEnd,
          );
          const gMonthlyHistoryUrl = ratesUrlWithWindow(
            derived.gtariffPrices,
            monthlyFrom,
            gapEnd,
          );
          const eMonthlyStandingUrl = ratesUrlWithWindow(
            derived.etariffStanding,
            monthlyFrom,
            gapEnd,
          );
          const gMonthlyStandingUrl = ratesUrlWithWindow(
            derived.gtariffStanding,
            monthlyFrom,
            gapEnd,
          );
          const eMonthlyConsumptionUrls = derived.electricityMeters.map(
            (meter) =>
              `${OCTOPUS_BASE_URL}/electricity-meter-points/${encodeURIComponent(meter.mpan)}` +
              `/meters/${encodeURIComponent(meter.serial)}/consumption/` +
              `?period_from=${encodeURIComponent(toIsoNoMs(monthlyFrom))}` +
              `&period_to=${encodeURIComponent(toIsoNoMs(gapEnd))}` +
              `&order_by=period`,
          );
          const gMonthlyConsumptionUrls = derived.gasMeters.map(
            (meter) =>
              `${OCTOPUS_BASE_URL}/gas-meter-points/${encodeURIComponent(meter.mprn)}` +
              `/meters/${encodeURIComponent(meter.serial)}/consumption/` +
              `?period_from=${encodeURIComponent(toIsoNoMs(monthlyFrom))}` +
              `&period_to=${encodeURIComponent(toIsoNoMs(gapEnd))}` +
              `&order_by=period`,
          );

          const [
            eGapRates,
            gGapRates,
            eGapStanding,
            gGapStanding,
            eGapConsumptionPages,
            gGapConsumptionPages,
          ] = await Promise.all([
            fetchAllOctopusResults<OctopusRate>(eMonthlyHistoryUrl, token),
            fetchAllOctopusResults<OctopusRate>(gMonthlyHistoryUrl, token),
            fetchAllOctopusResults<OctopusRate>(eMonthlyStandingUrl, token),
            fetchAllOctopusResults<OctopusRate>(gMonthlyStandingUrl, token),
            Promise.all(
              eMonthlyConsumptionUrls.map((url) =>
                fetchAllOctopusResults<OctopusConsumption>(url, token),
              ),
            ),
            Promise.all(
              gMonthlyConsumptionUrls.map((url) =>
                fetchAllOctopusResults<OctopusConsumption>(url, token),
              ),
            ),
          ]);

          const eGapConsumption = eGapConsumptionPages.flat();
          const gGapConsumption = gGapConsumptionPages.flat();
          eMonthlyDaily = mergeDailyTotals(
            eMonthlyDaily,
            aggregateDailyBilledPence(
              eGapConsumption,
              eGapRates,
              standingChargePerDayPence(eGapStanding),
              1,
            ),
          );
          gMonthlyDaily = mergeDailyTotals(
            gMonthlyDaily,
            aggregateDailyBilledPence(
              gGapConsumption,
              gGapRates,
              standingChargePerDayPence(gGapStanding),
              gasKwhPerUnit,
            ),
          );
          eMonthlyKwh = mergeDailyTotals(
            eMonthlyKwh,
            aggregateDailyConsumedKwh(eGapConsumption, 1),
          );
          gMonthlyKwh = mergeDailyTotals(
            gMonthlyKwh,
            aggregateDailyConsumedKwh(gGapConsumption, gasKwhPerUnit),
          );
        }
      }

      eMonthlyDaily = filterDailyTotalsThroughDayInclusive(
        eMonthlyDaily,
        lastUkDayInAvg,
      );
      gMonthlyDaily = filterDailyTotalsThroughDayInclusive(
        gMonthlyDaily,
        lastUkDayInAvg,
      );
      eMonthlyKwh = filterDailyTotalsThroughDayInclusive(eMonthlyKwh, lastUkDayInAvg);
      gMonthlyKwh = filterDailyTotalsThroughDayInclusive(gMonthlyKwh, lastUkDayInAvg);

      const computedMonthly = monthlyAveragesFromDaily(
        eMonthlyDaily,
        gMonthlyDaily,
        eMonthlyKwh,
        gMonthlyKwh,
      );
      for (const mk of Object.keys(computedMonthly)) {
        monthlyForDisplay[mk] = computedMonthly[mk];
      }

      if (missingMonths.length > 0) {
        for (const month of missingMonths) {
          if (!computedMonthly[month]) continue;
          if (shouldPersistFinishedMonthTotals(month, from)) {
            monthlyCache[month] = computedMonthly[month];
          }
        }
        saveMonthlyAverageCache(monthlyCache);
      } else if (unsettledPriorEvicted) {
        saveMonthlyAverageCache(monthlyCache);
      }

      printAverageMonthlySummary(monthKeys, monthlyForDisplay, from);
      printFinalMonthTotals(monthlyForDisplay, from);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    console.error("");
    usage();
    process.exit(1);
  }
}

void main();

export {};
