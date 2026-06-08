#!/usr/bin/env node

import { getConfigPath } from "./config";
import {
  fetchBbcWeatherAggregated,
  formatTodayWeatherLine,
  resolveDefaultLocation,
  todaySunriseSunset,
  todayWeatherReport,
  ukTodayYmd,
} from "./lib/bbcWeather";
import {
  currentHourPowerAvgWatts,
  fetchSolarData,
  formatColoredKwh,
  formatColoredWattsPrecise,
  formatUkHourLabel,
  powerNowWatts,
  todayYieldKwh,
  ukHourStartMs,
  type SolarResponse,
} from "./lib/solarApi";
import {
  fetchTemperatureHistory,
  latestRoomTemp,
  type TemperatureResponse,
} from "./lib/tempApi";
import { formatTemperatureText } from "./lib/temperatureColours";
import { fetchWfhStatus, formatWfhLine } from "./lib/wfhApi";

const UK_TZ = "Europe/London";
const TICK_MS = 1000;
const SOLAR_YIELD_REFRESH_MS = 30 * 60 * 1000;
const SOLAR_POWER_REFRESH_MS = 10 * 60 * 1000;
const TEMP_REFRESH_MS = 10 * 60 * 1000;
const ANSI_HIDE_CURSOR = "\x1b[?25l";
const ANSI_SHOW_CURSOR = "\x1b[?25h";

function usage(): void {
  console.log("Usage:");
  console.log("  status");
  console.log("");
  console.log("In a TTY, stays open and updates every second. Piped output prints once.");
  console.log(`Uses defaultLocation from ${getConfigPath()} for sunrise/sunset (falls back to cm2).`);
  console.log("Solar daily yield refreshes every 30 minutes.");
  console.log("Solar power now and hourly average refresh every 10 minutes.");
  console.log("Downstairs and shed temperatures refresh every 10 minutes.");
}

function formatTime(now: Date): string {
  return now.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: UK_TZ,
  });
}

function formatDate(now: Date): string {
  return now.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: UK_TZ,
  });
}

function parseClockMinutes(value: string): number | null {
  if (!value || value === "-") return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function ukSecondsSinceMidnight(now: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: UK_TZ,
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  const second = Number(parts.find((part) => part.type === "second")?.value);
  return hour * 3600 + minute * 60 + second;
}

function formatDurationMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}

function formatSunRelative(clock: string, now: Date): string {
  const eventMinutes = parseClockMinutes(clock);
  if (eventMinutes == null) return "";

  const diffMinutes = Math.round((ukSecondsSinceMidnight(now) - eventMinutes * 60) / 60);
  if (diffMinutes === 0) return " (now)";
  if (diffMinutes > 0) return ` (${formatDurationMinutes(diffMinutes)} ago)`;
  return ` (in ${formatDurationMinutes(-diffMinutes)})`;
}

function formatSunLine(label: string, clock: string, now: Date): string {
  return `${label}: ${clock}${formatSunRelative(clock, now)}`;
}

function formatSolarYieldLine(solarYield: number | null): string {
  return `solar yield: ${solarYield == null ? "-" : formatColoredKwh(solarYield)}`;
}

function formatSolarNowLine(powerNow: number | null): string {
  return `solar now: ${powerNow == null ? "-" : formatColoredWattsPrecise(powerNow)}`;
}

function formatSolarHourAvgLine(powerAvg: number | null, now: Date): string {
  const hourLabel = formatUkHourLabel(ukHourStartMs(now));
  return `solar avg: ${powerAvg == null ? "-" : formatColoredWattsPrecise(powerAvg)} (${hourLabel})`;
}

function formatRoomTempLine(label: string, temp: number | null): string {
  return `${label}: ${formatTemperatureText(temp, { fractionDigits: 1, unknownText: "-" })}`;
}

function buildDisplayLines(
  now: Date,
  sunrise: string,
  sunset: string,
  weatherLine: string,
  wfh: boolean | null,
  downstairsTemp: number | null,
  shedTemp: number | null,
  solarYield: number | null,
  powerNow: number | null,
  powerHourAvg: number | null,
): string[] {
  return [
    `time: ${formatTime(now)}`,
    `date: ${formatDate(now)}`,
    formatWfhLine(wfh),
    weatherLine,
    formatRoomTempLine("downstairs temp", downstairsTemp),
    formatRoomTempLine("shed temp", shedTemp),
    formatSunLine("sunrise", sunrise, now),
    formatSunLine("sunset", sunset, now),
    formatSolarYieldLine(solarYield),
    formatSolarNowLine(powerNow),
    formatSolarHourAvgLine(powerHourAvg, now),
  ];
}

function solarSnapshotFromData(data: SolarResponse, dayKey: string, now: Date): {
  yield: number | null;
  powerNow: number | null;
  powerHourAvg: number | null;
} {
  return {
    yield: todayYieldKwh(data, dayKey),
    powerNow: powerNowWatts(data),
    powerHourAvg: currentHourPowerAvgWatts(data, now),
  };
}

function writeDisplay(lines: string[], isUpdate: boolean): void {
  if (!isUpdate) {
    for (const line of lines) {
      console.log(line);
    }
    return;
  }
  process.stdout.write(`\x1b[${lines.length}A`);
  for (const line of lines) {
    process.stdout.write(`\x1b[2K${line}\n`);
  }
}

async function loadSolarSnapshot(dayKey: string, now: Date): Promise<{
  yield: number | null;
  powerNow: number | null;
  powerHourAvg: number | null;
}> {
  try {
    const data = await fetchSolarData();
    return solarSnapshotFromData(data, dayKey, now);
  } catch {
    return { yield: null, powerNow: null, powerHourAvg: null };
  }
}

function tempsFromData(data: TemperatureResponse): {
  downstairsTemp: number | null;
  shedTemp: number | null;
} {
  return {
    downstairsTemp: latestRoomTemp(data, "Downstairs"),
    shedTemp: latestRoomTemp(data, "Shed"),
  };
}

async function loadTemps(): Promise<{
  downstairsTemp: number | null;
  shedTemp: number | null;
}> {
  try {
    return tempsFromData(await fetchTemperatureHistory());
  } catch {
    return { downstairsTemp: null, shedTemp: null };
  }
}

async function printOnce(): Promise<void> {
  const now = new Date();
  const dayKey = ukTodayYmd(now);
  const [weather, solar, wfh, temps] = await Promise.all([
    fetchBbcWeatherAggregated(resolveDefaultLocation()),
    loadSolarSnapshot(dayKey, now),
    fetchWfhStatus(),
    loadTemps(),
  ]);
  const { sunrise, sunset } = todaySunriseSunset(weather, dayKey);
  const weatherLine = formatTodayWeatherLine(todayWeatherReport(weather, dayKey));
  writeDisplay(
    buildDisplayLines(
      now,
      sunrise,
      sunset,
      weatherLine,
      wfh,
      temps.downstairsTemp,
      temps.shedTemp,
      solar.yield,
      solar.powerNow,
      solar.powerHourAvg,
    ),
    false,
  );
}

async function runLive(): Promise<void> {
  const location = resolveDefaultLocation();
  let trackedDate = ukTodayYmd();
  let weather = await fetchBbcWeatherAggregated(location);
  let { sunrise, sunset } = todaySunriseSunset(weather, trackedDate);
  let weatherLine = formatTodayWeatherLine(todayWeatherReport(weather, trackedDate));
  let wfh: boolean | null = null;
  let downstairsTemp: number | null = null;
  let shedTemp: number | null = null;
  let solarYield: number | null = null;
  let powerNow: number | null = null;
  let powerHourAvg: number | null = null;
  let lastSolarYieldRefreshAt = 0;
  let lastPowerRefreshAt = 0;
  let lastPowerHourStart = 0;
  let lastTempRefreshAt = 0;

  [wfh, { downstairsTemp, shedTemp }] = await Promise.all([
    fetchWfhStatus(),
    loadTemps(),
  ]);
  lastTempRefreshAt = Date.now();

  try {
    const data = await fetchSolarData();
    const startedAt = Date.now();
    const started = new Date(startedAt);
    ({ yield: solarYield, powerNow, powerHourAvg } = solarSnapshotFromData(data, trackedDate, started));
    lastSolarYieldRefreshAt = startedAt;
    lastPowerRefreshAt = startedAt;
    lastPowerHourStart = ukHourStartMs(started);
  } catch {
    // Non-fatal: solar lines show "-" until a fetch succeeds.
  }

  const stop = (): void => {
    clearInterval(timer);
    process.stdout.write(ANSI_SHOW_CURSOR);
    process.stdout.write("\n");
    process.exit(0);
  };

  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  process.stdout.write(ANSI_HIDE_CURSOR);
  writeDisplay(
    buildDisplayLines(
      new Date(),
      sunrise,
      sunset,
      weatherLine,
      wfh,
      downstairsTemp,
      shedTemp,
      solarYield,
      powerNow,
      powerHourAvg,
    ),
    false,
  );

  const timer = setInterval(() => {
    void (async () => {
      const now = new Date();
      const nowMs = now.getTime();
      const today = ukTodayYmd(now);
      const dayChanged = today !== trackedDate;
      const needYieldRefresh = dayChanged || nowMs - lastSolarYieldRefreshAt >= SOLAR_YIELD_REFRESH_MS;
      const hourChanged = ukHourStartMs(now) !== lastPowerHourStart;
      const needPowerRefresh =
        dayChanged || hourChanged || nowMs - lastPowerRefreshAt >= SOLAR_POWER_REFRESH_MS;
      const needTempRefresh = dayChanged || nowMs - lastTempRefreshAt >= TEMP_REFRESH_MS;

      if (dayChanged) {
        trackedDate = today;
        [weather, wfh] = await Promise.all([
          fetchBbcWeatherAggregated(location),
          fetchWfhStatus(),
        ]);
        ({ sunrise, sunset } = todaySunriseSunset(weather, trackedDate));
        weatherLine = formatTodayWeatherLine(todayWeatherReport(weather, trackedDate));
      }

      if (needYieldRefresh || needPowerRefresh) {
        try {
          const data = await fetchSolarData();
          if (needYieldRefresh) {
            solarYield = todayYieldKwh(data, trackedDate);
            lastSolarYieldRefreshAt = nowMs;
          }
          if (needPowerRefresh) {
            powerNow = powerNowWatts(data);
            powerHourAvg = currentHourPowerAvgWatts(data, now);
            lastPowerRefreshAt = nowMs;
            lastPowerHourStart = ukHourStartMs(now);
          }
        } catch {
          // Keep last known values on transient API errors.
        }
      }

      if (needTempRefresh) {
        try {
          ({ downstairsTemp, shedTemp } = tempsFromData(await fetchTemperatureHistory()));
          lastTempRefreshAt = nowMs;
        } catch {
          // Keep last known values on transient API errors.
        }
      }

      writeDisplay(
        buildDisplayLines(
          now,
          sunrise,
          sunset,
          weatherLine,
          wfh,
          downstairsTemp,
          shedTemp,
          solarYield,
          powerNow,
          powerHourAvg,
        ),
        true,
      );
    })().catch((error: unknown) => {
      clearInterval(timer);
      process.stdout.write(ANSI_SHOW_CURSOR);
      const message = error instanceof Error ? error.message : String(error);
      console.error(`\n${message}`);
      process.exit(1);
    });
  }, TICK_MS);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args[0] === "--help" || args[0] === "-h") {
    usage();
    return;
  }
  if (args.length > 0) {
    throw new Error("status does not take arguments.");
  }

  if (process.stdout.isTTY) {
    await runLive();
    return;
  }
  await printOnce();
}

void main().catch((error: unknown) => {
  process.stdout.write(ANSI_SHOW_CURSOR);
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  console.error("");
  usage();
  process.exit(1);
});

export {};
