#!/usr/bin/env node

import { z } from "zod";

const SOLAR_API_URL = "http://api.emgeebee.buzz:1880/api/solar";
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const DAILY_YIELD_DAYS = 28;
const AVERAGE_WINDOWS = [7, 14, 31] as const;
const POWER_HISTORY_HOURS = 48;
const POWER_CHART_HEIGHT = 12;
const CHART_POINT = "●";

const numericField = z.preprocess((value) => {
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : value;
  }
  return value;
}, z.number());

const SolarResponseSchema = z.object({
  yield: z.record(z.string(), numericField).default({}),
  power: z.record(z.string(), numericField).default({}),
});

type SolarResponse = z.infer<typeof SolarResponseSchema>;
type DailyYield = {
  date: string;
  value: number;
};
type PowerReading = {
  time: number;
  value: number;
};

function usage(): void {
  console.log("Usage:");
  console.log("  solar");
  console.log("");
  console.log("Shows solar daily yield, rolling averages, and a 48 hour power graph.");
}

function parseDateKey(key: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseDateTimeKey(key: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/.exec(key);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute));
  return Number.isNaN(date.getTime()) ? null : date;
}

function toYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function startOfUtcHour(ms: number): number {
  const date = new Date(ms);
  date.setUTCMinutes(0, 0, 0);
  return date.getTime();
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
    timeZone: "UTC",
  });
}

function formatKwh(value: number): string {
  return `${value.toFixed(1)} kWh`;
}

function formatWatts(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}kW`;
  return `${Math.round(value)}W`;
}

function padCell(value: string, width: number): string {
  return value + " ".repeat(Math.max(0, width - value.length));
}

function makeAsciiTable(headers: string[], rows: string[][]): string[] {
  const widths = headers.map((header, idx) =>
    Math.max(
      header.length,
      ...rows.map((row) => (row[idx] || "").length),
    ),
  );
  const border = `+-${widths.map((width) => "-".repeat(width)).join("-+-")}-+`;
  const headerLine = `| ${headers.map((header, idx) => padCell(header, widths[idx])).join(" | ")} |`;
  const body = rows.map((row) => `| ${row.map((value, idx) => padCell(value || "", widths[idx])).join(" | ")} |`);
  return [border, headerLine, border, ...body, border];
}

async function fetchSolarData(): Promise<SolarResponse> {
  const response = await fetch(SOLAR_API_URL, {
    headers: {
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(`Solar API request failed (${response.status})`);
  }
  return SolarResponseSchema.parse(await response.json());
}

function normalizeDailyYield(data: SolarResponse): DailyYield[] {
  return Object.entries(data.yield)
    .map(([date, value]) => ({ date, value }))
    .filter((entry) => parseDateKey(entry.date) && Number.isFinite(entry.value))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function normalizePowerReadings(data: SolarResponse): PowerReading[] {
  return Object.entries(data.power)
    .map(([key, value]) => {
      const parsed = parseDateTimeKey(key);
      return parsed && Number.isFinite(value) ? { time: parsed.getTime(), value } : null;
    })
    .filter((entry): entry is PowerReading => entry != null)
    .sort((a, b) => a.time - b.time);
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
    rows.push([formatDateLabel(ymd), value == null ? "-" : formatKwh(value)]);
  }

  return rows;
}

function buildAverageRows(yields: DailyYield[]): string[][] {
  const byDate = new Map(yields.map((entry) => [entry.date, entry.value] as const));
  const end = latestYieldDay(yields);

  return AVERAGE_WINDOWS.map((days) => {
    const values: number[] = [];
    for (let offset = 0; offset < days; offset += 1) {
      const date = new Date(end.getTime() - offset * DAY_MS);
      const value = byDate.get(toYmd(date));
      if (value != null) values.push(value);
    }
    const average = values.length > 0
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : null;
    return [`${days} days`, average == null ? "-" : formatKwh(average), `${values.length}/${days}`];
  });
}

function buildHourlyPowerSeries(readings: PowerReading[]): {
  firstHour: number;
  series: Array<number | null>;
} {
  const latestHour = readings.length > 0
    ? startOfUtcHour(readings.at(-1)!.time)
    : startOfUtcHour(Date.now());
  const firstHour = latestHour - (POWER_HISTORY_HOURS - 1) * HOUR_MS;
  const buckets = Array.from({ length: POWER_HISTORY_HOURS }, () => [] as number[]);

  for (const reading of readings) {
    const hour = startOfUtcHour(reading.time);
    const index = Math.round((hour - firstHour) / HOUR_MS);
    if (index < 0 || index >= buckets.length) continue;
    buckets[index].push(reading.value);
  }

  return {
    firstHour,
    series: buckets.map((bucket) =>
      bucket.length > 0
        ? bucket.reduce((sum, value) => sum + value, 0) / bucket.length
        : null,
    ),
  };
}

function roundUpPowerScale(value: number): number {
  if (value <= 0) return 100;
  if (value <= 1000) return Math.ceil(value / 100) * 100;
  return Math.ceil(value / 500) * 500;
}

function renderPowerGraph(readings: PowerReading[]): string[] {
  const { firstHour, series } = buildHourlyPowerSeries(readings);
  const values = series.filter((value): value is number => value != null);
  if (values.length === 0) {
    return ["No power readings in the last 48 available hours."];
  }

  const maxPower = roundUpPowerScale(Math.max(...values));
  const grid = Array.from(
    { length: POWER_CHART_HEIGHT },
    () => Array.from({ length: series.length }, () => "  "),
  );

  for (let col = 0; col < series.length; col += 1) {
    const value = series[col];
    if (value == null) continue;
    const row = Math.max(
      0,
      Math.min(POWER_CHART_HEIGHT - 1, Math.round((1 - value / maxPower) * (POWER_CHART_HEIGHT - 1))),
    );
    grid[row][col] = `${CHART_POINT} `;
  }

  const lines: string[] = [];
  for (let row = 0; row < POWER_CHART_HEIGHT; row += 1) {
    const labelValue = maxPower * (1 - row / (POWER_CHART_HEIGHT - 1));
    lines.push(`${formatWatts(labelValue).padStart(6)} |${grid[row].join("")}`);
  }

  lines.push(`       +${"-".repeat(series.length * 2)}`);
  const labelChars = Array(series.length * 2).fill(" ");
  for (let col = 0; col < series.length; col += 6) {
    const label = formatHourLabel(firstHour + col * HOUR_MS);
    const pos = col * 2;
    for (let idx = 0; idx < label.length && pos + idx < labelChars.length; idx += 1) {
      labelChars[pos + idx] = label[idx] || " ";
    }
  }
  lines.push(`        ${labelChars.join("")}`);
  return lines;
}

async function main(): Promise<void> {
  try {
    const args = process.argv.slice(2);
    if (args[0] === "--help" || args[0] === "-h") {
      usage();
      return;
    }
    if (args.length > 0) {
      throw new Error("solar does not take arguments.");
    }

    const data = await fetchSolarData();
    const yields = normalizeDailyYield(data);
    const powerReadings = normalizePowerReadings(data);

    console.log("Solar");
    console.log(`Source: ${SOLAR_API_URL}`);
    console.log("");
    console.log("Daily yield (last 4 weeks)");
    for (const line of makeAsciiTable(["Date", "Yield"], buildDailyYieldRows(yields))) {
      console.log(line);
    }

    console.log("");
    console.log("Average daily yield");
    for (const line of makeAsciiTable(["Window", "Average", "Days"], buildAverageRows(yields))) {
      console.log(line);
    }

    console.log("");
    console.log("Power graph (last 48 available hours)");
    for (const line of renderPowerGraph(powerReadings)) {
      console.log(line);
    }
  } catch (error: unknown) {
    const message =
      error instanceof z.ZodError
        ? `Unexpected solar API response: ${error.issues.map((issue) => issue.message).join("; ")}`
        : error instanceof Error
          ? error.message
          : String(error);
    console.error(message);
    console.error("");
    usage();
    process.exit(1);
  }
}

void main();

export {};
