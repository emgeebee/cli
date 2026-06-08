#!/usr/bin/env node

import { getConfigPath } from "./config";
import {
  fetchBbcWeatherAggregated,
  formatTodayWeatherLine,
  formatWeatherLine,
  resolveDefaultLocation,
  sunriseSunsetForDate,
  todayWeatherReport,
  ukTodayYmd,
  ukTomorrowYmd,
  weatherReportForDate,
  type BbcWeatherResponse,
} from "./lib/bbcWeather";
import { ukWallTimeToDate } from "./lib/solarApi";
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
import {
  ELECTRICITY_PERIOD_LABELS,
  formatDayGasLine,
  formatElectricityPeriodAvgLine,
  formatElectricityPeriodAvgLines,
  loadTodayTomorrowElectricityRates,
  loadTodayTomorrowGasRates,
  type OctopusRate,
} from "./lib/octoApi";
import { formatTemperatureText } from "./lib/temperatureColours";
import { fetchWfhStatus, formatWfhLine } from "./lib/wfhApi";
import { enterFullscreen, leaveFullscreen, writeFullscreenLines } from "./lib/terminal";

const UK_TZ = "Europe/London";
const TICK_MS = 1000;
const SOLAR_YIELD_REFRESH_MS = 30 * 60 * 1000;
const SOLAR_POWER_REFRESH_MS = 10 * 60 * 1000;
const TEMP_REFRESH_MS = 10 * 60 * 1000;
const GAS_REFRESH_MS = 30 * 60 * 1000;

function usage(): void {
  console.log("Usage:");
  console.log("  status");
  console.log("");
  console.log("In a TTY, stays open and updates every second. Piped output prints once.");
  console.log(`Uses defaultLocation from ${getConfigPath()} for sunrise/sunset (falls back to cm2).`);
  console.log("Solar daily yield refreshes every 30 minutes.");
  console.log("Solar power now and hourly average refresh every 10 minutes.");
  console.log("Downstairs and shed temperatures refresh every 10 minutes.");
  console.log("Gas and electricity prices refresh every 30 minutes (requires octo config).");
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

function formatDurationMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}

function sunEventTime(clock: string, dayYmd: string): Date | null {
  const eventMinutes = parseClockMinutes(clock);
  if (eventMinutes == null) return null;
  const [year, month, day] = dayYmd.split("-").map(Number);
  const hours = Math.floor(eventMinutes / 60);
  const minutes = eventMinutes % 60;
  return ukWallTimeToDate(year, month, day, hours, minutes);
}

function formatSunRelative(clock: string, now: Date, dayYmd: string): string {
  const event = sunEventTime(clock, dayYmd);
  if (!event) return "";

  const diffMinutes = Math.round((now.getTime() - event.getTime()) / 60_000);
  if (diffMinutes === 0) return " (now)";
  if (diffMinutes > 0) return ` (${formatDurationMinutes(diffMinutes)} ago)`;
  return ` (in ${formatDurationMinutes(-diffMinutes)})`;
}

function formatSunLine(label: string, clock: string, now: Date, dayYmd: string): string {
  return `${label}: ${clock}${formatSunRelative(clock, now, dayYmd)}`;
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

function sectionDivider(name: string): string {
  return `── ${name} ──`;
}

function formatDayWeatherLine(label: string, line: string): string {
  return line === "-" ? `${label}: -` : `${label}: ${line}`;
}

type WeatherSnapshot = {
  weatherLine: string;
  tomorrowWeatherLine: string;
  sunrise: string;
  sunset: string;
};

function weatherSnapshotFromData(weather: BbcWeatherResponse, todayYmd: string): WeatherSnapshot {
  const tomorrowYmd = ukTomorrowYmd(new Date(`${todayYmd}T12:00:00Z`));
  const todaySun = sunriseSunsetForDate(weather, todayYmd);
  return {
    weatherLine: formatTodayWeatherLine(todayWeatherReport(weather, todayYmd)),
    tomorrowWeatherLine: formatWeatherLine(weatherReportForDate(weather, tomorrowYmd)),
    sunrise: todaySun.sunrise,
    sunset: todaySun.sunset,
  };
}

type GasSnapshot = {
  todayLine: string;
  tomorrowLine: string;
};

type HouseOctoSnapshot = {
  gas: GasSnapshot;
  electricityLines: string[];
};

function buildDisplayLines(
  now: Date,
  todayYmd: string,
  weather: WeatherSnapshot,
  houseOcto: HouseOctoSnapshot,
  wfh: boolean | null,
  downstairsTemp: number | null,
  shedTemp: number | null,
  solarYield: number | null,
  powerNow: number | null,
  powerHourAvg: number | null,
): string[] {
  return [
    sectionDivider("time"),
    `time: ${formatTime(now)}`,
    `date: ${formatDate(now)}`,
    sectionDivider("weather"),
    formatDayWeatherLine("today", weather.weatherLine),
    formatDayWeatherLine("tomorrow", weather.tomorrowWeatherLine),
    formatSunLine("sunrise", weather.sunrise, now, todayYmd),
    formatSunLine("sunset", weather.sunset, now, todayYmd),
    sectionDivider("solar"),
    formatSolarYieldLine(solarYield),
    formatSolarNowLine(powerNow),
    formatSolarHourAvgLine(powerHourAvg, now),
    sectionDivider("house"),
    formatWfhLine(wfh),
    houseOcto.gas.todayLine,
    houseOcto.gas.tomorrowLine,
    ...houseOcto.electricityLines,
    formatRoomTempLine("downstairs temp", downstairsTemp),
    formatRoomTempLine("shed temp", shedTemp),
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

function writeDisplay(lines: string[], fullscreen: boolean): void {
  if (fullscreen) {
    writeFullscreenLines(lines);
    return;
  }
  for (const line of lines) {
    console.log(line);
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

function emptyGasSnapshot(): GasSnapshot {
  return {
    todayLine: formatDayGasLine("today", []),
    tomorrowLine: formatDayGasLine("tomorrow", []),
  };
}

function gasSnapshotFromRates(rates: {
  today: OctopusRate[];
  tomorrow: OctopusRate[];
}): GasSnapshot {
  return {
    todayLine: formatDayGasLine("today", rates.today),
    tomorrowLine: formatDayGasLine("tomorrow", rates.tomorrow),
  };
}

function emptyElectricityLines(): string[] {
  return [
    ...ELECTRICITY_PERIOD_LABELS.map((label) => formatElectricityPeriodAvgLine(label, null)),
    ...ELECTRICITY_PERIOD_LABELS.map((label) => formatElectricityPeriodAvgLine(label, null, "tomorrow")),
  ];
}

function emptyHouseOctoSnapshot(): HouseOctoSnapshot {
  return {
    gas: emptyGasSnapshot(),
    electricityLines: emptyElectricityLines(),
  };
}

async function loadHouseOctoPrices(now: Date = new Date()): Promise<HouseOctoSnapshot> {
  try {
    const [gasRates, electricityRates] = await Promise.all([
      loadTodayTomorrowGasRates(now),
      loadTodayTomorrowElectricityRates(now),
    ]);
    return {
      gas: gasSnapshotFromRates(gasRates),
      electricityLines: [
        ...formatElectricityPeriodAvgLines(electricityRates.today),
        ...formatElectricityPeriodAvgLines(electricityRates.tomorrow, "tomorrow"),
      ],
    };
  } catch {
    return emptyHouseOctoSnapshot();
  }
}

async function printOnce(): Promise<void> {
  const now = new Date();
  const dayKey = ukTodayYmd(now);
  const [weather, solar, wfh, temps, houseOcto] = await Promise.all([
    fetchBbcWeatherAggregated(resolveDefaultLocation()),
    loadSolarSnapshot(dayKey, now),
    fetchWfhStatus(),
    loadTemps(),
    loadHouseOctoPrices(now),
  ]);
  const weatherSnapshot = weatherSnapshotFromData(weather, dayKey);
  writeDisplay(
    buildDisplayLines(
      now,
      dayKey,
      weatherSnapshot,
      houseOcto,
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
  let weatherSnapshot = weatherSnapshotFromData(weather, trackedDate);
  let wfh: boolean | null = null;
  let houseOcto = emptyHouseOctoSnapshot();
  let downstairsTemp: number | null = null;
  let shedTemp: number | null = null;
  let solarYield: number | null = null;
  let powerNow: number | null = null;
  let powerHourAvg: number | null = null;
  let lastSolarYieldRefreshAt = 0;
  let lastPowerRefreshAt = 0;
  let lastPowerHourStart = 0;
  let lastTempRefreshAt = 0;
  let lastGasRefreshAt = 0;

  [wfh, { downstairsTemp, shedTemp }, houseOcto] = await Promise.all([
    fetchWfhStatus(),
    loadTemps(),
    loadHouseOctoPrices(),
  ]);
  const startedAt = Date.now();
  lastTempRefreshAt = startedAt;
  lastGasRefreshAt = startedAt;

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
    leaveFullscreen();
    process.exit(0);
  };

  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  enterFullscreen();
  writeDisplay(
    buildDisplayLines(
      new Date(),
      trackedDate,
      weatherSnapshot,
      houseOcto,
      wfh,
      downstairsTemp,
      shedTemp,
      solarYield,
      powerNow,
      powerHourAvg,
    ),
    true,
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
      const needGasRefresh = dayChanged || nowMs - lastGasRefreshAt >= GAS_REFRESH_MS;

      if (dayChanged) {
        trackedDate = today;
        [weather, wfh] = await Promise.all([
          fetchBbcWeatherAggregated(location),
          fetchWfhStatus(),
        ]);
        weatherSnapshot = weatherSnapshotFromData(weather, trackedDate);
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

      if (needGasRefresh) {
        houseOcto = await loadHouseOctoPrices(now);
        lastGasRefreshAt = nowMs;
      }

      writeDisplay(
        buildDisplayLines(
          now,
          trackedDate,
          weatherSnapshot,
          houseOcto,
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
      leaveFullscreen();
      const message = error instanceof Error ? error.message : String(error);
      console.error(message);
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
  leaveFullscreen();
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  console.error("");
  usage();
  process.exit(1);
});

export {};
