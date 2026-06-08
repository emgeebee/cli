import { z } from "zod";

export const SOLAR_API_URL = "http://api.emgeebee.buzz:1880/api/solar";

const ANSI_RESET = "\x1b[0m";
const ANSI_GREEN = "\x1b[32m";
const ANSI_YELLOW = "\x1b[33m";
const ANSI_ORANGE = "\x1b[38;5;208m";
const ANSI_RED = "\x1b[31m";

const numericField = z.preprocess((value) => {
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : value;
  }
  return value;
}, z.number());

const SolarResponseSchema = z.object({
  yield: z.record(z.string(), numericField).default({}),
  powerNow: z
    .object({
      value: numericField,
    })
    .optional(),
  powerAvg: z.record(z.string(), numericField).default({}),
});

export type SolarResponse = z.infer<typeof SolarResponseSchema>;

export async function fetchSolarData(): Promise<SolarResponse> {
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

export function todayYieldKwh(data: SolarResponse, dayKey: string): number | null {
  const value = data.yield[dayKey];
  return value != null && Number.isFinite(value) ? value : null;
}

function shouldUseColor(): boolean {
  return Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
}

function colorize(text: string, color: string): string {
  if (!shouldUseColor()) return text;
  return `${color}${text}${ANSI_RESET}`;
}

function colorForYield(kwh: number): string {
  if (kwh > 4) return ANSI_GREEN;
  if (kwh > 2.5) return ANSI_YELLOW;
  if (kwh > 1.5) return ANSI_ORANGE;
  return ANSI_RED;
}

export function formatKwh(value: number): string {
  return `${value.toFixed(1)} kWh`;
}

export function formatColoredKwh(value: number): string {
  return colorize(formatKwh(value), colorForYield(value));
}

const UK_TZ = "Europe/London";

function colorForPower(watts: number): string {
  if (watts > 400) return ANSI_GREEN;
  if (watts > 200) return ANSI_YELLOW;
  if (watts > 100) return ANSI_ORANGE;
  return ANSI_RED;
}

export function formatWattsPrecise(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}kW`;
  return `${value.toFixed(1)}W`;
}

export function formatColoredWattsPrecise(value: number): string {
  return colorize(formatWattsPrecise(value), colorForPower(value));
}

/** API timestamps are UK wall-clock times without a zone suffix. */
export function ukWallTimeToDate(year: number, month: number, day: number, hour: number, minute: number): Date {
  let ts = Date.UTC(year, month - 1, day, hour, minute);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: UK_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date(ts));
    const got = {
      year: Number(parts.find((part) => part.type === "year")?.value),
      month: Number(parts.find((part) => part.type === "month")?.value),
      day: Number(parts.find((part) => part.type === "day")?.value),
      hour: Number(parts.find((part) => part.type === "hour")?.value),
      minute: Number(parts.find((part) => part.type === "minute")?.value),
    };
    if (
      got.year === year &&
      got.month === month &&
      got.day === day &&
      got.hour === hour &&
      got.minute === minute
    ) {
      return new Date(ts);
    }
    const gotMs = Date.UTC(got.year, got.month - 1, got.day, got.hour, got.minute);
    const wantMs = Date.UTC(year, month - 1, day, hour, minute);
    ts += wantMs - gotMs;
  }
  return new Date(ts);
}

export function parsePowerDateTimeKey(key: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})$/.exec(String(key).trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return ukWallTimeToDate(year, month, day, hour, minute);
}

export function powerNowWatts(data: SolarResponse): number | null {
  const value = data.powerNow?.value;
  return value != null && Number.isFinite(value) ? value : null;
}

export function ukHourStartMs(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: UK_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  return ukWallTimeToDate(year, month, day, hour, 0).getTime();
}

export function formatUkHourLabel(ms: number): string {
  return new Date(ms).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: UK_TZ,
  });
}

/** Hourly average power for the current UK hour from powerAvg. */
export function currentHourPowerAvgWatts(data: SolarResponse, now: Date = new Date()): number | null {
  const hourStart = ukHourStartMs(now);
  for (const [key, value] of Object.entries(data.powerAvg)) {
    const parsed = parsePowerDateTimeKey(key);
    if (parsed?.getTime() === hourStart && Number.isFinite(value)) {
      return value;
    }
  }
  return null;
}
