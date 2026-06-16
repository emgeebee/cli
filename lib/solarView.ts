import stripAnsi from "strip-ansi";
import stringWidth from "string-width";

import {
  formatColoredKwh,
  formatColoredWattsPrecise,
  formatUkHourLabel,
  ukHourStartMs,
  ukWallTimeToDate,
  parsePowerDateTimeKey,
  SOLAR_API_URL,
  type SolarResponse,
} from "./solarApi";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const DAILY_YIELD_DAYS = 28;
const AVERAGE_WINDOWS = [7, 14, 31] as const;
const POWER_HISTORY_HOURS = 34;
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

function buildDailyYieldRows(yields: DailyYield[]): string[][] {
  const byDate = new Map(yields.map((entry) => [entry.date, entry.value] as const));
  const end = latestYieldDay(yields);
  const start = new Date(end.getTime() - (DAILY_YIELD_DAYS - 1) * DAY_MS);
  const rows: string[][] = [];

  for (let offset = 0; offset < DAILY_YIELD_DAYS; offset += 1) {
    const date = new Date(start.getTime() + offset * DAY_MS);
    const ymd = toYmd(date);
    const value = byDate.get(ymd);
    rows.push([formatDateLabel(ymd), value == null ? "-" : formatColoredKwh(value)]);
  }

  return rows;
}

function yieldAveragesFromYields(yields: DailyYield[]): YieldAverage[] {
  const byDate = new Map(yields.map((entry) => [entry.date, entry.value] as const));
  const todayKey = dayKeyUK();

  return AVERAGE_WINDOWS.map((days) => {
    const values: number[] = [];
    for (let back = 1; back <= days; back += 1) {
      const value = byDate.get(subtractDayKey(todayKey, back));
      if (value != null) values.push(value);
    }
    const average =
      values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
    return { days, average, samples: values.length };
  });
}

export function yieldAveragesFromData(data: SolarResponse): YieldAverage[] {
  return yieldAveragesFromYields(normalizeDailyYield(data));
}

function buildAverageRows(yields: DailyYield[]): string[][] {
  return yieldAveragesFromYields(yields).map(({ days, average, samples }) => [
    `${days} days`,
    average == null ? "-" : formatColoredKwh(average),
    `${samples}/${days}`,
  ]);
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

function buildSolarViewBody(data: SolarResponse, maxLineWidth?: number): string[] {
  const yields = normalizeDailyYield(data);
  const powerNow = normalizePowerNow(data);
  const powerAvgReadings = normalizePowerAvgReadings(data);
  const lines: string[] = [];

  lines.push("Daily Yield (Last 4 Weeks)");
  lines.push(...makeAsciiTable(["Date", "Yield"], buildDailyYieldRows(yields)));
  lines.push("");
  lines.push("Power");
  lines.push(
    ...joinAsciiTables(
      makeAsciiTable(["", "W"], buildPowerRows(powerNow, powerAvgReadings)),
      makeAsciiTable(["Window", "Average", "Days"], buildAverageRows(yields)),
    ),
  );
  lines.push("");
  lines.push(`Power Graph (Last ${POWER_HISTORY_HOURS} Hourly Averages)`);
  lines.push(...renderPowerGraph(powerAvgReadings, maxLineWidth));
  return lines;
}

export function buildSolarPanelLines(
  data: SolarResponse,
  countdown?: { seconds: number; next: "weather"; paused?: boolean },
  maxLineWidth?: number,
): string[] {
  const title = countdown
    ? countdown.paused
      ? "=== Solar (Weather paused, n) ==="
      : `=== Solar (Weather in ${countdown.seconds}, n) ===`
    : "=== Solar ===";
  return [title, "", ...buildSolarViewBody(data, maxLineWidth)];
}

export function buildSolarCliLines(data: SolarResponse): string[] {
  return [
    "Solar",
    `Source: ${SOLAR_API_URL}`,
    "",
    ...buildSolarViewBody(data).map((line) => {
      if (line === "Daily Yield (Last 4 Weeks)") return "Daily yield (last 4 weeks)";
      if (line.startsWith("Power Graph")) {
        return `Power graph (last ${POWER_HISTORY_HOURS} hourly averages)`;
      }
      return line;
    }),
  ];
}

export function formatSolarStatusPowerLines(
  powerNow: number | null,
  powerHourAvg: number | null,
  now: Date,
  yieldAverages: YieldAverage[] | null,
): string[] {
  const nowText = powerNow == null ? "-" : formatColoredWattsPrecise(powerNow);
  const avgText = powerHourAvg == null ? "-" : formatColoredWattsPrecise(powerHourAvg);
  const hourLabel = formatUkHourLabel(ukHourStartMs(now));
  const lines = [`Solar: ${nowText} // Avg (${hourLabel}): ${avgText}`];
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
