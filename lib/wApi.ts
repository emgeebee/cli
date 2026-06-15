import stripAnsi from "strip-ansi";
import stringWidth from "string-width";

import { readPhoneCliConfig } from "../config";
import { formatTemperatureText } from "./temperatureColours";

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

export type WeatherResponse = {
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

const MOON_API_URL = "https://moon-phases-api-apiverve.p.rapidapi.com/v1/";
const MOON_API_HOST = "moon-phases-api-apiverve.p.rapidapi.com";
const ANSI_RESET = "\x1b[0m";
const ANSI_GREEN = "\x1b[32m";
const ANSI_YELLOW = "\x1b[33m";
const ANSI_ORANGE = "\x1b[38;5;208m";
const ANSI_RED = "\x1b[31m";

const HEAVY_RAIN_WORDING =
  /\b(heavy rain|heavy showers?|heavy downpour|torrential)\b/;
const LIGHT_RAIN_WORDING = /\b(light rain showers?|light showers?|light rain|drizzle)\b/;

function visibleLength(value: string): number {
  return stringWidth(stripAnsi(value));
}

function emojiTerminalDisplayWidth(value: string): number {
  // Strip the VS16 emoji selector so widths match text-presentation rendering.
  return visibleLength(stripAnsi(value).replace(/\uFE0F/g, ""));
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

function formatWeatherDisplay(weatherTypeText?: string, enhancedWeatherDescription?: string): WeatherDisplay {
  const description = (weatherTypeText || enhancedWeatherDescription || "Unknown").trim() || "Unknown";
  const lower = description.toLowerCase();

  // Icons use text-presentation symbols (no VS16 emoji selector) so widths are deterministic.
  if (/\b(snow|sleet|hail|blizzard|ice pellets|freezing rain|wintry|wintry showers)\b/.test(lower)) {
    return { icon: "❄", description };
  }
  if (HEAVY_RAIN_WORDING.test(lower)) {
    return { icon: "⛈⛈", description };
  }
  if (
    LIGHT_RAIN_WORDING.test(lower) ||
    /\b(thundery|thunderstorm|thunder|lightning)\b/.test(lower)
  ) {
    return { icon: "⛈", description };
  }
  if (
    /\b(light cloud|thin cloud|partly cloudy|partly sunny|sunny intervals|medium cloud|bright intervals)\b/.test(
      lower,
    )
  ) {
    return { icon: "⛅", description };
  }
  if (/\bsunny\b/.test(lower) && !/\bnot\s+sunny\b/.test(lower)) {
    return { icon: "☀", description };
  }
  if (/\b(overcast|heavy cloud|thick cloud|grey cloud|gray cloud|cloudy)\b/.test(lower)) {
    return { icon: "☁", description };
  }
  if (/\bclear\s+sky\b/.test(lower)) {
    return { icon: "☾", description };
  }
  return { icon: "", description };
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

function formatDisplayDate(localDate?: string): string {
  if (!localDate) return "unknown-date";
  const d = new Date(`${localDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return localDate;
  const weekday = d.toLocaleDateString("en-GB", { weekday: "short" });
  const day = d.toLocaleDateString("en-GB", { day: "2-digit" });
  const month = d.toLocaleDateString("en-GB", { month: "2-digit" });
  return `${weekday} ${day}/${month}`;
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

export function maxVisibleLineWidth(lines: string[]): number {
  return lines.reduce((max, line) => Math.max(max, visibleLength(line)), 0);
}

function formatWeatherUpdatedLabel(lastUpdated: string): string {
  if (!lastUpdated || lastUpdated === "unknown") return "unknown";
  const d = new Date(lastUpdated);
  if (Number.isNaN(d.getTime())) return lastUpdated;
  const time = d.toLocaleTimeString("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const date = d.toLocaleDateString("en-GB", {
    timeZone: "Europe/London",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${time}, ${date}`;
}

export async function buildFullWeatherLines(
  data: WeatherResponse,
  requestedPostcode: string,
): Promise<string[]> {
  const location = data.location?.name || data.location?.id || requestedPostcode.toUpperCase();
  const lastUpdated = data.lastUpdated || "unknown";
  const reports = (data.forecasts || [])
    .map((f) => f.summary?.report)
    .filter((r): r is DailyReport => Boolean(r));

  const lines: string[] = [
    `=== Weather (${location}, updated ${formatWeatherUpdatedLabel(lastUpdated)}) ===`,
    "",
  ];

  if (reports.length === 0) {
    lines.push("No daily forecast data available.");
    return lines;
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

  const appendHourlySection = (date: string, rows: string[][]): void => {
    if (!date || rows.length === 0) return;
    lines.push(`Hourly forecast for ${formatDisplayDate(date)}`);
    lines.push(...makeAsciiTable(hourlyHeaders, rows, hourlyWidths, forecastColWidthFns));
    lines.push("");
  };

  appendHourlySection(tomorrowDate, tomorrowHourlyRows);
  appendHourlySection(todayDate, todayHourlyRows);

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
    lines.push(`Today extras (${formatDisplayDate(todayDate)})`);
    lines.push(
      ...makeAsciiTable(
        ["Pollen", "Sunrise", "Sunset", "Day length", "Moon"],
        extrasRows,
        undefined,
        todayExtrasColWidthFns,
      ),
    );
    lines.push("");
  }

  lines.push("Daily forecast");
  const dayWidths = [
    sharedWidths.dateOrTime,
    sharedWidths.icon,
    sharedWidths.weather,
    tempWidth,
    tempWidth,
    sharedWidths.rain,
    sharedWidths.wind,
  ];
  lines.push(...makeAsciiTable(dayHeaders, dayRows, dayWidths, forecastColWidthFns));
  return lines;
}

export function withWeatherPanelCountdown(
  lines: string[],
  countdown?: { seconds: number; next: "solar" },
): string[] {
  if (!countdown || lines.length === 0) return lines;
  const title = lines[0].replace(/ ===$/, `, Solar in ${countdown.seconds}, n) ===`);
  return [title, ...lines.slice(1)];
}
