import { readPhoneCliConfig } from "../config";
import { ukWallTimeToDate } from "./solarApi";
import { formatTemperatureText } from "./temperatureColours";

const ANSI_RESET = "\x1b[0m";
const ANSI_GREEN = "\x1b[32m";
const ANSI_YELLOW = "\x1b[33m";
const ANSI_ORANGE = "\x1b[38;5;208m";
const ANSI_RED = "\x1b[31m";

export type BbcWeatherDailyReport = {
  localDate?: string;
  sunrise?: string | null;
  sunset?: string | null;
  weatherTypeText?: string | null;
  enhancedWeatherDescription?: string | null;
  maxTempC?: number | null;
  minTempC?: number | null;
  precipitationProbabilityInPercent?: number | null;
};

export type BbcWeatherHourlyReport = {
  localDate?: string;
  timeslot?: string;
  precipitationProbabilityInPercent?: number | null;
};

export type BbcWeatherDailyForecast = {
  summary?: { report?: BbcWeatherDailyReport };
  detailed?: { reports?: BbcWeatherHourlyReport[] };
};

export type RainChance = {
  localDate: string;
  timeslot: string;
  percent: number;
};

export type BbcWeatherResponse = {
  location?: { name?: string; id?: string };
  forecasts?: BbcWeatherDailyForecast[];
  lastUpdated?: string;
};

export const BBC_WEATHER_AGGREGATED_BASE_URL =
  "https://weather-broker-cdn.api.bbci.co.uk/en/forecast/aggregated";
export const DEFAULT_WEATHER_LOCATION = "cm2";
const UK_TZ = "Europe/London";

export function sanitizeWeatherLocation(input: string): string {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

export function resolveDefaultLocation(): string {
  const config = readPhoneCliConfig();
  const configured = String(config.defaultLocation ?? "").trim();
  if (configured) {
    return sanitizeWeatherLocation(configured);
  }
  return DEFAULT_WEATHER_LOCATION;
}

export function ukTodayYmd(now: Date = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: UK_TZ });
}

export function ukTomorrowYmd(now: Date = new Date()): string {
  const [year, month, day] = ukTodayYmd(now).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + 1));
  return date.toISOString().slice(0, 10);
}

export async function fetchBbcWeatherAggregated(location: string): Promise<BbcWeatherResponse> {
  const postcode = sanitizeWeatherLocation(location);
  const url = `${BBC_WEATHER_AGGREGATED_BASE_URL}/${encodeURIComponent(postcode)}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "*/*",
      "Accept-Language": "en-GB,en-US;q=0.9,en;q=0.8",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      Priority: "u=1, i",
      Referer: "https://www.bbc.co.uk/",
    },
  });
  if (!response.ok) {
    throw new Error(`Weather API request failed (${response.status})`);
  }
  return (await response.json()) as BbcWeatherResponse;
}

function parseTimeslotMinutes(timeslot: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(timeslot.trim());
  if (!match) return null;
  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function hourlySlotStart(localDate: string, timeslot: string): Date | null {
  const slotMinutes = parseTimeslotMinutes(timeslot);
  if (slotMinutes == null) return null;
  const [year, month, day] = localDate.split("-").map(Number);
  if (!year || !month || !day) return null;
  const hours = Math.floor(slotMinutes / 60);
  const minutes = slotMinutes % 60;
  return ukWallTimeToDate(year, month, day, hours, minutes);
}

export function hourlyReportsFromWeather(data: BbcWeatherResponse): BbcWeatherHourlyReport[] {
  return (data.forecasts || [])
    .flatMap((forecast) => forecast.detailed?.reports || [])
    .filter((report): report is BbcWeatherHourlyReport =>
      Boolean(report?.localDate && report?.timeslot),
    );
}

export function nextRainChance(
  reports: BbcWeatherHourlyReport[],
  thresholdPercent: number,
  now: Date = new Date(),
): RainChance | null {
  const nowMs = now.getTime();
  let best: (RainChance & { slotStartMs: number }) | null = null;

  for (const report of reports) {
    const percent = report.precipitationProbabilityInPercent;
    if (percent == null || percent <= thresholdPercent) continue;
    const localDate = report.localDate;
    const timeslot = report.timeslot;
    if (!localDate || !timeslot) continue;
    const slotStart = hourlySlotStart(localDate, timeslot);
    if (!slotStart) continue;
    const slotStartMs = slotStart.getTime();
    if (slotStartMs <= nowMs) continue;
    if (!best || slotStartMs < best.slotStartMs) {
      best = { localDate, timeslot, percent, slotStartMs };
    }
  }

  if (!best) return null;
  return { localDate: best.localDate, timeslot: best.timeslot, percent: best.percent };
}

function formatRainChanceDayLabel(localDate: string, todayYmd: string, tomorrowYmd: string): string {
  if (localDate === todayYmd) return "today";
  if (localDate === tomorrowYmd) return "tomorrow";
  const date = new Date(`${localDate}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return localDate;
  return date.toLocaleDateString("en-GB", { weekday: "short", timeZone: UK_TZ });
}

export function formatNextRainChanceLine(
  label: string,
  chance: RainChance | null,
  todayYmd: string,
  tomorrowYmd: string,
): string {
  if (!chance) return `${label}: -`;
  const dayLabel = formatRainChanceDayLabel(chance.localDate, todayYmd, tomorrowYmd);
  const rain = formatRainPercent(chance.percent);
  return `${label}: ${dayLabel} ${chance.timeslot} (${rain})`;
}

export function dailyReportsFromWeather(data: BbcWeatherResponse): BbcWeatherDailyReport[] {
  return (data.forecasts || [])
    .map((forecast) => forecast.summary?.report)
    .filter((report): report is BbcWeatherDailyReport => Boolean(report));
}

export function weatherReportForDate(
  data: BbcWeatherResponse,
  dayYmd: string,
): BbcWeatherDailyReport | null {
  const reports = dailyReportsFromWeather(data);
  return reports.find((report) => report.localDate === dayYmd) || null;
}

export function todayWeatherReport(
  data: BbcWeatherResponse,
  todayYmd: string = ukTodayYmd(),
): BbcWeatherDailyReport | null {
  return weatherReportForDate(data, todayYmd) || dailyReportsFromWeather(data)[0] || null;
}

export function sunriseSunsetForDate(
  data: BbcWeatherResponse,
  dayYmd: string,
): { sunrise: string; sunset: string } {
  const report = weatherReportForDate(data, dayYmd);
  return {
    sunrise: report?.sunrise || "-",
    sunset: report?.sunset || "-",
  };
}

export function todaySunriseSunset(
  data: BbcWeatherResponse,
  todayYmd: string = ukTodayYmd(),
): { sunrise: string; sunset: string } {
  return sunriseSunsetForDate(data, todayYmd);
}

function shouldUseColor(): boolean {
  return Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
}

function colorize(text: string, color: string): string {
  if (!shouldUseColor()) return text;
  return `${color}${text}${ANSI_RESET}`;
}

function formatRainPercent(value?: number | null): string {
  if (value == null) return "?%";
  const text = `${value}%`;
  if (value > 80) return colorize(text, ANSI_RED);
  if (value >= 50) return colorize(text, ANSI_ORANGE);
  if (value >= 25) return colorize(text, ANSI_YELLOW);
  return colorize(text, ANSI_GREEN);
}

export function formatWeatherLine(report: BbcWeatherDailyReport | null): string {
  if (!report) return "-";

  const summary =
    (report.weatherTypeText || report.enhancedWeatherDescription || "Unknown").trim() || "Unknown";
  const max = formatTemperatureText(report.maxTempC, { scale: "max" });
  const min = formatTemperatureText(report.minTempC, { scale: "min" });
  const rain = formatRainPercent(report.precipitationProbabilityInPercent);

  return `${summary}, max ${max}, min ${min}, rain ${rain}`;
}

export function formatTodayWeatherLine(report: BbcWeatherDailyReport | null): string {
  return formatWeatherLine(report);
}
