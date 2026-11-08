import {
  ensureOctoCacheLoaded,
  flushServiceCache,
} from "./cache";
import {
  readMonthlyAverageCache,
  saveMonthlyAverageCache,
  type MonthlyAverageCache,
  type MonthlyAverages,
} from "./energyDashboard";

/**
 * Spreadsheet backfill for monthly energy averages.
 *
 * Columns from the sheet:
 * - elec kWh / gas kWh (month totals)
 * - optional elec/gas daily cost pence
 * - elec / gas month cost in £
 *
 * Cache stores daily averages (pence + kWh) plus day count.
 */
type BackfillRow = {
  month: string;
  eKwhTotal: number;
  gKwhTotal: number;
  ePounds: number;
  gPounds: number;
  /** Average daily electricity cost in pence, when known. */
  eCostDailyPence?: number;
  /** Average daily gas cost in pence, when known. */
  gCostDailyPence?: number;
};

const BACKFILL_ROWS: BackfillRow[] = [
  // Sep 2024 – Aug 2025 (totals only)
  { month: "2024-09", eKwhTotal: 324, gKwhTotal: 705, ePounds: 78, gPounds: 41 },
  { month: "2024-10", eKwhTotal: 396, gKwhTotal: 1455, ePounds: 99, gPounds: 83 },
  { month: "2024-11", eKwhTotal: 418, gKwhTotal: 2819, ePounds: 119, gPounds: 167 },
  { month: "2024-12", eKwhTotal: 441, gKwhTotal: 3092, ePounds: 120, gPounds: 181 },
  { month: "2025-01", eKwhTotal: 524, gKwhTotal: 4125, ePounds: 169, gPounds: 259 },
  { month: "2025-02", eKwhTotal: 358, gKwhTotal: 2836, ePounds: 113, gPounds: 192 },
  { month: "2025-03", eKwhTotal: 357, gKwhTotal: 2823, ePounds: 107, gPounds: 170 },
  { month: "2025-04", eKwhTotal: 310, gKwhTotal: 1208, ePounds: 76, gPounds: 70 },
  { month: "2025-05", eKwhTotal: 298, gKwhTotal: 426, ePounds: 68, gPounds: 29 },
  { month: "2025-06", eKwhTotal: 283, gKwhTotal: 267, ePounds: 65, gPounds: 22 },
  { month: "2025-07", eKwhTotal: 315, gKwhTotal: 253, ePounds: 77, gPounds: 21 },
  { month: "2025-08", eKwhTotal: 261, gKwhTotal: 242, ePounds: 62, gPounds: 20 },

  // Sep 2025 – Jul 2026 (daily cost pence + £ totals; ignore spreadsheet's constant 170 col)
  {
    month: "2025-09",
    eKwhTotal: 319,
    gKwhTotal: 482,
    eCostDailyPence: 241,
    gCostDailyPence: 114,
    ePounds: 72,
    gPounds: 32,
  },
  {
    month: "2025-10",
    eKwhTotal: 395,
    gKwhTotal: 984,
    eCostDailyPence: 286,
    gCostDailyPence: 193,
    ePounds: 88,
    gPounds: 56,
  },
  {
    month: "2025-11",
    eKwhTotal: 411,
    gKwhTotal: 2206,
    eCostDailyPence: 336,
    gCostDailyPence: 403,
    ePounds: 100,
    gPounds: 113,
  },
  {
    month: "2025-12",
    eKwhTotal: 429,
    gKwhTotal: 2863,
    eCostDailyPence: 323,
    gCostDailyPence: 478,
    ePounds: 100,
    gPounds: 138,
  },
  {
    month: "2026-01",
    eKwhTotal: 419,
    gKwhTotal: 3880,
    eCostDailyPence: 386,
    gCostDailyPence: 713,
    ePounds: 119,
    gPounds: 209,
  },
  {
    month: "2026-02",
    eKwhTotal: 297,
    gKwhTotal: 1829,
    eCostDailyPence: 267,
    gCostDailyPence: 376,
    ePounds: 74,
    gPounds: 105,
  },
  {
    month: "2026-03",
    eKwhTotal: 384,
    gKwhTotal: 2100,
    eCostDailyPence: 351,
    gCostDailyPence: 505,
    ePounds: 108,
    gPounds: 155,
  },
  {
    month: "2026-04",
    eKwhTotal: 382,
    gKwhTotal: 903,
    eCostDailyPence: 215,
    gCostDailyPence: 214,
    ePounds: 63,
    gPounds: 64,
  },
  {
    month: "2026-05",
    eKwhTotal: 296,
    gKwhTotal: 457,
    eCostDailyPence: 262,
    gCostDailyPence: 125,
    ePounds: 80,
    gPounds: 38,
  },
  {
    month: "2026-06",
    eKwhTotal: 339,
    gKwhTotal: 299,
    eCostDailyPence: 207,
    gCostDailyPence: 91,
    ePounds: 62,
    gPounds: 27,
  },
  {
    month: "2026-07",
    eKwhTotal: 287,
    gKwhTotal: 238,
    eCostDailyPence: 212,
    gCostDailyPence: 83,
    ePounds: 67,
    gPounds: 26,
  },
  // Aug 2026 — daily cost pence missing in sheet
  { month: "2026-08", eKwhTotal: 206, gKwhTotal: 198, ePounds: 71.5, gPounds: 25 },

  // Sep–Oct 2026 (totals only)
  { month: "2026-09", eKwhTotal: 341, gKwhTotal: 308, ePounds: 95, gPounds: 33 },
  { month: "2026-10", eKwhTotal: 344, gKwhTotal: 953, ePounds: 85, gPounds: 84 },
];

function daysInMonthKey(monthKey: string): number {
  const [yRaw, mRaw] = monthKey.split("-");
  const y = Number(yRaw);
  const m = Number(mRaw);
  return new Date(y, m, 0).getDate();
}

function rowToMonthlyAverages(row: BackfillRow, updatedAt: string): MonthlyAverages {
  const days = daysInMonthKey(row.month);
  const eCost =
    row.eCostDailyPence ?? (days > 0 ? (row.ePounds * 100) / days : 0);
  const gCost =
    row.gCostDailyPence ?? (days > 0 ? (row.gPounds * 100) / days : 0);
  return {
    eCost,
    gCost,
    eKwh: days > 0 ? row.eKwhTotal / days : 0,
    gKwh: days > 0 ? row.gKwhTotal / days : 0,
    days,
    updatedAt,
  };
}

export function buildEnergyMonthlyBackfill(
  updatedAt: string = new Date().toISOString(),
): MonthlyAverageCache {
  const out: MonthlyAverageCache = {};
  for (const row of BACKFILL_ROWS) {
    out[row.month] = rowToMonthlyAverages(row, updatedAt);
  }
  return out;
}

/**
 * Merge spreadsheet monthly totals into the octo monthlyAverages cache.
 * Existing months are overwritten by backfill values (authoritative history).
 */
export async function applyEnergyMonthlyBackfill(): Promise<{
  written: string[];
  totalMonths: number;
}> {
  await ensureOctoCacheLoaded();
  const cache = readMonthlyAverageCache();
  const backfill = buildEnergyMonthlyBackfill();
  const written = Object.keys(backfill).sort();
  for (const [month, record] of Object.entries(backfill)) {
    cache[month] = record;
  }
  saveMonthlyAverageCache(cache);
  await flushServiceCache("octo");
  return { written, totalMonths: Object.keys(cache).length };
}
