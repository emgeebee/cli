#!/usr/bin/env node

import stripAnsi from "strip-ansi";
import stringWidth from "string-width";

import { getConfigPath, readPhoneCliConfig } from "./config";
import { formatTemperatureText } from "./lib/temperatureColours";

type DailyReport = {
  localDate?: string;
  weatherTypeText?: string;
  maxTempC?: number | null;
  minTempC?: number | null;
  precipitationProbabilityInPercent?: number | null;
  windSpeedMph?: number | null;
  windDirectionAbbreviation?: string | null;
  enhancedWeatherDescription?: string;
  pollenIndex?: number | null;
  pollenIndexText?: string | null;
  sunrise?: string | null;
  sunset?: string | null;
};

type DailyForecast = {
  summary?: { report?: DailyReport };
  detailed?: { reports?: HourlyReport[] };
};

type HourlyReport = {
  localDate?: string;
  timeslot?: string;
  weatherTypeText?: string;
  enhancedWeatherDescription?: string;
  temperatureC?: number | null;
  precipitationProbabilityInPercent?: number | null;
  windSpeedMph?: number | null;
  windDirectionAbbreviation?: string | null;
};

type WeatherResponse = {
  location?: { name?: string; id?: string };
  forecasts?: DailyForecast[];
  lastUpdated?: string;
};

type MoonApiResponse = {
  status?: string;
  data?: {
    phase?: string;
    phaseEmoji?: string;
  };
};

const WEATHER_BASE_URL = "https://weather-broker-cdn.api.bbci.co.uk/en/forecast/aggregated";
const MOON_API_URL = "https://moon-phases-api-apiverve.p.rapidapi.com/v1/";
const MOON_API_HOST = "moon-phases-api-apiverve.p.rapidapi.com";
const DEFAULT_POSTCODE = "cm2";
const ANSI_RESET = "\x1b[0m";
const ANSI_BLUE = "\x1b[34m";
const ANSI_GREEN = "\x1b[32m";
const ANSI_YELLOW = "\x1b[33m";
const ANSI_ORANGE = "\x1b[38;5;208m";
const ANSI_RED = "\x1b[31m";

const HEAVY_RAIN_WORDING =
  /\b(heavy rain|heavy showers?|heavy downpour|torrential)\b/;
const LIGHT_RAIN_WORDING = /\b(light rain showers?|light showers?|light rain|drizzle)\b/;

/** Many terminals render emoji one cell wider than `string-width` reports (e.g. VS Code). */
const EXTENDED_PICTOGRAPHIC = /\p{Extended_Pictographic}/u;

function visibleLength(value: string): number {
  return stringWidth(stripAnsi(value));
}

/**
 * Width for emoji / mixed text (`Ic`, `Moon`). Empty → 0 (column pads with spaces only).
 * Must match measuring + padding: no +1 fudge; `string-width` can be 1 for ☾ yet terminals use 2 cols;
 * some VS16 pairs report 3 (e.g. ⛅️) — clamp those to 2.
 */
function emojiTerminalDisplayWidth(value: string): number {
  const plain = stripAnsi(value);
  if (!plain) return 0;
  try {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    let total = 0;
    for (const { segment } of segmenter.segment(plain)) {
      const sw = stringWidth(segment);
      if (EXTENDED_PICTOGRAPHIC.test(segment)) {
        let w = Math.max(sw, 2);
        total += w -1;
      } else if (/\p{Regional_Indicator}/u.test(segment)) {
        total += Math.max(sw, 2);
      } else {
        total += sw;
      }
    }
    return total;
  } catch {
    return visibleLength(value);
  }
}

function usage(): void {
  console.log("Usage:");
  console.log("  w");
  console.log("  w <postcode>");
  console.log("");
  console.log("Examples:");
  console.log("  w");
  console.log("  w ws9");
  console.log("  w sw1a");
  console.log("");
}

function sanitizePostcode(input: string): string {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

function parseArgs(argv: string[]): { help?: true; postcode?: string } {
  const args = argv.slice(2);
  if (args[0] === "--help" || args[0] === "-h") {
    return { help: true };
  }
  if (args.length === 0) {
    return { postcode: DEFAULT_POSTCODE };
  }
  if (args.length > 1) {
    throw new Error("Pass at most one postcode.");
  }
  const postcode = sanitizePostcode(args[0]);
  if (!postcode) {
    return { postcode: DEFAULT_POSTCODE };
  }
  return { postcode };
}

async function fetchWeather(postcode: string): Promise<WeatherResponse> {
  const url = `${WEATHER_BASE_URL}/${encodeURIComponent(postcode)}`;
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
  return (await response.json()) as WeatherResponse;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function resolveMoonRapidApiKey(): string {
  const config = readPhoneCliConfig();
  const ballConfig = asRecord(config.ball);
  return String(ballConfig?.rapidApiKey || "").trim();
}

function toMoonDate(localDate?: string): string {
  if (!localDate) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDate);
  if (!m) return "";
  return `${m[3]}-${m[2]}-${m[1]}`;
}

async function fetchMoonPhase(localDate?: string): Promise<string> {
  const apiKey = resolveMoonRapidApiKey();
  if (!apiKey) {
    return "moon api key not set";
  }
  const moonDate = toMoonDate(localDate);
  if (!moonDate) {
    return "-";
  }

  const response = await fetch(`${MOON_API_URL}?date=${encodeURIComponent(moonDate)}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "x-rapidapi-host": MOON_API_HOST,
      "x-rapidapi-key": apiKey,
    },
  });

  if (!response.ok) {
    return "no api calls for moon data left";
  }

  const payload = (await response.json()) as MoonApiResponse;
  const phase = payload.data?.phase ? String(payload.data.phase).trim() : "";
  const emoji = payload.data?.phaseEmoji ? String(payload.data.phaseEmoji).trim() : "";
  if (!phase && !emoji) {
    return "-";
  }
  return `${emoji} ${phase}`.trim();
}

type WeatherDisplay = { icon: string; description: string };

/**
 * Icons in a narrow column so the Weather column is text-only (stable table width).
 * Order matters: more specific patterns before generic ones.
 */
function formatWeatherDisplay(weatherTypeText?: string, enhancedWeatherDescription?: string): WeatherDisplay {
  const description = (weatherTypeText || enhancedWeatherDescription || "Unknown").trim() || "Unknown";
  const lower = description.toLowerCase();

  if (/\b(snow|sleet|hail|blizzard|ice pellets|freezing rain|wintry|wintry showers)\b/.test(lower)) {
    return { icon: "❄️", description };
  }

  if (HEAVY_RAIN_WORDING.test(lower)) {
    return { icon: "⛈️⛈️", description };
  }

  if (LIGHT_RAIN_WORDING.test(lower)) {
    return { icon: "⛈️", description };
  }

  if (
    /\b(light cloud|thin cloud|partly cloudy|partly sunny|sunny intervals|medium cloud|bright intervals)\b/.test(
      lower,
    )
  ) {
    return { icon: "⛅️", description };
  }

  if (/\bsunny\b/.test(lower) && !/\bnot\s+sunny\b/.test(lower)) {
    return { icon: "☀️", description };
  }

  if (/\b(overcast|heavy cloud|thick cloud|grey cloud|gray cloud|cloudy)\b/.test(lower)) {
    return { icon: "☁️", description };
  }

  if (/\bclear\s+sky\b/.test(lower)) {
    return { icon: "☾", description };
  }

  return { icon: "", description };
}

function formatDayCells(report: DailyReport): string[] {
  const date = formatDisplayDate(report.localDate);
  const wx = formatWeatherDisplay(report.weatherTypeText, report.enhancedWeatherDescription);
  const hi = formatMaxTemp(report.maxTempC);
  const lo = formatMinTemp(report.minTempC);
  const rain = formatRain(report.precipitationProbabilityInPercent);
  const windSpeed = formatWindSpeed(report.windSpeedMph);
  const windDir = report.windDirectionAbbreviation || "?";
  return [date, wx.icon, wx.description, lo, hi, rain, `${windSpeed} ${windDir}`];
}

function formatDisplayDate(localDate?: string): string {
  if (!localDate) return "unknown-date";
  const d = new Date(`${localDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return localDate;
  const weekday = d.toLocaleDateString("en-GB", { weekday: "short" });
  const day = d.toLocaleDateString("en-GB", { day: "2-digit" });
  const month = d.toLocaleDateString("en-GB", { month: "2-digit" });
  return `${weekday} ${day}/${month}`;
}

function formatHourlyTemp(value?: number | null): string {
  if (value == null) return "?";
  return formatMaxTemp(value);
}

function formatHourlyCells(report: HourlyReport): string[] {
  const time = report.timeslot || "??:??";
  const wx = formatWeatherDisplay(report.weatherTypeText, report.enhancedWeatherDescription);
  const temp = formatHourlyTemp(report.temperatureC);
  const rain = formatRain(report.precipitationProbabilityInPercent);
  const windSpeed = formatWindSpeed(report.windSpeedMph);
  const windDir = report.windDirectionAbbreviation || "?";
  return [time, wx.icon, wx.description, temp, rain, `${windSpeed} ${windDir}`];
}

function parseClockMinutes(value?: string | null): number | null {
  if (!value) return null;
  const m = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const hh = Number.parseInt(m[1], 10);
  const mm = Number.parseInt(m[2], 10);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

function formatDayLength(sunrise?: string | null, sunset?: string | null): string {
  const start = parseClockMinutes(sunrise);
  const end = parseClockMinutes(sunset);
  if (start == null || end == null || end < start) {
    return "-";
  }
  const total = end - start;
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return `${hours}h ${String(mins).padStart(2, "0")}m`;
}

function formatPollen(report?: DailyReport): string {
  if (!report) return "-";
  const index = report.pollenIndex;
  const text = report.pollenIndexText ? String(report.pollenIndexText).trim() : "";
  if (index == null && !text) return "-";
  if (index == null) return text;
  if (!text) return String(index);
  return `${index} (${text})`;
}

function shouldUseColor(): boolean {
  return Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
}

function colorize(value: string, color: string): string {
  if (!shouldUseColor()) return value;
  return `${color}${value}${ANSI_RESET}`;
}

function formatMaxTemp(value?: number | null): string {
  return formatTemperatureText(value, { scale: "max" });
}

function formatMinTemp(value?: number | null): string {
  return formatTemperatureText(value, { scale: "min" });
}

function formatRain(value?: number | null): string {
  if (value == null) return "?%";
  const text = `${value}%`;
  const colored =
    value > 80
      ? colorize(text, ANSI_RED)
      : value >= 50
        ? colorize(text, ANSI_ORANGE)
        : value >= 25
          ? colorize(text, ANSI_YELLOW)
          : colorize(text, ANSI_GREEN);
  return colored;
}

function formatWindSpeed(value?: number | null): string {
  if (value == null) return "?mph";
  const text = `${value}mph`;
  if (value > 40) return colorize(text, ANSI_RED);
  if (value >= 20) return colorize(text, ANSI_ORANGE);
  if (value >= 10) return colorize(text, ANSI_YELLOW);
  return colorize(text, ANSI_GREEN);
}

type ColWidthFns = Partial<Record<number, (value: string) => number>>;

function cellWidthForTable(colIdx: number, value: string, colWidthFns?: ColWidthFns): number {
  const fn = colWidthFns?.[colIdx];
  if (fn) return fn(value);
  return visibleLength(value);
}

function makeAsciiTable(
  headers: string[],
  rows: string[][],
  forcedWidths?: number[],
  colWidthFns?: ColWidthFns,
): string[] {
  const padCell = (value: string, colIdx: number, width: number): string => {
    const vw = cellWidthForTable(colIdx, value, colWidthFns);
    const padCount = width - vw;
    return padCount > 0 ? `${value}${" ".repeat(padCount)}` : value;
  };

  const widths = headers.map((header, colIdx) => {
    let max = Math.max(cellWidthForTable(colIdx, header, colWidthFns), forcedWidths?.[colIdx] || 0);
    for (const row of rows) {
      const cell = row[colIdx] || "";
      const len = cellWidthForTable(colIdx, cell, colWidthFns);
      if (len > max) max = len;
    }
    return max;
  });

  const border = `+${widths.map((w) => "-".repeat(w + 2)).join("+")}+`;
  const renderRow = (cells: string[]): string =>
    `| ${cells.map((cell, i) => padCell(cell || "", i, widths[i])).join(" | ")} |`;

  const lines = [border, renderRow(headers), border];
  for (const row of rows) {
    lines.push(renderRow(row));
  }
  lines.push(border);
  return lines;
}

async function printForecast(data: WeatherResponse, requestedPostcode: string): Promise<void> {
  const location = data.location?.name || data.location?.id || requestedPostcode.toUpperCase();
  const lastUpdated = data.lastUpdated || "unknown";
  const reports = (data.forecasts || [])
    .map((f) => f.summary?.report)
    .filter((r): r is DailyReport => Boolean(r));

  console.log(`Weather for ${location}`);
  console.log(`Last updated: ${lastUpdated}`);
  console.log("");

  if (reports.length === 0) {
    console.log("No daily forecast data available.");
    return;
  }

  const forecastColWidthFns: ColWidthFns = { 1: emojiTerminalDisplayWidth };
  const todayExtrasColWidthFns: ColWidthFns = { 4: emojiTerminalDisplayWidth };

  const dayHeaders = ["Date", "Ic", "Weather", "Min", "Max", "Rain", "Wind"];
  const dayRows = reports.map((report) => formatDayCells(report));

  const hourlyReports = (data.forecasts || [])
    .flatMap((f) => f.detailed?.reports || [])
    .filter((r): r is HourlyReport => Boolean(r && r.localDate && r.timeslot));

  const todayDate = reports[0]?.localDate || "";
  const tomorrowDate = reports[1]?.localDate || "";
  const rowsForDate = (date: string): string[][] => {
    if (!date) return [];
    return hourlyReports
      .filter((r) => r.localDate === date)
      .sort((a, b) => (a.timeslot || "").localeCompare(b.timeslot || ""))
      .map((report) => formatHourlyCells(report));
  };
  const todayHourlyRows = rowsForDate(todayDate);
  const tomorrowHourlyRows = rowsForDate(tomorrowDate);
  const allHourlyRows = [...tomorrowHourlyRows, ...todayHourlyRows];

  const minTempColWidth = Math.max(
    visibleLength("Min"),
    ...dayRows.map((r) => visibleLength(r[3] || "")),
  );
  const maxTempColWidth = Math.max(
    visibleLength("Max"),
    ...dayRows.map((r) => visibleLength(r[4] || "")),
  );
  const tempWidth = Math.max(
    visibleLength("Temp"),
    minTempColWidth,
    maxTempColWidth,
    ...allHourlyRows.map((r) => visibleLength(r[3] || "")),
  );
  const sharedWidths = {
    dateOrTime: Math.max(
      visibleLength("Date"),
      visibleLength("Time"),
      ...dayRows.map((r) => visibleLength(r[0] || "")),
      ...allHourlyRows.map((r) => visibleLength(r[0] || "")),
    ),
    icon: Math.max(
      emojiTerminalDisplayWidth("Ic"),
      ...dayRows.map((r) => emojiTerminalDisplayWidth(r[1] || "")),
      ...allHourlyRows.map((r) => emojiTerminalDisplayWidth(r[1] || "")),
    ),
    weather: Math.max(
      visibleLength("Weather"),
      ...dayRows.map((r) => visibleLength(r[2] || "")),
      ...allHourlyRows.map((r) => visibleLength(r[2] || "")),
    ),
    rain: Math.max(
      visibleLength("Rain"),
      ...dayRows.map((r) => visibleLength(r[5] || "")),
      ...allHourlyRows.map((r) => visibleLength(r[4] || "")),
    ),
    wind: Math.max(
      visibleLength("Wind"),
      ...dayRows.map((r) => visibleLength(r[6] || "")),
      ...allHourlyRows.map((r) => visibleLength(r[5] || "")),
    ),
  };

  const hourlyHeaders = ["Time", "Ic", "Weather", "Temp", "Rain", "Wind"];
  const hourlyWidths = [
    sharedWidths.dateOrTime,
    sharedWidths.icon,
    sharedWidths.weather,
    tempWidth,
    sharedWidths.rain,
    sharedWidths.wind,
  ];

  const printHourlySection = (date: string, rows: string[][]): void => {
    if (!date || rows.length === 0) return;
    console.log(`Hourly forecast for ${formatDisplayDate(date)}`);
    const lines = makeAsciiTable(hourlyHeaders, rows, hourlyWidths, forecastColWidthFns);
    for (const line of lines) {
      console.log(line);
    }
    console.log("");
  };

  // Order: tomorrow hourly, today hourly, then full daily forecast table.
  printHourlySection(tomorrowDate, tomorrowHourlyRows);
  printHourlySection(todayDate, todayHourlyRows);
  if (todayDate) {
    const moon = await fetchMoonPhase(todayDate);
    const todayReport = reports.find((r) => r.localDate === todayDate) || reports[0];
    const extrasRows = [[
      formatPollen(todayReport),
      todayReport?.sunrise || "-",
      todayReport?.sunset || "-",
      formatDayLength(todayReport?.sunrise, todayReport?.sunset),
      moon,
    ]];
    console.log(`Today extras (${formatDisplayDate(todayDate)})`);
    const extraLines = makeAsciiTable(
      ["Pollen", "Sunrise", "Sunset", "Day length", "Moon"],
      extrasRows,
      undefined,
      todayExtrasColWidthFns,
    );
    for (const line of extraLines) {
      console.log(line);
    }
    console.log("");
  }

  console.log("Daily forecast");
  const dayWidths = [
    sharedWidths.dateOrTime,
    sharedWidths.icon,
    sharedWidths.weather,
    tempWidth,
    tempWidth,
    sharedWidths.rain,
    sharedWidths.wind,
  ];
  const dayTableLines = makeAsciiTable(dayHeaders, dayRows, dayWidths, forecastColWidthFns);
  for (const line of dayTableLines) {
    console.log(line);
  }
}

async function main(): Promise<void> {
  try {
    const parsed = parseArgs(process.argv);
    if (parsed.help) {
      usage();
      return;
    }
    const postcode = parsed.postcode || DEFAULT_POSTCODE;
    const data = await fetchWeather(postcode);
    await printForecast(data, postcode);
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

