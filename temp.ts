#!/usr/bin/env node

import stripAnsi from "strip-ansi";
import stringWidth from "string-width";
import { z } from "zod";

import { formatTemperatureText } from "./lib/temperatureColours";

const TEMP_API_URL = "http://api.emgeebee.buzz:1880/api/get-house-temp";
const BBC_WEATHER_OVERLAY_URL =
  "https://weather-broker-cdn.api.bbci.co.uk/en/maps/forecasts-observations?locations=CM2";
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const HISTORY_HOURS = 24;
const FUTURE_FORECAST_HOURS = 12;
const TOTAL_CHART_HOURS = HISTORY_HOURS + FUTURE_FORECAST_HOURS;
const CHART_MIN_TEMP = -5;
const CHART_MAX_TEMP = 25;
const CHART_HEIGHT = CHART_MAX_TEMP - CHART_MIN_TEMP + 1;
const CHART_POINT = "●";
const CHART_COLLISION = "◎";
const ANSI_RESET = "\x1b[0m";
const ANSI_CYAN = "\x1b[36m";
const ANSI_MAGENTA = "\x1b[35m";
const ANSI_YELLOW = "\x1b[33m";
const ANSI_GREEN = "\x1b[32m";
const ANSI_BLUE = "\x1b[34m";
const ANSI_RED = "\x1b[31m";
const ANSI_ORANGE = "\x1b[38;5;208m";
const ANSI_WHITE = "\x1b[37m";
const ROOM_COLORS = [
  ANSI_CYAN,
  ANSI_MAGENTA,
  ANSI_YELLOW,
  ANSI_GREEN,
  ANSI_BLUE,
  ANSI_RED,
  ANSI_ORANGE,
  ANSI_WHITE,
];
const DISPLAY_ROOM_ORDER = ["Outdoor", "Shed", "Downstairs"] as const;

const ReadingSchema = z.object({
  time: z.number().nullable().optional(),
  temp: z.number().nullable().optional(),
});

const TemperatureResponseSchema = z.record(z.string(), z.array(ReadingSchema));
const BbcOverlayEntrySchema = z.object({
  time: z.object({
    utc: z.string(),
  }),
  temperature: z.object({
    c: z.number().nullable().optional(),
  }),
  windDirection: z.object({
    description: z.string().nullable().optional(),
  }).optional(),
  averageWindSpeed: z.object({
    mph: z.number().nullable().optional(),
  }).optional(),
});
const BbcOverlayFeatureSchema = z.object({
  properties: z.object({
    observations: z.array(BbcOverlayEntrySchema).optional(),
    forecasts: z.array(BbcOverlayEntrySchema).optional(),
  }),
});
const BbcOverlayResponseSchema = z.object({
  features: z.array(BbcOverlayFeatureSchema),
});

type TemperatureReading = {
  time: number;
  temp: number;
};
type RawTemperatureReading = z.infer<typeof ReadingSchema>;
type TemperatureResponse = Record<string, TemperatureReading[]>;
type RoomHistory = {
  room: string;
  color: string;
  recent: TemperatureReading[];
  chartSeries: Array<number | null>;
};
type BbcForecastPoint = {
  time: number;
  temp: number;
  windMph: number | null;
  windDescription: string;
};
type BbcOutdoorData = {
  observations: TemperatureReading[];
  forecasts: BbcForecastPoint[];
};

function usage(): void {
  console.log("Usage:");
  console.log("  temp");
  console.log("");
  console.log("Fetches house temperatures and shows the last 24 hours.");
  console.log("Also overlays BBC outdoor observations for CM2 when available.");
}

function padCell(value: string, width: number): string {
  return value + " ".repeat(Math.max(0, width - visibleLength(value)));
}

function visibleLength(value: string): number {
  return stringWidth(stripAnsi(value));
}

function colorize(value: string, color: string): string {
  return `${color}${value}${ANSI_RESET}`;
}

function makeAsciiTable(headers: string[], rows: string[][]): string[] {
  const widths = headers.map((header, idx) =>
    Math.max(
      visibleLength(header),
      ...rows.map((row) => visibleLength(row[idx] || "")),
    ),
  );
  const border = `+-${widths.map((w) => "-".repeat(w)).join("-+-")}-+`;
  const headerLine = `| ${headers.map((h, i) => padCell(h, widths[i])).join(" | ")} |`;
  const body = rows.map((row) => `| ${row.map((v, i) => padCell(v || "", widths[i])).join(" | ")} |`);
  return [border, headerLine, border, ...body, border];
}

function formatTemp(value: number): string {
  return `${value.toFixed(1)}C`;
}

function formatTempMaxColour(value: number): string {
  return formatTemperatureText(value, { scale: "max", fractionDigits: 1 });
}

function formatTempMinColour(value: number): string {
  return formatTemperatureText(value, { scale: "min", fractionDigits: 1 });
}

function formatLastSeen(ms: number): string {
  return new Date(ms).toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatHourLabel(ms: number): string {
  return new Date(ms).toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatAxisHourLabel(ms: number): string {
  const d = new Date(ms);
  const hour = Number(
    d.toLocaleTimeString("en-GB", {
      hour: "numeric",
      hour12: false,
    }),
  );
  const suffix = hour >= 12 ? "pm" : "am";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}${suffix}`;
}

function startOfHour(ms: number): number {
  const d = new Date(ms);
  d.setMinutes(0, 0, 0);
  return d.getTime();
}

async function fetchTemperatureHistory(): Promise<TemperatureResponse> {
  const response = await fetch(TEMP_API_URL, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(`Temperature API request failed (${response.status})`);
  }
  const payload = TemperatureResponseSchema.parse(await response.json());
  const cleaned: TemperatureResponse = {};
  for (const [room, readings] of Object.entries(payload)) {
    cleaned[room] = (readings as RawTemperatureReading[])
      .filter((reading) => Number.isFinite(reading.time) && Number.isFinite(reading.temp))
      .map((reading) => ({
        time: reading.time as number,
        temp: reading.temp as number,
      }));
  }
  return cleaned;
}

function toTemperatureReading(utc: string, tempC: number | null | undefined): TemperatureReading | null {
  if (tempC == null || !Number.isFinite(tempC)) return null;
  const time = Date.parse(utc);
  if (!Number.isFinite(time)) return null;
  return { time, temp: tempC };
}

async function fetchBbcOutdoorData(): Promise<BbcOutdoorData> {
  const response = await fetch(BBC_WEATHER_OVERLAY_URL, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Referer: "https://www.bbc.co.uk/",
      "Accept-Language": "en-GB,en;q=0.8",
    },
  });
  if (!response.ok) {
    throw new Error(`BBC weather overlay request failed (${response.status})`);
  }
  const payload = BbcOverlayResponseSchema.parse(await response.json());
  const observations = payload.features.flatMap((feature) => feature.properties.observations || []);
  const forecasts = payload.features.flatMap((feature) => feature.properties.forecasts || []);
  return {
    observations: observations
    .map((entry) => toTemperatureReading(entry.time.utc, entry.temperature.c))
    .filter((entry): entry is TemperatureReading => entry != null)
    .sort((a, b) => a.time - b.time),
    forecasts: forecasts
      .map((entry): BbcForecastPoint | null => {
        const reading = toTemperatureReading(entry.time.utc, entry.temperature.c);
        if (!reading) return null;
        return {
          time: reading.time,
          temp: reading.temp,
          windMph: entry.averageWindSpeed?.mph ?? null,
          windDescription: String(entry.windDirection?.description || "").trim(),
        };
      })
      .filter((entry): entry is BbcForecastPoint => entry != null)
      .sort((a, b) => a.time - b.time),
  };
}

function filterLast24Hours(readings: TemperatureReading[], nowMs: number): TemperatureReading[] {
  const cutoff = nowMs - DAY_MS;
  return readings
    .filter((reading) => Number.isFinite(reading.time) && Number.isFinite(reading.temp))
    .filter((reading) => reading.time >= cutoff && reading.time <= nowMs)
    .sort((a, b) => a.time - b.time);
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildHourlySeries(
  readings: TemperatureReading[],
  firstHour: number,
  hours: number,
): Array<number | null> {
  const series: Array<number | null> = [];

  for (let i = 0; i < hours; i += 1) {
    const hour = firstHour + i * HOUR_MS;
    const nextHour = hour + HOUR_MS;
    const bucketTemps = readings
      .filter((reading) => reading.time >= hour && reading.time < nextHour)
      .map((reading) => reading.temp);
    series.push(bucketTemps.length > 0 ? average(bucketTemps) : null);
  }

  return series;
}

function emptyFutureSeries(): Array<number | null> {
  return Array.from({ length: FUTURE_FORECAST_HOURS }, () => null);
}

function buildBbcForecastSeries(forecasts: BbcForecastPoint[], nowMs: number): Array<number | null> {
  const firstForecastHour = startOfHour(nowMs) + HOUR_MS;
  const series = emptyFutureSeries();
  for (const forecast of forecasts) {
    const hour = startOfHour(forecast.time);
    const offset = Math.round((hour - firstForecastHour) / HOUR_MS);
    if (offset < 0 || offset >= FUTURE_FORECAST_HOURS) continue;
    series[offset] = forecast.temp;
  }
  return series;
}

function buildRoomHistories(data: TemperatureResponse, nowMs: number): RoomHistory[] {
  const currentHour = startOfHour(nowMs);
  const firstHour = currentHour - (HISTORY_HOURS - 1) * HOUR_MS;
  return Object.keys(data)
    .sort((a, b) => a.localeCompare(b))
    .map((room, idx) => {
      const recent = filterLast24Hours(data[room] || [], nowMs);
      return {
        room,
        color: ROOM_COLORS[idx % ROOM_COLORS.length] || ANSI_WHITE,
        recent,
        chartSeries: [...buildHourlySeries(recent, firstHour, HISTORY_HOURS), ...emptyFutureSeries()],
      };
    });
}

function buildOverlayHistory(
  room: string,
  color: string,
  readings: TemperatureReading[],
  forecasts: BbcForecastPoint[],
  nowMs: number,
): RoomHistory | null {
  const currentHour = startOfHour(nowMs);
  const firstHour = currentHour - (HISTORY_HOURS - 1) * HOUR_MS;
  const recent = filterLast24Hours(readings, nowMs);
  if (recent.length === 0) return null;
  return {
    room,
    color,
    recent,
    chartSeries: [
      ...buildHourlySeries(recent, firstHour, HISTORY_HOURS),
      ...buildBbcForecastSeries(forecasts, nowMs),
    ],
  };
}

function filterDisplayHistories(histories: RoomHistory[]): RoomHistory[] {
  const byRoom = new Map(histories.map((history) => [history.room, history] as const));
  return DISPLAY_ROOM_ORDER
    .map((room) => byRoom.get(room))
    .filter((history): history is RoomHistory => history != null);
}

function buildSummaryRows(histories: RoomHistory[]): string[][] {
  const rows: string[][] = [];
  for (const { room, recent } of histories) {
    if (recent.length === 0) {
      rows.push([room, "-", "-", "-", "-", "0", "-"]);
      continue;
    }
    const temps = recent.map((reading) => reading.temp);
    const latest = recent[recent.length - 1]!;
    rows.push([
      room,
      formatTempMaxColour(latest.temp),
      formatTempMinColour(Math.min(...temps)),
      formatTempMaxColour(Math.max(...temps)),
      formatTempMaxColour(average(temps)),
      String(recent.length),
      formatLastSeen(latest.time),
    ]);
  }
  return rows;
}

function rowIndexForValue(value: number, minTemp: number, maxTemp: number, height: number): number {
  if (maxTemp <= minTemp) return Math.floor(height / 2);
  const clamped = Math.max(minTemp, Math.min(maxTemp, Math.round(value)));
  return Math.max(0, Math.min(height - 1, maxTemp - clamped));
}

function renderHistoryChart(histories: RoomHistory[], nowMs: number): string[] {
  const allTemps = histories.flatMap((history) =>
    history.chartSeries.filter((value): value is number => value != null),
  );
  if (allTemps.length === 0) {
    return ["No readings in last 24h."];
  }

  const minTemp = CHART_MIN_TEMP;
  const maxTemp = CHART_MAX_TEMP;

  const cols = histories[0]?.chartSeries.length || TOTAL_CHART_HOURS;
  const grid = Array.from({ length: CHART_HEIGHT }, () => Array.from({ length: cols }, () => "  "));
  for (const history of histories) {
    for (let col = 0; col < history.chartSeries.length; col += 1) {
      const value = history.chartSeries[col];
      if (value == null) continue;
      const row = rowIndexForValue(value, minTemp, maxTemp, CHART_HEIGHT);
      const point = `${colorize(CHART_POINT, history.color)} `;
      grid[row][col] =
        grid[row][col] === "  "
          ? point
          : `${colorize(CHART_COLLISION, ANSI_WHITE)} `;
    }
  }

  const lines: string[] = [];
  for (let row = 0; row < CHART_HEIGHT; row += 1) {
    const tempAtRow = maxTemp - row;
    lines.push(`${String(tempAtRow).padStart(3)}C |${grid[row].join("")}`);
  }

  lines.push(`      +${"-".repeat(cols * 2)}`);

  const firstHour = startOfHour(nowMs) - (HISTORY_HOURS - 1) * HOUR_MS;
  const labelChars = Array(cols * 2).fill(" ");
  for (let col = 0; col < cols; col += 6) {
    const label = formatAxisHourLabel(firstHour + col * HOUR_MS);
    const pos = col * 2;
    for (let i = 0; i < label.length && pos + i < labelChars.length; i += 1) {
      labelChars[pos + i] = label[i] || " ";
    }
  }
  lines.push(`       ${labelChars.join("")}`);
  const nowChars = Array(cols * 2).fill(" ");
  const nowPos = HISTORY_HOURS * 2 - 1;
  if (nowPos >= 0 && nowPos < nowChars.length) nowChars[nowPos] = "|";
  if (nowPos + 2 < nowChars.length) {
    nowChars[nowPos + 2] = "n";
    nowChars[nowPos + 3] = "o";
    nowChars[nowPos + 4] = "w";
  }
  lines.push(`       ${nowChars.join("")}`);
  lines.push(
    `Legend: ${histories.map((history) => `${colorize(CHART_POINT, history.color)} ${history.room}`).join("  ")}`,
  );

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
      throw new Error("This command takes no arguments.");
    }

    const nowMs = Date.now();
    const [data, bbcOutdoorResult]: [TemperatureResponse, BbcOutdoorData | Error] = await Promise.all([
      fetchTemperatureHistory(),
      fetchBbcOutdoorData().catch((error: unknown) =>
        error instanceof Error ? error : new Error(String(error)),
      ),
    ]);
    const histories = buildRoomHistories(data, nowMs);
    const bbcOutdoorHistory =
      bbcOutdoorResult instanceof Error
        ? null
        : buildOverlayHistory(
            "Outdoor",
            ANSI_WHITE,
            bbcOutdoorResult.observations,
            bbcOutdoorResult.forecasts,
            nowMs,
          );
    const summaryHistories = bbcOutdoorHistory ? [...histories, bbcOutdoorHistory] : histories;
    const displayHistories = filterDisplayHistories(
      summaryHistories,
    );

    console.log("House temperatures");
    console.log(`Window: last 24h + next 12h outdoor forecast`);
    console.log(`Source: ${TEMP_API_URL}`);
    if (bbcOutdoorHistory) {
      console.log(`Overlay: outdoor observations + forecast for CM2`);
    } else if (bbcOutdoorResult instanceof Error) {
      console.log(`Overlay: BBC outdoor observations unavailable`);
    }

    if (summaryHistories.length === 0) {
      console.log("");
      console.log("No temperature readings returned.");
      return;
    }

    console.log("");
    console.log("Room summary");
    for (const line of makeAsciiTable(
      ["Room", "Now", "Min", "Max", "Avg", "Points", "Last seen"],
      buildSummaryRows(summaryHistories),
    )) {
      console.log(line);
    }

    console.log("");
    console.log("24h history graph + next 12h outdoor forecast (hourly)");
    for (const line of renderHistoryChart(displayHistories, nowMs)) {
      console.log(line);
    }
  } catch (error: unknown) {
    const message =
      error instanceof z.ZodError
        ? `Unexpected temperature API response: ${error.issues.map((issue) => issue.message).join("; ")}`
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
