import stripAnsi from "strip-ansi";
import stringWidth from "string-width";

import {
  formatColoredKwh,
  formatColoredWattsPrecise,
  formatKwh,
  formatUkHourLabel,
  latestUkDayKeyForSolarAverages,
  solarYieldTotalKwh,
  ukDayKeyMinusCalendarDays,
  ukHourStartMs,
  ukWallTimeToDate,
  parsePowerDateTimeKey,
  SOLAR_API_URL,
  getTodayEnergyData,
  type SolarResponse,
} from "./solarApi";
import {
  formatSolarMonthLabel,
  type SolarMonthlyYieldRow,
} from "./solarMonthlyYield";
import {
  coloredPence,
  currentEnergyMonthKey,
  energyDaysInMonthKey,
  formatKwh as formatEnergyKwh,
  formatPence,
  monthLabel as energyMonthLabel,
  rankedColorByDay,
  type EnergyDashboardData,
  type MonthlyAverageCache,
  type MonthlyAverages,
} from "./energyDashboard";
import {
  formatYearlyMoneyCell,
  formatYearlySolarCell,
  type YearlySummaryRow,
} from "./energyYearly";
import {
  ENERGY_MONTHLY_HISTORY_MONTHS,
  formatElectricityTariffDetailLines,
  formatGasTariffDetailLines,
  gasRatesForDay,
} from "./octoApi";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const DAILY_YIELD_DAYS = 28;
const AVERAGE_WINDOWS = [7, 14, 31] as const;
const POWER_HISTORY_HOURS = 48;
const HOURLY_SOLAR_LOOKBACK_30D = 30;
const HOURLY_SOLAR_LOOKBACK_90D = 90;
const POWER_CHART_MIN_W = 0;
const POWER_CHART_MAX_W = 800;
const POWER_CHART_STEP_W = 50;
const POWER_CHART_HEIGHT =
  (POWER_CHART_MAX_W - POWER_CHART_MIN_W) / POWER_CHART_STEP_W + 1;
const CHART_POINT = "●";
const UK_TZ = "Europe/London";
const ANSI_RESET = "\x1b[0m";
const ANSI_GREEN = "\x1b[32m";
const ANSI_YELLOW = "\x1b[33m";
const ANSI_ORANGE = "\x1b[38;5;208m";
const ANSI_RED = "\x1b[31m";

type DailyYield = {
  date: string;
  value: number;
};

type PowerReading = {
  time: number;
  value: number;
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

function toYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function dayKeyUK(date: Date = new Date()): string {
  return date.toLocaleDateString("en-CA", { timeZone: UK_TZ });
}

function subtractDayKey(dayKey: string, days: number): string {
  const [year, month, day] = dayKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - days);
  return toYmd(date);
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

type HourlyData = {
  time: number;
  power: number | null;
  soc: number | null;
};

function normalizeSOCAvgReadings(data: SolarResponse): Map<number, number> {
  const socByHour = new Map<number, number>();

  for (const [key, value] of Object.entries(data.socAvg)) {
    const parsed = parsePowerDateTimeKey(key);
    if (parsed && Number.isFinite(value)) {
      const hourStart = startOfUkHour(parsed.getTime());
      socByHour.set(hourStart, value);
    }
  }

  return socByHour;
}

function socReadingsFromMap(socByHour: Map<number, number>): PowerReading[] {
  return [...socByHour.entries()]
    .map(([time, value]) => ({ time, value }))
    .sort((a, b) => a.time - b.time);
}

type HourSlotStats = Map<number, { sum: number; count: number }>;

function ukHourOfDayFromMs(ms: number): number {
  return Number(
    new Date(ms).toLocaleTimeString("en-GB", {
      hour: "numeric",
      hour12: false,
      timeZone: UK_TZ,
    }),
  );
}

function isDayKeyWithinLookback(dayKey: string, todayKey: string, lookbackDays: number): boolean {
  const cutoff = ukDayKeyMinusCalendarDays(todayKey, lookbackDays - 1);
  return dayKey >= cutoff && dayKey <= todayKey;
}

function buildHourSlotStats(readings: PowerReading[], lookbackDays: number, todayKey: string): HourSlotStats {
  const stats: HourSlotStats = new Map();
  for (const reading of readings) {
    const dayKey = dayKeyUK(new Date(reading.time));
    if (!isDayKeyWithinLookback(dayKey, todayKey, lookbackDays)) continue;
    const hour = ukHourOfDayFromMs(reading.time);
    const prev = stats.get(hour) ?? { sum: 0, count: 0 };
    stats.set(hour, { sum: prev.sum + reading.value, count: prev.count + 1 });
  }
  return stats;
}

function averageForHourSlot(stats: HourSlotStats, hourOfDay: number): number | null {
  const bucket = stats.get(hourOfDay);
  if (!bucket || bucket.count === 0) return null;
  return bucket.sum / bucket.count;
}

function formatSocAvgPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function buildHourlyDataSeries(
  powerReadings: PowerReading[],
  socByHour: Map<number, number>,
): HourlyData[] {
  const latestHour = startOfUkHour(Date.now());
  const firstHour = latestHour - (POWER_HISTORY_HOURS - 1) * HOUR_MS;
  
  const powerBuckets = Array.from({ length: POWER_HISTORY_HOURS }, () => [] as number[]);
  
  for (const reading of powerReadings) {
    const hour = startOfUkHour(reading.time);
    const index = Math.floor((hour - firstHour) / HOUR_MS);
    if (index >= 0 && index < powerBuckets.length) {
      powerBuckets[index].push(reading.value);
    }
  }
  
  const hourlyData: HourlyData[] = [];
  for (let i = 0; i < POWER_HISTORY_HOURS; i += 1) {
    const time = firstHour + i * HOUR_MS;
    const powerBucket = powerBuckets[i];
    const power =
      powerBucket.length > 0
        ? powerBucket.reduce((sum, v) => sum + v, 0) / powerBucket.length
        : null;
    const soc = socByHour.get(time) ?? null;
    hourlyData.push({ time, power, soc });
  }
  
  return hourlyData;
}

function colorForSOCChange(change: number): string {
  if (change > 5) return ANSI_GREEN;
  if (change > 0) return ANSI_YELLOW;
  if (change > -5) return ANSI_ORANGE;
  return ANSI_RED;
}

function formatSOCChangeArrow(change: number): string {
  if (change < 0) return "↓";
  if (change > 0) return "↑";
  return "→";
}

function formatSOCWithChange(soc: number, prevSOC: number | null): string {
  if (prevSOC == null) return `${soc}%`;
  const change = soc - prevSOC;
  const changeStr = `${formatSOCChangeArrow(change)}${Math.abs(change).toFixed(1)}`;
  return colorize(`${soc}% ${changeStr}`, colorForSOCChange(change));
}

function renderHourlyTable(powerReadings: PowerReading[], socByHour: Map<number, number>): string[] {
  const hourlyData = buildHourlyDataSeries(powerReadings, socByHour);
  const todayKey = dayKeyUK();
  const solarStats30 = buildHourSlotStats(powerReadings, HOURLY_SOLAR_LOOKBACK_30D, todayKey);
  const solarStats90 = buildHourSlotStats(powerReadings, HOURLY_SOLAR_LOOKBACK_90D, todayKey);
  const socReadings = socReadingsFromMap(socByHour);
  const socStats30 = buildHourSlotStats(socReadings, HOURLY_SOLAR_LOOKBACK_30D, todayKey);
  const socStats90 = buildHourSlotStats(socReadings, HOURLY_SOLAR_LOOKBACK_90D, todayKey);

  if (hourlyData.length === 0) {
    return [`No hourly data available for the last ${POWER_HISTORY_HOURS} hours.`];
  }

  const rows: string[][] = [];
  let prevSOC: number | null = null;

  for (const hour of hourlyData) {
    const hourOfDay = ukHourOfDayFromMs(hour.time);
    const solar30 = averageForHourSlot(solarStats30, hourOfDay);
    const solar90 = averageForHourSlot(solarStats90, hourOfDay);
    const soc30 = averageForHourSlot(socStats30, hourOfDay);
    const soc90 = averageForHourSlot(socStats90, hourOfDay);

    const timeStr = formatHourLabel(hour.time);
    const powerStr = hour.power == null ? "-" : formatColoredWattsPrecise(hour.power);
    const solar30Str = solar30 == null ? "-" : formatColoredWattsPrecise(solar30);
    const solar90Str = solar90 == null ? "-" : formatColoredWattsPrecise(solar90);
    const socStr = hour.soc == null ? "-" : formatSOCWithChange(hour.soc, prevSOC);
    const soc30Str = soc30 == null ? "-" : formatSocAvgPercent(soc30);
    const soc90Str = soc90 == null ? "-" : formatSocAvgPercent(soc90);

    rows.push([timeStr, powerStr, solar30Str, solar90Str, socStr, soc30Str, soc90Str]);

    if (hour.soc != null) {
      prevSOC = hour.soc;
    }
  }

  return makeAsciiTable(
    ["Time", "☀", "☀ 30d", "☀ 90d", "🔋", "🔋 30d", "🔋 90d"],
    rows,
  );
}

function startOfUkHour(ms: number): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: UK_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(new Date(ms));
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  return ukWallTimeToDate(year, month, day, hour, 0).getTime();
}

function formatDateLabel(ymd: string): string {
  const date = parseDateKey(ymd);
  if (!date) return ymd;
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  });
}

function formatHourLabel(ms: number): string {
  return new Date(ms).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: UK_TZ,
  });
}

function formatWatts(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}kW`;
  return `${Math.round(value)}W`;
}

function shouldUseColor(): boolean {
  return Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
}

function colorize(text: string, color: string): string {
  if (!shouldUseColor()) return text;
  return `${color}${text}${ANSI_RESET}`;
}

function colorForPower(watts: number): string {
  if (watts > 400) return ANSI_GREEN;
  if (watts > 200) return ANSI_YELLOW;
  if (watts > 100) return ANSI_ORANGE;
  return ANSI_RED;
}

function formatColoredPowerPoint(value: number): string {
  return `${colorize(CHART_POINT, colorForPower(value))} `;
}

function visibleLength(value: string): number {
  return stringWidth(stripAnsi(value));
}

function padCell(value: string, width: number): string {
  return value + " ".repeat(Math.max(0, width - visibleLength(value)));
}

function makeAsciiTable(headers: string[], rows: string[][]): string[] {
  const widths = headers.map((header, idx) =>
    Math.max(
      visibleLength(header),
      ...rows.map((row) => visibleLength(row[idx] || "")),
    ),
  );
  const border = `+-${widths.map((width) => "-".repeat(width)).join("-+-")}-+`;
  const headerLine = `| ${headers.map((header, idx) => padCell(header, widths[idx])).join(" | ")} |`;
  const body = rows.map(
    (row) => `| ${row.map((value, idx) => padCell(value || "", widths[idx])).join(" | ")} |`,
  );
  return [border, headerLine, border, ...body, border];
}

function normalizeDailyYield(data: SolarResponse): DailyYield[] {
  return Object.entries(data.yield)
    .map(([date, value]) => ({ date, value }))
    .filter((entry) => parseDateKey(entry.date) && Number.isFinite(entry.value))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function normalizePowerAvgReadings(data: SolarResponse): PowerReading[] {
  return Object.entries(data.powerAvg)
    .map(([key, value]) => {
      const parsed = parsePowerDateTimeKey(key);
      return parsed && Number.isFinite(value) ? { time: parsed.getTime(), value } : null;
    })
    .filter((entry): entry is PowerReading => entry != null)
    .sort((a, b) => a.time - b.time);
}

function normalizePowerNow(data: SolarResponse): number | null {
  const value = data.powerNow?.value;
  return value != null && Number.isFinite(value) ? value : null;
}

export type YieldAverage = {
  days: number;
  average: number | null;
  samples: number;
};

function joinAsciiTables(left: string[], right: string[], gap = 3): string[] {
  const gapStr = " ".repeat(gap);
  const maxLeft = left.reduce((max, line) => Math.max(max, visibleLength(line)), 0);
  const rows = Math.max(left.length, right.length);
  return Array.from({ length: rows }, (_, index) => {
    const leftLine = left[index] ?? "";
    const rightLine = right[index] ?? "";
    const padding = maxLeft - visibleLength(leftLine);
    return `${leftLine}${" ".repeat(padding)}${gapStr}${rightLine}`;
  });
}
function buildPowerRows(powerNow: number | null, powerAvgReadings: PowerReading[]): string[][] {
  const latestAvg = powerAvgReadings.at(-1);
  return [
    ["Now", powerNow == null ? "-" : formatColoredWattsPrecise(powerNow)],
    [
      latestAvg ? `Avg ${formatHourLabel(latestAvg.time)}` : "Latest avg",
      latestAvg == null ? "-" : formatColoredWattsPrecise(latestAvg.value),
    ],
  ];
}

function latestYieldDay(yields: DailyYield[]): Date {
  const latest = yields.at(-1);
  return latest ? parseDateKey(latest.date) ?? startOfUtcDay(new Date()) : startOfUtcDay(new Date());
}

function dailyWindowKeys(yields: DailyYield[]): string[] {
  const end = latestYieldDay(yields);
  const start = new Date(end.getTime() - (DAILY_YIELD_DAYS - 1) * DAY_MS);
  return Array.from({ length: DAILY_YIELD_DAYS }, (_, offset) =>
    toYmd(new Date(start.getTime() + offset * DAY_MS)),
  );
}

function buildDailySolarRows(yields: DailyYield[]): string[][] {
  const byDate = new Map(yields.map((entry) => [entry.date, entry.value] as const));
  return dailyWindowKeys(yields).map((ymd) => {
    const value = byDate.get(ymd);
    return [formatDateLabel(ymd), value == null ? "-" : formatColoredKwh(value)];
  });
}

function buildDailyEnergyRows(
  yields: DailyYield[],
  energy: EnergyDashboardData,
): string[][] {
  const dayKeys = dailyWindowKeys(yields);
  const eCost = energy.eDailyCost;
  const gCost = energy.gDailyCost;
  const eKwh = energy.eDailyKwh;
  const gKwh = energy.gDailyKwh;
  const eColorByDay = rankedColorByDay(dayKeys, eCost, "electricity");
  const gColorByDay = rankedColorByDay(dayKeys, gCost, "gas");

  return dayKeys.map((ymd) => {
    const hasEnergy =
      (eCost[ymd] || 0) > 0 ||
      (gCost[ymd] || 0) > 0 ||
      (eKwh[ymd] || 0) > 0 ||
      (gKwh[ymd] || 0) > 0;
    if (!hasEnergy) {
      return [formatDateLabel(ymd), "-", "-", "-", "-", "-"];
    }
    return [
      formatDateLabel(ymd),
      coloredPence(eCost[ymd] || 0, eColorByDay[ymd]),
      coloredPence(gCost[ymd] || 0, gColorByDay[ymd]),
      formatPence((eCost[ymd] || 0) + (gCost[ymd] || 0)),
      formatEnergyKwh(eKwh[ymd] || 0),
      formatEnergyKwh(gKwh[ymd] || 0),
    ];
  });
}

function yieldAveragesFromYields(yields: DailyYield[], now: Date = new Date()): YieldAverage[] {
  const byDate = new Map(yields.map((entry) => [entry.date, entry.value] as const));
  const latestKey = latestUkDayKeyForSolarAverages(now);

  return AVERAGE_WINDOWS.map((days) => {
    const values: number[] = [];
    for (let back = 0; back < days; back += 1) {
      const value = byDate.get(ukDayKeyMinusCalendarDays(latestKey, back));
      if (value != null && value > 0) values.push(value);
    }
    const average =
      values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
    return { days, average, samples: values.length };
  });
}

export function yieldAveragesFromData(data: SolarResponse, now: Date = new Date()): YieldAverage[] {
  return yieldAveragesFromYields(normalizeDailyYield(data), now);
}

function buildAverageRows(yields: DailyYield[]): string[][] {
  return yieldAveragesFromYields(yields).map(({ days, average, samples }) => [
    `${days} days`,
    average == null ? "-" : formatColoredKwh(average),
    `${samples}/${days}`,
  ]);
}

function buildEnergyStatsRows(data: SolarResponse): string[][] {
  const today = dayKeyUK();
  const energyData = getTodayEnergyData(data, today);
  
  if (!energyData) return [];
  
  const rows: string[][] = [];
  
  if (energyData.home != null) {
    rows.push(["House Usage", formatKwh(energyData.home)]);
  }
  
  if (energyData.homeFromSolar != null) {
    rows.push(["From Solar", formatKwh(energyData.homeFromSolar)]);
  }
  
  if (energyData.homeFromBattery != null) {
    rows.push(["From Battery", formatKwh(energyData.homeFromBattery)]);
  }
  
  if (energyData.homeFromGrid != null) {
    rows.push(["From Grid", formatKwh(energyData.homeFromGrid)]);
  }
  
  return rows;
}

function buildBatteryStatsRows(data: SolarResponse): string[][] {
  const today = dayKeyUK();
  const energyData = getTodayEnergyData(data, today);
  
  if (!energyData) return [];
  
  const rows: string[][] = [];
  
  if (energyData.batteryCharged != null) {
    rows.push(["Charged", formatColoredKwh(energyData.batteryCharged)]);
  }
  
  if (energyData.batteryDischarged != null) {
    rows.push(["Discharged", formatColoredKwh(energyData.batteryDischarged)]);
  }
  
  if (energyData.batteryCharged != null && energyData.batteryDischarged != null) {
    const net = energyData.batteryCharged - energyData.batteryDischarged;
    const sign = net >= 0 ? "+" : "";
    rows.push(["Net", `${sign}${formatKwh(net)}`]);
  }
  
  return rows;
}

function buildGridStatsRows(data: SolarResponse): string[][] {
  const today = dayKeyUK();
  const energyData = getTodayEnergyData(data, today);
  
  if (!energyData) return [];
  
  const rows: string[][] = [];
  
  if (energyData.gridSold != null) {
    rows.push(["Sold to Grid", formatColoredKwh(energyData.gridSold)]);
  }
  
  if (energyData.gridBought != null) {
    rows.push(["Bought from Grid", formatKwh(energyData.gridBought)]);
  }
  
  return rows;
}

function buildSystemStatsRows(data: SolarResponse): string[][] {
  const status = data.status;
  
  if (!status) return [];
  
  const rows: string[][] = [];
  
  if (status.battery?.soc != null) {
    rows.push(["Battery SOC", `${status.battery.soc}%`]);
  }
  
  if (status.temperature != null) {
    const unit = status.temperatureUnit || "°C";
    rows.push(["Temperature", `${status.temperature}${unit}`]);
  }
  
  if (status.efficiency != null) {
    rows.push(["Efficiency", `${status.efficiency}%`]);
  }
  
  if (status.gridFrequency != null) {
    rows.push(["Grid Freq", `${status.gridFrequency.toFixed(2)} Hz`]);
  }
  
  return rows;
}

/** Daily average pence with month total pounds, e.g. `112p (£42)`. */
function formatDailyAvgAndMonthTotal(dailyAvgPence: number, days: number): string {
  const monthTotalPounds = Math.round((dailyAvgPence * days) / 100);
  return `${formatPence(dailyAvgPence)} (£${monthTotalPounds})`;
}

function buildMonthlySolarRows(
  monthlyYields: SolarMonthlyYieldRow[],
  solarYieldTotal: number | null = null,
): string[][] {
  const rows = monthlyYields.map((row) => [
    formatSolarMonthLabel(row.month),
    row.average == null ? "-" : formatColoredKwh(row.average),
    row.total == null ? "-" : formatKwh(row.total),
    row.days > 0 ? `${row.days}/${row.daysInMonth}` : "-",
  ]);
  if (solarYieldTotal != null) {
    rows.push(["Total", "-", formatKwh(solarYieldTotal), "-"]);
  }
  return rows;
}

function monthProjLabel(monthKey: string): string {
  const shortMonth = energyMonthLabel(monthKey).split(/\s+/)[0] || monthKey;
  return `${shortMonth} proj`;
}

/** Lower is better: best 6 green, next 6 yellow, next 6 orange, worst 6 red (for 24 rows). */
function rankedColorByValue(values: number[]): Map<number, string> {
  const indexed = values.map((value, index) => ({ value, index }));
  indexed.sort((a, b) => a.value - b.value || a.index - b.index);

  const n = indexed.length;
  const greenCount = Math.min(6, n);
  const redCount = Math.min(6, Math.max(0, n - greenCount));
  const middleCount = Math.max(0, n - greenCount - redCount);
  const yellowCount = Math.ceil(middleCount / 2);

  const colors = new Map<number, string>();
  for (let rank = 0; rank < n; rank += 1) {
    let color = ANSI_RED;
    if (rank < greenCount) color = ANSI_GREEN;
    else if (rank < greenCount + yellowCount) color = ANSI_YELLOW;
    else if (rank < greenCount + middleCount) color = ANSI_ORANGE;
    colors.set(indexed[rank].index, color);
  }
  return colors;
}

function buildMonthlyEnergyRows(
  energyMonthly: MonthlyAverageCache,
  monthKeys?: string[],
  now: Date = new Date(),
): string[][] {
  const keys = (monthKeys ?? Object.keys(energyMonthly))
    .filter((month) => energyMonthly[month])
    .sort((a, b) => a.localeCompare(b));

  const currentMonth = currentEnergyMonthKey(now);
  const current = energyMonthly[currentMonth];
  const daysInMonth = current ? energyDaysInMonthKey(currentMonth) : 0;
  const showCurrentProj =
    Boolean(current) &&
    keys.includes(currentMonth) &&
    current!.days > 0 &&
    current!.days < daysInMonth;

  // Rank all months (proj reuses current daily averages); incomplete actual stays uncoloured.
  const eCostColors = rankedColorByValue(keys.map((m) => energyMonthly[m].eCost));
  const gCostColors = rankedColorByValue(keys.map((m) => energyMonthly[m].gCost));
  const totalColors = rankedColorByValue(
    keys.map((m) => energyMonthly[m].eCost + energyMonthly[m].gCost),
  );
  const eKwhColors = rankedColorByValue(keys.map((m) => energyMonthly[m].eKwh));
  const gKwhColors = rankedColorByValue(keys.map((m) => energyMonthly[m].gKwh));

  const rows = keys.map((month, index) => {
    const energy: MonthlyAverages = energyMonthly[month];
    const totalDaily = energy.eCost + energy.gCost;
    const cost = formatDailyAvgAndMonthTotal(energy.eCost, energy.days);
    const gas = formatDailyAvgAndMonthTotal(energy.gCost, energy.days);
    const total = formatDailyAvgAndMonthTotal(totalDaily, energy.days);
    const eKwh = formatEnergyKwh(energy.eKwh);
    const gKwh = formatEnergyKwh(energy.gKwh);
    const skipColor = showCurrentProj && month === currentMonth;
    return [
      energyMonthLabel(month),
      skipColor ? cost : colorize(cost, eCostColors.get(index)!),
      skipColor ? gas : colorize(gas, gCostColors.get(index)!),
      skipColor ? total : colorize(total, totalColors.get(index)!),
      skipColor ? eKwh : colorize(eKwh, eKwhColors.get(index)!),
      skipColor ? gKwh : colorize(gKwh, gKwhColors.get(index)!),
      `${energy.days}`,
    ];
  });

  if (showCurrentProj && current) {
    const totalDaily = current.eCost + current.gCost;
    const colorIndex = keys.indexOf(currentMonth);
    rows.push([
      monthProjLabel(currentMonth),
      colorize(
        formatDailyAvgAndMonthTotal(current.eCost, daysInMonth),
        eCostColors.get(colorIndex)!,
      ),
      colorize(
        formatDailyAvgAndMonthTotal(current.gCost, daysInMonth),
        gCostColors.get(colorIndex)!,
      ),
      colorize(
        formatDailyAvgAndMonthTotal(totalDaily, daysInMonth),
        totalColors.get(colorIndex)!,
      ),
      colorize(formatEnergyKwh(current.eKwh), eKwhColors.get(colorIndex)!),
      colorize(formatEnergyKwh(current.gKwh), gKwhColors.get(colorIndex)!),
      `${daysInMonth}`,
    ]);
  }

  return rows;
}

function buildHourlyPowerSeries(readings: PowerReading[]): {
  firstHour: number;
  series: Array<number | null>;
} {
  const latestHour = startOfUkHour(Date.now());
  const firstHour = latestHour - (POWER_HISTORY_HOURS - 1) * HOUR_MS;
  const buckets = Array.from({ length: POWER_HISTORY_HOURS }, () => [] as number[]);

  for (const reading of readings) {
    const hour = startOfUkHour(reading.time);
    const index = Math.floor((hour - firstHour) / HOUR_MS);
    if (index < 0 || index >= buckets.length) continue;
    buckets[index].push(reading.value);
  }

  return {
    firstHour,
    series: buckets.map((bucket) =>
      bucket.length > 0 ? bucket.reduce((sum, value) => sum + value, 0) / bucket.length : null,
    ),
  };
}

function powerRowForValue(value: number): number {
  const clamped = Math.max(POWER_CHART_MIN_W, Math.min(POWER_CHART_MAX_W, value));
  return Math.max(
    0,
    Math.min(
      POWER_CHART_HEIGHT - 1,
      Math.round((POWER_CHART_MAX_W - clamped) / POWER_CHART_STEP_W),
    ),
  );
}

const POWER_GRAPH_LABEL_PREFIX_WIDTH = 8;
const POWER_GRAPH_COLUMN_WIDTH = 2;

function maxPowerGraphColumns(maxLineWidth?: number): number {
  if (maxLineWidth == null) return POWER_HISTORY_HOURS;
  return Math.max(
    1,
    Math.floor((maxLineWidth - POWER_GRAPH_LABEL_PREFIX_WIDTH) / POWER_GRAPH_COLUMN_WIDTH),
  );
}

function renderPowerGraph(readings: PowerReading[], maxLineWidth?: number): string[] {
  const { firstHour, series } = buildHourlyPowerSeries(readings);
  const values = series.filter((value): value is number => value != null);
  if (values.length === 0) {
    return [`No power readings in the last ${POWER_HISTORY_HOURS} available hours.`];
  }

  const maxColumns = maxPowerGraphColumns(maxLineWidth);
  const startCol = Math.max(0, series.length - maxColumns);
  const displaySeries = series.slice(startCol);
  const displayFirstHour = firstHour + startCol * HOUR_MS;

  const grid = Array.from({ length: POWER_CHART_HEIGHT }, () =>
    Array.from({ length: displaySeries.length }, () => "  "),
  );

  for (let col = 0; col < displaySeries.length; col += 1) {
    const value = displaySeries[col];
    if (value == null) continue;
    grid[powerRowForValue(value)][col] = formatColoredPowerPoint(value);
  }

  const lines: string[] = [];
  for (let row = 0; row < POWER_CHART_HEIGHT; row += 1) {
    const labelValue = POWER_CHART_MAX_W - row * POWER_CHART_STEP_W;
    lines.push(`${formatWatts(labelValue).padStart(6)} |${grid[row].join("")}`);
  }

  lines.push(`       +${"-".repeat(displaySeries.length * 2)}`);
  const labelChars = Array(displaySeries.length * 2).fill(" ");
  for (let col = 0; col < displaySeries.length; col += 6) {
    const label = formatHourLabel(displayFirstHour + col * HOUR_MS);
    const pos = col * 2;
    for (let idx = 0; idx < label.length && pos + idx < labelChars.length; idx += 1) {
      labelChars[pos + idx] = label[idx] || " ";
    }
  }
  lines.push(`        ${labelChars.join("")}`);
  return lines;
}

function sectionHeading(title: string): string[] {
  return ["", `=== ${title} ===`, ""];
}

function pushSection(lines: string[], title: string, body: string[]): void {
  if (body.length === 0) return;
  lines.push(...sectionHeading(title));
  lines.push(...body);
}

function buildTariffSummaryLines(energy: EnergyDashboardData): string[] {
  const todayElec = {
    peak: gasRatesForDay(energy.electricityDual.peak, energy.todayYmd),
    offPeak: gasRatesForDay(energy.electricityDual.offPeak, energy.todayYmd),
  };
  const tomorrowElec = {
    peak: gasRatesForDay(energy.electricityDual.peak, energy.tomorrowYmd),
    offPeak: gasRatesForDay(energy.electricityDual.offPeak, energy.tomorrowYmd),
  };
  const lines = [
    ...formatElectricityTariffDetailLines({
      tariffCode: energy.derived.etariff.tariff_code || "?",
      rateMode: energy.derived.rateMode,
      today: todayElec,
      tomorrow: tomorrowElec,
      standingPence: energy.electricityStandingPence,
      contractEnd: energy.electricityContractEnd,
    }).map((line) => `- ${line}`),
  ];
  if (energy.derived.rateMode === "eco7") {
    lines.push(
      `- Elec off-peak hours (UK): ${energy.derived.offPeakStartHour}:00 -> ${energy.derived.offPeakEndHour}:00`,
    );
  }
  lines.push(
    ...formatGasTariffDetailLines({
      tariffCode: energy.derived.gtariff.tariff_code || "?",
      today: gasRatesForDay(energy.gasRates, energy.todayYmd),
      tomorrow: gasRatesForDay(energy.gasRates, energy.tomorrowYmd),
      standingPence: energy.gasStandingPence,
      contractEnd: energy.gasContractEnd,
    }).map((line) => `- ${line}`),
    `- Gas conversion: ${energy.gasKwhPerUnit} kWh/unit`,
  );
  return lines;
}

function buildTodaySectionLines(
  data: SolarResponse,
  powerNow: number | null,
  powerAvgReadings: PowerReading[],
  yields: DailyYield[],
): string[] {
  const lines: string[] = [
    ...joinAsciiTables(
      makeAsciiTable(["", "W"], buildPowerRows(powerNow, powerAvgReadings)),
      makeAsciiTable(["Window", "Average", "Days"], buildAverageRows(yields)),
    ),
  ];

  const energyStatsRows = buildEnergyStatsRows(data);
  const batteryStatsRows = buildBatteryStatsRows(data);
  const gridStatsRows = buildGridStatsRows(data);
  const systemStatsRows = buildSystemStatsRows(data);
  const paired: string[][] = [];

  if (energyStatsRows.length > 0) {
    paired.push(makeAsciiTable(["House", "kWh"], energyStatsRows));
  }
  if (batteryStatsRows.length > 0) {
    paired.push(makeAsciiTable(["Battery", "kWh"], batteryStatsRows));
  }
  if (gridStatsRows.length > 0) {
    paired.push(makeAsciiTable(["Grid", "kWh"], gridStatsRows));
  }
  if (systemStatsRows.length > 0) {
    paired.push(makeAsciiTable(["System", ""], systemStatsRows));
  }

  if (paired.length > 0) {
    lines.push("");
    for (let i = 0; i < paired.length; i += 2) {
      const left = paired[i];
      const right = paired[i + 1];
      if (right) {
        lines.push(...joinAsciiTables(left, right));
      } else {
        lines.push(...left);
      }
      if (i + 2 < paired.length) lines.push("");
    }
  }

  return lines;
}

function buildDailySectionLines(
  yields: DailyYield[],
  energy: EnergyDashboardData | null,
): string[] {
  const lines: string[] = [
    `Solar (last ${DAILY_YIELD_DAYS} days)`,
    ...makeAsciiTable(["Date", "Yield"], buildDailySolarRows(yields)),
  ];
  if (energy) {
    lines.push(
      "",
      `Energy (last ${DAILY_YIELD_DAYS} days)`,
      ...makeAsciiTable(
        ["Date", "⚡", "Gas", "Total", "⚡ kWh", "Gas kWh"],
        buildDailyEnergyRows(yields, energy),
      ),
    );
  }
  return lines;
}

/** Drop ⚡ kWh / Gas kWh columns (indices 4 and 5) for narrow terminals. */
function withoutMonthlyEnergyKwhColumns(rows: string[][]): string[][] {
  return rows.map((row) => [row[0], row[1], row[2], row[3], row[6]]);
}

function asciiTableFitsWidth(tableLines: string[], maxLineWidth?: number): boolean {
  if (maxLineWidth == null) return true;
  return tableLines.every((line) => visibleLength(line) <= maxLineWidth);
}

function buildMonthlySectionLines(
  data: SolarResponse,
  monthlyYields: SolarMonthlyYieldRow[],
  energy: EnergyDashboardData | null,
  maxLineWidth?: number,
): string[] {
  const lines: string[] = [];
  if (monthlyYields.length > 0) {
    lines.push(
      `Solar (last ${monthlyYields.length} months)`,
      ...makeAsciiTable(
        ["Month", "Avg Yield", "Total Yield", "Days"],
        buildMonthlySolarRows(monthlyYields, solarYieldTotalKwh(data)),
      ),
    );
  }

  const energyMonthly = energy?.monthlyForDisplay ?? null;
  if (energyMonthly && Object.keys(energyMonthly).length > 0) {
    const energyMonthKeys = energy?.monthKeys?.length
      ? energy.monthKeys
      : Object.keys(energyMonthly);
    const energyRows = buildMonthlyEnergyRows(energyMonthly, energyMonthKeys);
    if (energyRows.length > 0) {
      const fullHeaders = ["Month", "⚡", "Gas", "Total", "⚡ kWh", "Gas kWh", "Days"];
      let table = makeAsciiTable(fullHeaders, energyRows);
      if (!asciiTableFitsWidth(table, maxLineWidth)) {
        table = makeAsciiTable(
          ["Month", "⚡", "Gas", "Total", "Days"],
          withoutMonthlyEnergyKwhColumns(energyRows),
        );
      }
      if (lines.length > 0) lines.push("");
      lines.push(`Energy (last ${ENERGY_MONTHLY_HISTORY_MONTHS} months)`, ...table);
    }
  }
  return lines;
}

function buildYearlySectionLines(yearlySummaries: YearlySummaryRow[]): string[] {
  if (yearlySummaries.length === 0) return [];
  return [
    "Gas",
    ...makeAsciiTable(["Period", "Avg (total)"], buildYearlyGasRows(yearlySummaries)),
    "",
    "Elec",
    ...makeAsciiTable(["Period", "Avg (total)"], buildYearlyElecRows(yearlySummaries)),
    "",
    "Solar",
    ...makeAsciiTable(["Period", "Avg (total)"], buildYearlySolarRows(yearlySummaries)),
  ];
}

function buildYearlyGasRows(rows: YearlySummaryRow[]): string[][] {
  return rows.map((row) => [
    row.label,
    formatYearlyMoneyCell(row.gAvgMonthlyPence, row.gTotalPence, row.gMonths),
  ]);
}

function buildYearlyElecRows(rows: YearlySummaryRow[]): string[][] {
  return rows.map((row) => [
    row.label,
    formatYearlyMoneyCell(row.eAvgMonthlyPence, row.eTotalPence, row.eMonths),
  ]);
}

function buildYearlySolarRows(rows: YearlySummaryRow[]): string[][] {
  return rows.map((row) => [
    row.label,
    formatYearlySolarCell(row.solarAvgMonthlyKwh, row.solarTotalKwh, row.solarMonths),
  ]);
}

function buildSolarViewBody(
  data: SolarResponse,
  maxLineWidth?: number,
  monthlyYields: SolarMonthlyYieldRow[] = [],
  energy: EnergyDashboardData | null = null,
  yearlySummaries: YearlySummaryRow[] = [],
): string[] {
  const yields = normalizeDailyYield(data);
  const powerNow = normalizePowerNow(data);
  const powerAvgReadings = normalizePowerAvgReadings(data);
  const lines: string[] = [];

  if (energy) {
    pushSection(lines, "Tariffs", buildTariffSummaryLines(energy));
  }

  pushSection(
    lines,
    "Today",
    buildTodaySectionLines(data, powerNow, powerAvgReadings, yields),
  );
  pushSection(lines, "Daily", buildDailySectionLines(yields, energy));
  pushSection(
    lines,
    "Monthly",
    buildMonthlySectionLines(data, monthlyYields, energy, maxLineWidth),
  );
  pushSection(lines, "Yearly", buildYearlySectionLines(yearlySummaries));

  const socByHour = normalizeSOCAvgReadings(data);
  pushSection(
    lines,
    `Hourly (last ${POWER_HISTORY_HOURS} hours)`,
    renderHourlyTable(powerAvgReadings, socByHour),
  );

  // Drop the leading blank line from the first section heading.
  while (lines.length > 0 && lines[0] === "") lines.shift();
  return lines;
}

export function buildSolarPowerGraphPanelLines(
  data: SolarResponse,
  maxLineWidth?: number,
): string[] {
  const powerAvgReadings = normalizePowerAvgReadings(data);
  return [
    "=== Solar ===",
    "",
    `Power Graph (Last ${POWER_HISTORY_HOURS} Hourly Averages)`,
    ...renderPowerGraph(powerAvgReadings, maxLineWidth),
  ];
}

export type SolarRotateSummary = {
  solarYield: number | null;
  powerNow: number | null;
  powerHourAvg: number | null;
  now: Date;
  yieldAverages: YieldAverage[] | null;
  monthlyYields: SolarMonthlyYieldRow[] | null;
};

function formatSolarYieldLine(solarYield: number | null): string {
  return `Solar Yield: ${solarYield == null ? "-" : formatColoredKwh(solarYield)}`;
}

function solarSummaryLinesFitWidth(lines: string[], maxLineWidth: number): boolean {
  return lines.every((line) => visibleLength(line) <= maxLineWidth);
}

export function buildSolarRotatePanelLines(
  data: SolarResponse,
  maxLineWidth?: number,
  summary?: SolarRotateSummary,
): string[] {
  const lines = buildSolarPowerGraphPanelLines(data, maxLineWidth);
  if (!summary || maxLineWidth == null) return lines;

  const summaryLines = [
    formatSolarYieldLine(summary.solarYield),
    ...formatSolarStatusPowerLines(
      summary.powerNow,
      summary.powerHourAvg,
      summary.now,
      summary.yieldAverages,
      summary.monthlyYields,
    ),
  ];
  if (!solarSummaryLinesFitWidth(summaryLines, maxLineWidth)) {
    const yieldLine = formatSolarYieldLine(summary.solarYield);
    if (solarSummaryLinesFitWidth([yieldLine], maxLineWidth)) {
      return [...lines, "", yieldLine];
    }
    return lines;
  }
  return [...lines, "", ...summaryLines];
}

export function buildSolarPanelLines(
  data: SolarResponse,
  countdown?: { seconds: number; next: "weather"; paused?: boolean },
  maxLineWidth?: number,
  monthlyYields: SolarMonthlyYieldRow[] = [],
  energy: EnergyDashboardData | null = null,
  yearlySummaries: YearlySummaryRow[] = [],
): string[] {
  const title = countdown
    ? countdown.paused
      ? "=== Solar (Weather paused, n) ==="
      : `=== Solar (Weather in ${countdown.seconds}, n) ===`
    : "=== Solar ===";
  return [
    title,
    "",
    ...buildSolarViewBody(data, maxLineWidth, monthlyYields, energy, yearlySummaries),
  ];
}

export function buildSolarCliLines(
  data: SolarResponse,
  monthlyYields: SolarMonthlyYieldRow[] = [],
  energy: EnergyDashboardData | null = null,
  yearlySummaries: YearlySummaryRow[] = [],
): string[] {
  return [
    "Power",
    `Source: ${SOLAR_API_URL}`,
    "",
    ...buildSolarViewBody(
      data,
      process.stdout.columns,
      monthlyYields,
      energy,
      yearlySummaries,
    ),
  ];
}

function formatMonthlyYieldStatusLine(monthlyYields: SolarMonthlyYieldRow[]): string | null {
  const rows = monthlyYields.filter((row) => row.average != null).slice(-2);
  if (rows.length === 0) return null;
  return `Monthly avg: ${rows
    .map((row) => {
      const suffix =
        row.complete || row.days === 0 ? "" : ` (${row.days}/${row.daysInMonth})`;
      return `${formatSolarMonthLabel(row.month)}: ${formatColoredKwh(row.average!)}${suffix}`;
    })
    .join(" // ")}`;
}

export function formatSolarStatusPowerLines(
  powerNow: number | null,
  powerHourAvg: number | null,
  now: Date,
  yieldAverages: YieldAverage[] | null,
  monthlyYields: SolarMonthlyYieldRow[] | null = null,
): string[] {
  const nowText = powerNow == null ? "-" : formatColoredWattsPrecise(powerNow);
  const avgText = powerHourAvg == null ? "-" : formatColoredWattsPrecise(powerHourAvg);
  const hourLabel = formatUkHourLabel(ukHourStartMs(now));
  const lines = [`Solar: ${nowText} // Avg (${hourLabel}): ${avgText}`];
  const monthlyLine = monthlyYields ? formatMonthlyYieldStatusLine(monthlyYields) : null;
  if (monthlyLine) {
    lines.push(monthlyLine);
    return lines;
  }
  if (!yieldAverages || yieldAverages.length === 0) return lines;
  const averages = yieldAverages
    .map(({ days, average }) => `${days}d: ${average == null ? "-" : formatColoredKwh(average)}`)
    .join(" // ");
  lines.push(averages);
  return lines;
}

export function maxSolarPanelLineWidth(lines: string[]): number {
  return lines.reduce((max, line) => Math.max(max, visibleLength(line)), 0);
}
