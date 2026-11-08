import { ensureOctoCacheLoaded, readServiceCache, updateServiceCache } from "./cache";
import type { MonthlyAverageCache } from "./energyDashboard";
import type { SolarMonthlyYieldRow } from "./solarMonthlyYield";

export type YearlySummaryRecord = {
  /** Calendar year, e.g. 2025. */
  year: number;
  eTotalPence: number;
  gTotalPence: number;
  eMonths: number;
  gMonths: number;
  solarTotalKwh: number | null;
  solarMonths: number;
  updatedAt: string;
};

export type YearlySummaryCache = Record<string, YearlySummaryRecord>;

export type YearlySummaryRow = {
  year: number;
  label: string;
  /** Average monthly gas cost (pence). */
  gAvgMonthlyPence: number | null;
  gTotalPence: number | null;
  gMonths: number;
  eAvgMonthlyPence: number | null;
  eTotalPence: number | null;
  eMonths: number;
  solarAvgMonthlyKwh: number | null;
  solarTotalKwh: number | null;
  solarMonths: number;
  cached: boolean;
};

function normalizeYearlyRecord(yearKey: string, value: unknown): YearlySummaryRecord | null {
  const year = Number(yearKey);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const rec = value as Record<string, unknown>;
  const eTotalPence = Number(rec.eTotalPence);
  const gTotalPence = Number(rec.gTotalPence);
  const eMonths = Number(rec.eMonths);
  const gMonths = Number(rec.gMonths);
  const solarMonths = Number(rec.solarMonths);
  const solarTotalRaw = rec.solarTotalKwh;
  const solarTotalKwh =
    solarTotalRaw == null || solarTotalRaw === ""
      ? null
      : Number(solarTotalRaw);
  if (
    !Number.isFinite(eTotalPence) ||
    !Number.isFinite(gTotalPence) ||
    !Number.isFinite(eMonths) ||
    !Number.isFinite(gMonths) ||
    !Number.isFinite(solarMonths) ||
    (solarTotalKwh != null && !Number.isFinite(solarTotalKwh))
  ) {
    return null;
  }
  return {
    year,
    eTotalPence,
    gTotalPence,
    eMonths,
    gMonths,
    solarTotalKwh,
    solarMonths,
    updatedAt: String(rec.updatedAt || ""),
  };
}

export function readYearlySummaryCache(): YearlySummaryCache {
  const raw = readServiceCache("octo").yearlyAverages;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const cache: YearlySummaryCache = {};
  for (const [key, value] of Object.entries(raw)) {
    const normalized = normalizeYearlyRecord(key, value);
    if (normalized) cache[key] = normalized;
  }
  return cache;
}

export function saveYearlySummaryCache(cache: YearlySummaryCache): void {
  updateServiceCache("octo", { yearlyAverages: cache });
}

function yearLabel(year: number): string {
  const yy = String(year).slice(-2);
  return `Jan-Dec ${yy}`;
}

function computeYearlyFromMonthly(
  monthlyEnergy: MonthlyAverageCache,
  monthlySolar: SolarMonthlyYieldRow[],
  now: Date,
): YearlySummaryCache {
  const currentYear = now.getFullYear();
  const energyByYear = new Map<
    number,
    { eTotal: number; gTotal: number; eMonths: number; gMonths: number }
  >();

  for (const [monthKey, rec] of Object.entries(monthlyEnergy)) {
    if (!/^\d{4}-\d{2}$/.test(monthKey)) continue;
    const year = Number(monthKey.slice(0, 4));
    if (year > currentYear) continue;
    const bucket = energyByYear.get(year) ?? {
      eTotal: 0,
      gTotal: 0,
      eMonths: 0,
      gMonths: 0,
    };
    const eMonthTotal = rec.eCost * rec.days;
    const gMonthTotal = rec.gCost * rec.days;
    if (eMonthTotal > 0 || rec.eKwh > 0) {
      bucket.eTotal += eMonthTotal;
      bucket.eMonths += 1;
    }
    if (gMonthTotal > 0 || rec.gKwh > 0) {
      bucket.gTotal += gMonthTotal;
      bucket.gMonths += 1;
    }
    energyByYear.set(year, bucket);
  }

  const solarByYear = new Map<number, { total: number; months: number }>();
  for (const row of monthlySolar) {
    const year = Number(row.month.slice(0, 4));
    if (!Number.isFinite(year) || year > currentYear) continue;
    if (row.total == null || row.total <= 0) continue;
    const bucket = solarByYear.get(year) ?? { total: 0, months: 0 };
    bucket.total += row.total;
    bucket.months += 1;
    solarByYear.set(year, bucket);
  }

  const years = new Set<number>([...energyByYear.keys(), ...solarByYear.keys()]);
  const updatedAt = new Date().toISOString();
  const out: YearlySummaryCache = {};
  for (const year of years) {
    const energy = energyByYear.get(year);
    const solar = solarByYear.get(year);
    out[String(year)] = {
      year,
      eTotalPence: energy?.eTotal ?? 0,
      gTotalPence: energy?.gTotal ?? 0,
      eMonths: energy?.eMonths ?? 0,
      gMonths: energy?.gMonths ?? 0,
      solarTotalKwh: solar ? solar.total : null,
      solarMonths: solar?.months ?? 0,
      updatedAt,
    };
  }
  return out;
}

function isFinishedYear(year: number, now: Date): boolean {
  return year < now.getFullYear();
}

function recordsEqual(a: YearlySummaryRecord, b: YearlySummaryRecord): boolean {
  return (
    a.eTotalPence === b.eTotalPence &&
    a.gTotalPence === b.gTotalPence &&
    a.eMonths === b.eMonths &&
    a.gMonths === b.gMonths &&
    a.solarTotalKwh === b.solarTotalKwh &&
    a.solarMonths === b.solarMonths
  );
}

function toRow(record: YearlySummaryRecord, cached: boolean): YearlySummaryRow {
  return {
    year: record.year,
    label: yearLabel(record.year),
    gAvgMonthlyPence:
      record.gMonths > 0 ? record.gTotalPence / record.gMonths : null,
    gTotalPence: record.gMonths > 0 ? record.gTotalPence : null,
    gMonths: record.gMonths,
    eAvgMonthlyPence:
      record.eMonths > 0 ? record.eTotalPence / record.eMonths : null,
    eTotalPence: record.eMonths > 0 ? record.eTotalPence : null,
    eMonths: record.eMonths,
    solarAvgMonthlyKwh:
      record.solarMonths > 0 && record.solarTotalKwh != null
        ? record.solarTotalKwh / record.solarMonths
        : null,
    solarTotalKwh: record.solarTotalKwh,
    solarMonths: record.solarMonths,
    cached,
  };
}

/**
 * Build yearly summary rows from monthly energy + solar data, updating the
 * remote/local yearly cache for finished years.
 */
export async function yearlySummaryRowsFromMonthly(
  monthlyEnergy: MonthlyAverageCache,
  monthlySolar: SolarMonthlyYieldRow[],
  now: Date = new Date(),
): Promise<YearlySummaryRow[]> {
  await ensureOctoCacheLoaded();
  const cache = readYearlySummaryCache();
  const computed = computeYearlyFromMonthly(monthlyEnergy, monthlySolar, now);
  let dirty = false;

  for (const [yearKey, record] of Object.entries(computed)) {
    const year = record.year;
    const existing = cache[yearKey];
    if (isFinishedYear(year, now)) {
      if (existing && recordsEqual(existing, record)) continue;
      // Prefer richer finished-year snapshots.
      if (
        existing &&
        existing.eMonths + existing.gMonths + existing.solarMonths >=
          record.eMonths + record.gMonths + record.solarMonths
      ) {
        continue;
      }
      cache[yearKey] = record;
      dirty = true;
      continue;
    }
    // Current year is always refreshed from live monthly data for display,
    // but still persisted so status/other runs see a provisional snapshot.
    if (!existing || !recordsEqual(existing, record)) {
      cache[yearKey] = record;
      dirty = true;
    }
  }

  if (dirty) {
    saveYearlySummaryCache(cache);
  }

  const years = Array.from(
    new Set([
      ...Object.keys(cache).map(Number),
      ...Object.keys(computed).map(Number),
    ]),
  )
    .filter((year) => Number.isFinite(year))
    .sort((a, b) => a - b);

  return years.map((year) => {
    const key = String(year);
    const cached = cache[key];
    const live = computed[key];
    if (year === now.getFullYear()) {
      const record = live ?? cached;
      return record ? toRow(record, Boolean(cached)) : toRow({
        year,
        eTotalPence: 0,
        gTotalPence: 0,
        eMonths: 0,
        gMonths: 0,
        solarTotalKwh: null,
        solarMonths: 0,
        updatedAt: "",
      }, false);
    }
    const record = cached ?? live;
    return record
      ? toRow(record, Boolean(cached))
      : toRow(
          {
            year,
            eTotalPence: 0,
            gTotalPence: 0,
            eMonths: 0,
            gMonths: 0,
            solarTotalKwh: null,
            solarMonths: 0,
            updatedAt: "",
          },
          false,
        );
  }).filter(
    (row) =>
      row.gTotalPence != null ||
      row.eTotalPence != null ||
      row.solarTotalKwh != null,
  );
}

export function formatYearlyMoneyCell(
  avgMonthlyPence: number | null,
  totalPence: number | null,
  months: number = 12,
): string {
  if (avgMonthlyPence == null || totalPence == null || months <= 0) return "-";
  const avgPounds = Math.round(avgMonthlyPence / 100);
  const totalPounds = Math.round(totalPence / 100);
  if (months >= 12) {
    return `£${avgPounds} (£${totalPounds})`;
  }
  const projectedPounds = Math.round((avgMonthlyPence * 12) / 100);
  return `£${avgPounds} (£${totalPounds} from ${months} months, projected to £${projectedPounds})`;
}

export function formatYearlySolarCell(
  avgMonthlyKwh: number | null,
  totalKwh: number | null,
  months: number = 12,
): string {
  if (avgMonthlyKwh == null || totalKwh == null || months <= 0) return "-";
  const totalText = `${totalKwh.toFixed(0)}kWh`;
  if (months >= 12) {
    return `${avgMonthlyKwh.toFixed(1)}kWh (${totalText})`;
  }
  const projected = avgMonthlyKwh * 12;
  return `${avgMonthlyKwh.toFixed(1)}kWh (${totalText} from ${months} months, projected to ${projected.toFixed(0)}kWh)`;
}
