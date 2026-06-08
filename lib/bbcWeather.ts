import { readPhoneCliConfig } from "../config";
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

export type BbcWeatherDailyForecast = {
  summary?: { report?: BbcWeatherDailyReport };
  detailed?: { reports?: unknown[] };
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

export function dailyReportsFromWeather(data: BbcWeatherResponse): BbcWeatherDailyReport[] {
  return (data.forecasts || [])
    .map((forecast) => forecast.summary?.report)
    .filter((report): report is BbcWeatherDailyReport => Boolean(report));
}

export function todayWeatherReport(
  data: BbcWeatherResponse,
  todayYmd: string = ukTodayYmd(),
): BbcWeatherDailyReport | null {
  const reports = dailyReportsFromWeather(data);
  return reports.find((report) => report.localDate === todayYmd) || reports[0] || null;
}

export function todaySunriseSunset(
  data: BbcWeatherResponse,
  todayYmd: string = ukTodayYmd(),
): { sunrise: string; sunset: string } {
  const report = todayWeatherReport(data, todayYmd);
  return {
    sunrise: report?.sunrise || "-",
    sunset: report?.sunset || "-",
  };
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

export function formatTodayWeatherLine(report: BbcWeatherDailyReport | null): string {
  if (!report) return "-";

  const summary =
    (report.weatherTypeText || report.enhancedWeatherDescription || "Unknown").trim() || "Unknown";
  const max = formatTemperatureText(report.maxTempC, { scale: "max" });
  const min = formatTemperatureText(report.minTempC, { scale: "min" });
  const rain = formatRainPercent(report.precipitationProbabilityInPercent);

  return `${summary}, max ${max}, min ${min}, rain ${rain}`;
}
