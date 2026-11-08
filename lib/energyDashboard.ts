import {
  DAY_MS,
  DAILY_TOTALS_BILLING_LOOKBACK_DAYS,
  DAILY_TOTALS_DISPLAY_DAYS,
  DAILY_TOTALS_SETTLE_DAYS,
  ENERGY_MONTHLY_HISTORY_MONTHS,
  dayKeyUK,
  dayKeysBackInclusive,
  fetchAllOctopusResults,
  fetchElectricityDualRates,
  fetchGasRates,
  fetchKrakenJson,
  isDailyTotalsCacheableDay,
  isOffPeakUkHour,
  loadElectricityDualRatesForDays,
  loadGasRatesForDays,
  fetchActiveStandingChargePence,
  loadDualSupplierTariffs,
  preferMoreCompleteDayTotals,
  ratesUrlWithWindow,
  readDailyTotalsCache,
  resolveOctoCredentials,
  saveDailyTotalsCache,
  toIsoNoMs,
  ukDayStartFromKey,
  ukHourFromIso,
  ukTomorrowYmd,
  type DailyDayTotals,
  type ElectricityDualRates,
  type OctopusRate,
  type TariffDerivation,
} from "./octoApi";
import { ensureOctoCacheLoaded, readServiceCache, updateServiceCache } from "./cache";

export type EnergyConsumption = {
  interval_start?: string;
  interval_end?: string;
  consumption?: number;
};

export type DailyTotals = Record<string, number>;

export type MonthlyAverages = {
  eCost: number;
  gCost: number;
  eKwh: number;
  gKwh: number;
  days: number;
  updatedAt: string;
};

export type MonthlyAverageCache = Record<string, MonthlyAverages>;

export type EnergyDashboardData = {
  derived: TariffDerivation;
  gasKwhPerUnit: number;
  todayYmd: string;
  tomorrowYmd: string;
  electricityDual: ElectricityDualRates;
  gasRates: OctopusRate[];
  electricityStandingPence: number | null;
  gasStandingPence: number | null;
  electricityContractEnd: string | null;
  gasContractEnd: string | null;
  eDailyCost: DailyTotals;
  gDailyCost: DailyTotals;
  eDailyKwh: DailyTotals;
  gDailyKwh: DailyTotals;
  displayDayKeys: string[];
  monthlyCache: MonthlyAverageCache;
  monthlyForDisplay: MonthlyAverageCache;
  monthKeys: string[];
  now: Date;
};

const ANSI_RESET = "\x1b[0m";
const ANSI_GREEN = "\x1b[32m";
const ANSI_ORANGE = "\x1b[38;5;208m";
const ANSI_RED = "\x1b[31m";
const ANSI_BRIGHT_GREEN = "\x1b[92m";
const ANSI_AMBER_GAS = "\x1b[38;5;214m";
const ANSI_BRIGHT_RED = "\x1b[91m";
const ANSI_REGEX = /\x1b\[[0-9;]*m/g;

function shouldUseColor(): boolean {
  return Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
}

function colorize(text: string, color: string): string {
  if (!shouldUseColor()) return text;
  return `${color}${text}${ANSI_RESET}`;
}

export function lookupUnitRatePence(rates: OctopusRate[], atIso: string): number {
  const at = new Date(atIso).getTime();
  if (Number.isNaN(at)) return 0;
  let fallback: number | null = null;

  for (const rate of rates) {
    if (rate.value_inc_vat == null) continue;
    const from = rate.valid_from ? new Date(rate.valid_from).getTime() : Number.NaN;
    const to = rate.valid_to
      ? new Date(rate.valid_to).getTime()
      : Number.POSITIVE_INFINITY;
    if (Number.isNaN(from)) continue;
    if (at >= from) fallback = rate.value_inc_vat;
    if (at >= from && at < to) return rate.value_inc_vat;
  }
  return fallback ?? 0;
}

export function lookupEco7UnitRatePence(
  dual: ElectricityDualRates,
  atIso: string,
  offPeakStartHour: number,
  offPeakEndHour: number,
): number {
  const hour = ukHourFromIso(atIso);
  const useOffPeak =
    hour != null && isOffPeakUkHour(hour, offPeakStartHour, offPeakEndHour);
  const rates = useOffPeak && dual.offPeak.length > 0 ? dual.offPeak : dual.peak;
  return lookupUnitRatePence(rates, atIso);
}

/** Match consumption intervals to timed peak/off-peak windows (GoElectric etc.). */
export function lookupWindowedUnitRatePence(
  dual: ElectricityDualRates,
  atIso: string,
): number {
  return lookupUnitRatePence([...dual.peak, ...dual.offPeak], atIso);
}

export function standingChargePerDayPence(standingRates: OctopusRate[]): number {
  if (standingRates.length === 0) return 0;
  const now = Date.now();
  const active =
    standingRates.find((rate) => {
      const from = rate.valid_from ? new Date(rate.valid_from).getTime() : Number.NaN;
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
          new Date(b.valid_from || "").getTime() - new Date(a.valid_from || "").getTime(),
      )
      .find((rate) => rate.value_inc_vat != null);
  return active?.value_inc_vat || 0;
}

export function aggregateDailyBilledPenceElectricity(
  consumption: EnergyConsumption[],
  dual: ElectricityDualRates,
  standingPencePerDay: number,
  options: {
    rateMode: "eco7" | "windowed";
    offPeakStartHour: number;
    offPeakEndHour: number;
  },
): DailyTotals {
  const totals: DailyTotals = {};
  const seenDays = new Set<string>();

  for (const row of consumption) {
    const start = row.interval_start;
    const kwh = row.consumption;
    if (!start || kwh == null) continue;
    const day = dayKeyUK(new Date(start));
    seenDays.add(day);
    const unitPence =
      options.rateMode === "eco7"
        ? lookupEco7UnitRatePence(
            dual,
            start,
            options.offPeakStartHour,
            options.offPeakEndHour,
          )
        : lookupWindowedUnitRatePence(dual, start);
    totals[day] = (totals[day] || 0) + kwh * unitPence;
  }

  for (const day of seenDays) {
    totals[day] = (totals[day] || 0) + standingPencePerDay;
  }
  return totals;
}

export function aggregateDailyBilledPenceGas(
  consumption: EnergyConsumption[],
  unitRates: OctopusRate[],
  standingPencePerDay: number,
  unitToKwhFactor: number,
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

export function aggregateDailyConsumedKwh(
  consumption: EnergyConsumption[],
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

export function mergeDailyTotals(base: DailyTotals, extra: DailyTotals): DailyTotals {
  const out = { ...base };
  for (const [key, value] of Object.entries(extra)) {
    out[key] = (out[key] || 0) + value;
  }
  return out;
}

export function filterDailyTotalsThroughDayInclusive(
  totals: DailyTotals,
  lastDayKey: string,
): DailyTotals {
  const out: DailyTotals = {};
  for (const [key, value] of Object.entries(totals)) {
    if (key <= lastDayKey) out[key] = value;
  }
  return out;
}

function dayTotalsRecord(
  dayKey: string,
  eCost: DailyTotals,
  gCost: DailyTotals,
  eKwh: DailyTotals,
  gKwh: DailyTotals,
): DailyDayTotals {
  return {
    eCost: eCost[dayKey] || 0,
    gCost: gCost[dayKey] || 0,
    eKwh: eKwh[dayKey] || 0,
    gKwh: gKwh[dayKey] || 0,
  };
}

function applyDayTotalsRecord(
  dayKey: string,
  record: DailyDayTotals,
  eCost: DailyTotals,
  gCost: DailyTotals,
  eKwh: DailyTotals,
  gKwh: DailyTotals,
): void {
  eCost[dayKey] = record.eCost;
  gCost[dayKey] = record.gCost;
  eKwh[dayKey] = record.eKwh;
  gKwh[dayKey] = record.gKwh;
}

function applyFreshDailyTotals(
  dayKeys: string[],
  eDailyCost: DailyTotals,
  gDailyCost: DailyTotals,
  eDailyKwh: DailyTotals,
  gDailyKwh: DailyTotals,
  freshECost: DailyTotals,
  freshGCost: DailyTotals,
  freshEKwh: DailyTotals,
  freshGKwh: DailyTotals,
  dailyTotalsCache: Record<string, DailyDayTotals>,
  now: Date,
): void {
  for (const dayKey of dayKeys) {
    const fresh = dayTotalsRecord(dayKey, freshECost, freshGCost, freshEKwh, freshGKwh);
    const chosen = isDailyTotalsCacheableDay(dayKey, now)
      ? fresh
      : preferMoreCompleteDayTotals(dailyTotalsCache[dayKey], fresh);
    applyDayTotalsRecord(dayKey, chosen, eDailyCost, gDailyCost, eDailyKwh, gDailyKwh);
  }
}

function isDeferredMonthlyStatsWindowUk(now: Date): boolean {
  const hour = Number(
    now.toLocaleTimeString("en-GB", {
      hour: "numeric",
      hour12: false,
      timeZone: "Europe/London",
    }),
  );
  return hour < 6;
}

function latestUkDayKeyIncludedInMonthlyAverages(now: Date): string {
  const today = dayKeyUK(now);
  if (!isDeferredMonthlyStatsWindowUk(now)) {
    const [y, m, d] = today.split("-").map(Number);
    const prev = new Date(Date.UTC(y, m - 1, d - 1));
    return prev.toISOString().slice(0, 10);
  }
  const [y, m, d] = today.split("-").map(Number);
  const prev = new Date(Date.UTC(y, m - 1, d - 1 - DAILY_TOTALS_SETTLE_DAYS + 1));
  return dayKeyUK(prev);
}

function currentMonthKey(now: Date): string {
  return dayKeyUK(now).slice(0, 7);
}

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

function nextMonthKey(monthKey: string): string {
  const [yRaw, mRaw] = monthKey.split("-");
  const y = Number(yRaw);
  const m = Number(mRaw);
  const d = new Date(Date.UTC(y, m, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function startOfMonthUtc(monthKey: string): Date {
  return new Date(`${monthKey}-01T00:00:00Z`);
}

function daysInMonthKey(monthKey: string): number {
  const start = startOfMonthUtc(monthKey);
  const end = startOfMonthUtc(nextMonthKey(monthKey));
  return Math.round((end.getTime() - start.getTime()) / DAY_MS);
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

function monthKeyFromDayKey(dayKey: string): string {
  return dayKey.slice(0, 7);
}

export function readMonthlyAverageCache(): MonthlyAverageCache {
  const raw = readServiceCache("octo").monthlyAverages;
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

export function saveMonthlyAverageCache(cache: MonthlyAverageCache): void {
  updateServiceCache("octo", { monthlyAverages: cache });
}

function cachedFinishedMonthIsComplete(
  monthKey: string,
  cache: MonthlyAverageCache,
): boolean {
  const rec = cache[monthKey];
  if (!rec) return false;
  return rec.days >= daysInMonthKey(monthKey);
}

function shouldPersistFinishedMonthTotals(month: string, now: Date): boolean {
  const current = currentMonthKey(now);
  if (month >= current) return false;
  if (month === priorCalendarMonthKey(current) && isDeferredMonthlyStatsWindowUk(now)) {
    return false;
  }
  return true;
}

function monthNeedsMonthlyFetch(month: string, cache: MonthlyAverageCache): boolean {
  if (!cache[month]) return true;
  if (month === currentMonthKey(new Date())) return true;
  return !cachedFinishedMonthIsComplete(month, cache);
}

function evictUnsettledPriorMonthFromCache(
  cache: MonthlyAverageCache,
  now: Date,
): boolean {
  if (!isDeferredMonthlyStatsWindowUk(now)) return false;
  const prior = priorCalendarMonthKey(currentMonthKey(now));
  if (!cache[prior]) return false;
  delete cache[prior];
  return true;
}

export function monthlyAveragesFromDaily(
  eDaily: DailyTotals,
  gDaily: DailyTotals,
  eKwh: DailyTotals,
  gKwh: DailyTotals,
): MonthlyAverageCache {
  const dayKeys = new Set([
    ...Object.keys(eDaily),
    ...Object.keys(gDaily),
    ...Object.keys(eKwh),
    ...Object.keys(gKwh),
  ]);
  const sums: Record<
    string,
    { eCost: number; gCost: number; eKwh: number; gKwh: number; days: number }
  > = {};
  for (const dayKey of dayKeys) {
    const month = monthKeyFromDayKey(dayKey);
    sums[month] ||= { eCost: 0, gCost: 0, eKwh: 0, gKwh: 0, days: 0 };
    sums[month].eCost += eDaily[dayKey] || 0;
    sums[month].gCost += gDaily[dayKey] || 0;
    sums[month].eKwh += eKwh[dayKey] || 0;
    sums[month].gKwh += gKwh[dayKey] || 0;
    sums[month].days += 1;
  }
  const updatedAt = new Date().toISOString();
  const out: MonthlyAverageCache = {};
  for (const [month, sum] of Object.entries(sums)) {
    if (sum.days <= 0) continue;
    out[month] = {
      eCost: sum.eCost / sum.days,
      gCost: sum.gCost / sum.days,
      eKwh: sum.eKwh / sum.days,
      gKwh: sum.gKwh / sum.days,
      days: sum.days,
      updatedAt,
    };
  }
  return out;
}

async function fetchConsumptionForMeters(
  urls: string[],
  token: string,
): Promise<EnergyConsumption[]> {
  const pages = await Promise.all(
    urls.map((url) => fetchAllOctopusResults<EnergyConsumption>(url, token)),
  );
  return pages.flat();
}

function electricityConsumptionUrls(
  derived: TariffDerivation,
  from: Date,
  to: Date,
): string[] {
  return derived.electricityMeters.map(
    (meter) =>
      `${derived.electricityBaseUrl}/electricity-meter-points/${encodeURIComponent(meter.mpan)}` +
      `/meters/${encodeURIComponent(meter.serial)}/consumption/` +
      `?period_from=${encodeURIComponent(toIsoNoMs(from))}` +
      `&period_to=${encodeURIComponent(toIsoNoMs(to))}` +
      `&order_by=period`,
  );
}

function gasConsumptionUrls(
  derived: TariffDerivation,
  from: Date,
  to: Date,
): string[] {
  return derived.gasMeters.map(
    (meter) =>
      `${derived.gasBaseUrl}/gas-meter-points/${encodeURIComponent(meter.mprn)}` +
      `/meters/${encodeURIComponent(meter.serial)}/consumption/` +
      `?period_from=${encodeURIComponent(toIsoNoMs(from))}` +
      `&period_to=${encodeURIComponent(toIsoNoMs(to))}` +
      `&order_by=period`,
  );
}

/**
 * Load dual-supplier energy dashboard data (EDF electricity + Octopus gas),
 * updating daily/monthly caches along the way.
 */
export async function loadEnergyDashboardData(
  now: Date = new Date(),
): Promise<EnergyDashboardData> {
  await ensureOctoCacheLoaded();
  const { gasKwhPerUnit } = resolveOctoCredentials();
  const derived = await loadDualSupplierTariffs();

  const todayYmd = dayKeyUK(now);
  const tomorrowYmd = ukTomorrowYmd(now);
  const historyFrom = new Date(now.getTime() - 35 * DAY_MS);
  const billingDayKeys = dayKeysBackInclusive(now, DAILY_TOTALS_BILLING_LOOKBACK_DAYS);
  const displayDayKeys = dayKeysBackInclusive(now, DAILY_TOTALS_DISPLAY_DAYS);
  const dailyTotalsCache = readDailyTotalsCache(now);

  let eDaily: DailyTotals = {};
  let gDaily: DailyTotals = {};
  let eDailyKwh: DailyTotals = {};
  let gDailyKwh: DailyTotals = {};
  for (const [dayKey, totals] of Object.entries(dailyTotalsCache)) {
    eDaily[dayKey] = totals.eCost;
    gDaily[dayKey] = totals.gCost;
    eDailyKwh[dayKey] = totals.eKwh;
    gDailyKwh[dayKey] = totals.gKwh;
  }

  const liveBillingDayKeys = billingDayKeys.filter(
    (dayKey) =>
      displayDayKeys.includes(dayKey) ||
      !isDailyTotalsCacheableDay(dayKey, now) ||
      !dailyTotalsCache[dayKey],
  );

  const [electricityDual, gasRates, electricityStandingPence, gasStandingPence] =
    await Promise.all([
      loadElectricityDualRatesForDays([todayYmd, tomorrowYmd], now),
      loadGasRatesForDays([todayYmd, tomorrowYmd], now),
      fetchActiveStandingChargePence(
        derived.etariffStanding,
        derived.electricityToken,
        now,
      ),
      fetchActiveStandingChargePence(derived.gtariffStanding, derived.gasToken, now),
    ]);

  const electricityContractEnd = derived.etariff.valid_to ?? null;
  const gasContractEnd = derived.gtariff.valid_to ?? null;

  let eStandingResults: OctopusRate[] = [];
  let gStandingResults: OctopusRate[] = [];

  if (liveBillingDayKeys.length > 0) {
    const liveFromKey = liveBillingDayKeys[0];
    const liveToKey = liveBillingDayKeys[liveBillingDayKeys.length - 1];
    const liveFrom = ukDayStartFromKey(liveFromKey);
    const liveTo = new Date(ukDayStartFromKey(liveToKey).getTime() + DAY_MS);

    const eStandingUrl = ratesUrlWithWindow(derived.etariffStanding, liveFrom, liveTo);
    const gStandingUrl = ratesUrlWithWindow(derived.gtariffStanding, liveFrom, liveTo);
    const eConsumptionUrls = electricityConsumptionUrls(derived, liveFrom, liveTo);
    const gConsumptionUrls = gasConsumptionUrls(derived, liveFrom, liveTo);

    const [
      eDualLive,
      gUnitResults,
      eStanding,
      gStanding,
      eConsumptionResults,
      gConsumptionResults,
    ] = await Promise.all([
      fetchElectricityDualRates(liveFrom, liveTo),
      fetchGasRates(liveFrom, now),
      fetchAllOctopusResults<OctopusRate>(eStandingUrl, derived.electricityToken),
      fetchAllOctopusResults<OctopusRate>(gStandingUrl, derived.gasToken),
      fetchConsumptionForMeters(eConsumptionUrls, derived.electricityToken),
      fetchConsumptionForMeters(gConsumptionUrls, derived.gasToken),
    ]);
    eStandingResults = eStanding;
    gStandingResults = gStanding;

    const eStandingPence = standingChargePerDayPence(eStandingResults);
    const gStandingPence = standingChargePerDayPence(gStandingResults);

    const freshECost = aggregateDailyBilledPenceElectricity(
      eConsumptionResults,
      eDualLive,
      eStandingPence,
      {
        rateMode: derived.rateMode,
        offPeakStartHour: derived.offPeakStartHour,
        offPeakEndHour: derived.offPeakEndHour,
      },
    );
    const freshGCost = aggregateDailyBilledPenceGas(
      gConsumptionResults,
      gUnitResults,
      gStandingPence,
      gasKwhPerUnit,
    );
    const freshEKwh = aggregateDailyConsumedKwh(eConsumptionResults, 1);
    const freshGKwh = aggregateDailyConsumedKwh(gConsumptionResults, gasKwhPerUnit);

    applyFreshDailyTotals(
      liveBillingDayKeys,
      eDaily,
      gDaily,
      eDailyKwh,
      gDailyKwh,
      freshECost,
      freshGCost,
      freshEKwh,
      freshGKwh,
      dailyTotalsCache,
      now,
    );
  }

  const nextDailyTotalsCache: Record<string, DailyDayTotals> = { ...dailyTotalsCache };
  let dailyTotalsCacheDirty = false;
  for (const dayKey of billingDayKeys) {
    const record: DailyDayTotals = {
      eCost: eDaily[dayKey] || 0,
      gCost: gDaily[dayKey] || 0,
      eKwh: eDailyKwh[dayKey] || 0,
      gKwh: gDailyKwh[dayKey] || 0,
    };
    if (!record.eCost && !record.gCost && !record.eKwh && !record.gKwh) continue;
    const existing = nextDailyTotalsCache[dayKey];
    const toSave = isDailyTotalsCacheableDay(dayKey, now)
      ? record
      : preferMoreCompleteDayTotals(existing, record);
    if (
      !existing ||
      existing.eCost !== toSave.eCost ||
      existing.gCost !== toSave.gCost ||
      existing.eKwh !== toSave.eKwh ||
      existing.gKwh !== toSave.gKwh
    ) {
      nextDailyTotalsCache[dayKey] = toSave;
      dailyTotalsCacheDirty = true;
    }
  }
  if (dailyTotalsCacheDirty) {
    saveDailyTotalsCache(nextDailyTotalsCache);
  }

  const lastUkDayInAvg = latestUkDayKeyIncludedInMonthlyAverages(now);
  const historyMonths = monthKeysBackInclusive(now, ENERGY_MONTHLY_HISTORY_MONTHS);
  const monthlyCache = readMonthlyAverageCache();
  const unsettledPriorEvicted = evictUnsettledPriorMonthFromCache(monthlyCache, now);
  const monthlyForDisplay: MonthlyAverageCache = { ...monthlyCache };
  const cachedMonths = sortMonthKeysAsc(Object.keys(monthlyCache));
  const monthKeys = sortMonthKeysAsc(
    Array.from(new Set([...historyMonths, ...cachedMonths])),
  ).filter((m) => m >= historyMonths[0]);

  const missingMonths = historyMonths.filter((m) => monthNeedsMonthlyFetch(m, monthlyCache));

  let eMonthlyDaily = { ...eDaily };
  let gMonthlyDaily = { ...gDaily };
  let eMonthlyKwh = { ...eDailyKwh };
  let gMonthlyKwh = { ...gDailyKwh };

  if (missingMonths.length > 0) {
    const oldestMissing = missingMonths[0];
    const newestMissing = missingMonths[missingMonths.length - 1];
    const monthlyFrom = startOfMonthUtc(oldestMissing);
    const monthlyTo = startOfMonthUtc(nextMonthKey(newestMissing));
    const gapEnd = monthlyTo < historyFrom ? monthlyTo : historyFrom;
    if (monthlyFrom < gapEnd) {
      const eMonthlyDayUrl = ratesUrlWithWindow(derived.etariffDayPrices, monthlyFrom, gapEnd);
      const eMonthlyNightUrl = derived.etariffNightPrices
        ? ratesUrlWithWindow(derived.etariffNightPrices, monthlyFrom, gapEnd)
        : null;
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
      const eMonthlyConsumptionUrls = electricityConsumptionUrls(
        derived,
        monthlyFrom,
        gapEnd,
      );
      const gMonthlyConsumptionUrls = gasConsumptionUrls(derived, monthlyFrom, gapEnd);

      const [
        ePeakGap,
        eOffPeakGap,
        gGapRates,
        eGapStanding,
        gGapStanding,
        eGapConsumption,
        gGapConsumption,
      ] = await Promise.all([
        fetchAllOctopusResults<OctopusRate>(eMonthlyDayUrl, derived.electricityToken),
        eMonthlyNightUrl
          ? fetchAllOctopusResults<OctopusRate>(eMonthlyNightUrl, derived.electricityToken)
          : Promise.resolve([] as OctopusRate[]),
        fetchAllOctopusResults<OctopusRate>(gMonthlyHistoryUrl, derived.gasToken),
        fetchAllOctopusResults<OctopusRate>(eMonthlyStandingUrl, derived.electricityToken),
        fetchAllOctopusResults<OctopusRate>(gMonthlyStandingUrl, derived.gasToken),
        fetchConsumptionForMeters(eMonthlyConsumptionUrls, derived.electricityToken),
        fetchConsumptionForMeters(gMonthlyConsumptionUrls, derived.gasToken),
      ]);

      const eDualGap: ElectricityDualRates = { peak: ePeakGap, offPeak: eOffPeakGap };
      eMonthlyDaily = mergeDailyTotals(
        eMonthlyDaily,
        aggregateDailyBilledPenceElectricity(
          eGapConsumption,
          eDualGap,
          standingChargePerDayPence(eGapStanding),
          {
            rateMode: derived.rateMode,
            offPeakStartHour: derived.offPeakStartHour,
            offPeakEndHour: derived.offPeakEndHour,
          },
        ),
      );
      gMonthlyDaily = mergeDailyTotals(
        gMonthlyDaily,
        aggregateDailyBilledPenceGas(
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

  eMonthlyDaily = filterDailyTotalsThroughDayInclusive(eMonthlyDaily, lastUkDayInAvg);
  gMonthlyDaily = filterDailyTotalsThroughDayInclusive(gMonthlyDaily, lastUkDayInAvg);
  eMonthlyKwh = filterDailyTotalsThroughDayInclusive(eMonthlyKwh, lastUkDayInAvg);
  gMonthlyKwh = filterDailyTotalsThroughDayInclusive(gMonthlyKwh, lastUkDayInAvg);

  const computedMonthly = monthlyAveragesFromDaily(
    eMonthlyDaily,
    gMonthlyDaily,
    eMonthlyKwh,
    gMonthlyKwh,
  );
  for (const mk of Object.keys(computedMonthly)) {
    if (
      monthlyCache[mk] &&
      cachedFinishedMonthIsComplete(mk, monthlyCache) &&
      mk !== currentMonthKey(now)
    ) {
      continue;
    }
    monthlyForDisplay[mk] = computedMonthly[mk];
  }

  let monthlyCacheDirty = unsettledPriorEvicted;
  for (const [month, record] of Object.entries(computedMonthly)) {
    if (!shouldPersistFinishedMonthTotals(month, now)) continue;
    const existing = monthlyCache[month];
    if (
      !existing ||
      !cachedFinishedMonthIsComplete(month, monthlyCache) ||
      record.days > existing.days
    ) {
      monthlyCache[month] = record;
      monthlyCacheDirty = true;
    }
  }
  if (monthlyCacheDirty) {
    saveMonthlyAverageCache(monthlyCache);
  }

  return {
    derived,
    gasKwhPerUnit,
    todayYmd,
    tomorrowYmd,
    electricityDual,
    gasRates,
    electricityStandingPence,
    gasStandingPence,
    electricityContractEnd,
    gasContractEnd,
    eDailyCost: eDaily,
    gDailyCost: gDaily,
    eDailyKwh,
    gDailyKwh,
    displayDayKeys,
    monthlyCache,
    monthlyForDisplay,
    monthKeys,
    now,
  };
}

export function formatPence(value: number): string {
  return `${Math.round(value)}p`;
}

export function formatKwh(value: number): string {
  return `${value.toFixed(2)}kWh`;
}

export function formatPoundsFromPence(valuePence: number): string {
  return `£${(valuePence / 100).toFixed(2)}`;
}

export function formatAverageAndTotalCost(
  averagePence: number,
  totalPence: number,
  projectedPence?: number,
): string {
  const average = Math.round(averagePence);
  const totalPounds = Math.round(totalPence / 100);
  if (projectedPence === undefined) {
    return `${average}p (£${totalPounds})`;
  }
  const projectedPounds = Math.round(projectedPence / 100);
  return `${average}p (£${totalPounds} // £${projectedPounds})`;
}

export function monthLabel(monthKey: string): string {
  const d = startOfMonthUtc(monthKey);
  return d.toLocaleDateString("en-GB", {
    month: "short",
    year: "2-digit",
    timeZone: "Europe/London",
  });
}

export function dayLabelShort(dayKey: string): string {
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
  const capDay = weekday.charAt(0).toUpperCase() + weekday.slice(1).toLowerCase();
  return `${capDay} ${day}/${month}`;
}

export function rankedColorByDay(
  dayKeys: string[],
  totals: DailyTotals,
  fuel: "electricity" | "gas",
): Record<string, string> {
  const rankableDays = dayKeys.slice(0, Math.max(0, dayKeys.length - 2));
  const entries = rankableDays.map((day) => ({ day, value: totals[day] || 0 }));
  entries.sort((a, b) => a.value - b.value);

  const palette =
    fuel === "electricity"
      ? { low: ANSI_GREEN, mid: ANSI_ORANGE, high: ANSI_RED }
      : { low: ANSI_BRIGHT_GREEN, mid: ANSI_AMBER_GAS, high: ANSI_BRIGHT_RED };

  const map: Record<string, string> = {};
  const bucketSize = Math.max(1, Math.ceil(entries.length / 3));
  for (let i = 0; i < entries.length; i += 1) {
    const bucket =
      i < bucketSize ? palette.low : i < bucketSize * 2 ? palette.mid : palette.high;
    map[entries[i].day] = bucket;
  }
  return map;
}

export function coloredPence(
  value: number,
  color: string | undefined,
): string {
  return colorize(formatPence(value), color || ANSI_RESET);
}

export function previousMonthKey(now: Date): string {
  return priorCalendarMonthKey(currentMonthKey(now));
}

export function currentEnergyMonthKey(now: Date): string {
  return currentMonthKey(now);
}

export function energyDaysInMonthKey(monthKey: string): number {
  return daysInMonthKey(monthKey);
}
