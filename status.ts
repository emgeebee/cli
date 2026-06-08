#!/usr/bin/env node

import { getConfigPath } from "./config";
import {
  fetchBbcWeatherAggregated,
  formatNextRainChanceLine,
  formatTodayWeatherLine,
  formatWeatherLine,
  hourlyReportsFromWeather,
  nextRainChance,
  resolveDefaultLocation,
  sunriseSunsetForDate,
  todayWeatherReport,
  ukTodayYmd,
  ukTomorrowYmd,
  weatherReportForDate,
  type BbcWeatherHourlyReport,
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
import { readBdayConfig, upcomingBdaySectionLines, type BdayConfig } from "./lib/bdayApi";
import { formatMoneyLine } from "./lib/moneyApi";
import {
  runStatusShortcut,
  statusShortcutFooter,
  statusShortcutForKey,
  type StatusShortcut,
} from "./lib/commands";
import { fetchWfhStatus, formatWfhLine } from "./lib/wfhApi";
import { enterFullscreen, leaveFullscreen, writeFullscreenLines } from "./lib/terminal";
import {
  enableRawTerminalInput,
  prepareStdinForChildProcess,
  waitForKeypress,
  type TerminalKey,
} from "./lib/terminalInput";

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
  console.log("In a TTY, stays open and updates every second. Shortcuts: s/w/o/c/f/d/b, q to quit.");
  console.log("Piped output prints once.");
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
  hourlyReports: BbcWeatherHourlyReport[];
  sunrise: string;
  sunset: string;
};

function weatherSnapshotFromData(weather: BbcWeatherResponse, todayYmd: string): WeatherSnapshot {
  const tomorrowYmd = ukTomorrowYmd(new Date(`${todayYmd}T12:00:00Z`));
  const todaySun = sunriseSunsetForDate(weather, todayYmd);
  return {
    weatherLine: formatTodayWeatherLine(todayWeatherReport(weather, todayYmd)),
    tomorrowWeatherLine: formatWeatherLine(weatherReportForDate(weather, tomorrowYmd)),
    hourlyReports: hourlyReportsFromWeather(weather),
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

type StatusDisplayState = {
  now: Date;
  todayYmd: string;
  weather: WeatherSnapshot;
  houseOcto: HouseOctoSnapshot;
  bdayConfig: BdayConfig | null;
  wfh: boolean | null;
  downstairsTemp: number | null;
  shedTemp: number | null;
  solarYield: number | null;
  powerNow: number | null;
  powerHourAvg: number | null;
};

function buildStatusLines(state: StatusDisplayState): string[] {
  const now = state.now;
  const todayYmd = state.todayYmd;
  const weather = state.weather;

  return [
    sectionDivider("time"),
    `time: ${formatTime(now)}`,
    `date: ${formatDate(now)}`,
    ...upcomingBdaySectionLines(state.bdayConfig, now, sectionDivider),
    sectionDivider("weather"),
    formatDayWeatherLine("today", weather.weatherLine),
    formatDayWeatherLine("tomorrow", weather.tomorrowWeatherLine),
    formatNextRainChanceLine(
      "next rain >40%",
      nextRainChance(weather.hourlyReports, 40, now),
      todayYmd,
      ukTomorrowYmd(now),
    ),
    formatNextRainChanceLine(
      "next rain >70%",
      nextRainChance(weather.hourlyReports, 70, now),
      todayYmd,
      ukTomorrowYmd(now),
    ),
    formatSunLine("sunrise", weather.sunrise, now, todayYmd),
    formatSunLine("sunset", weather.sunset, now, todayYmd),
    sectionDivider("solar"),
    formatSolarYieldLine(state.solarYield),
    formatSolarNowLine(state.powerNow),
    formatSolarHourAvgLine(state.powerHourAvg, now),
    sectionDivider("house"),
    formatWfhLine(state.wfh),
    formatMoneyLine(now),
    formatRoomTempLine("downstairs temp", state.downstairsTemp),
    formatRoomTempLine("shed temp", state.shedTemp),
    sectionDivider("power"),
    state.houseOcto.gas.todayLine,
    state.houseOcto.gas.tomorrowLine,
    ...state.houseOcto.electricityLines,
    "",
    statusShortcutFooter(),
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
  const bdayConfig = readBdayConfig();
  const [weather, solar, wfh, temps, houseOcto] = await Promise.all([
    fetchBbcWeatherAggregated(resolveDefaultLocation()),
    loadSolarSnapshot(dayKey, now),
    fetchWfhStatus(),
    loadTemps(),
    loadHouseOctoPrices(now),
  ]);
  const weatherSnapshot = weatherSnapshotFromData(weather, dayKey);
  writeDisplay(
    buildStatusLines({
      now,
      todayYmd: dayKey,
      weather: weatherSnapshot,
      houseOcto,
      bdayConfig,
      wfh,
      downstairsTemp: temps.downstairsTemp,
      shedTemp: temps.shedTemp,
      solarYield: solar.yield,
      powerNow: solar.powerNow,
      powerHourAvg: solar.powerHourAvg,
    }),
    false,
  );
}

function handleStatusKey(key: TerminalKey): StatusShortcut | "quit" | null {
  if (key.type === "ctrl-c") {
    return "quit";
  }
  if (key.type !== "char") {
    return null;
  }
  if (key.char === "q") {
    return "quit";
  }
  return statusShortcutForKey(key.char);
}

async function runLive(): Promise<void> {
  const location = resolveDefaultLocation();
  let trackedDate = ukTodayYmd();
  let bdayConfig = readBdayConfig();
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
  let runningCommand = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  let disableRawInput: (() => void) | undefined;

  const displayState = (): StatusDisplayState => ({
    now: new Date(),
    todayYmd: trackedDate,
    weather: weatherSnapshot,
    houseOcto,
    bdayConfig,
    wfh,
    downstairsTemp,
    shedTemp,
    solarYield,
    powerNow,
    powerHourAvg,
  });

  const render = (): void => {
    writeDisplay(buildStatusLines(displayState()), true);
  };

  const stop = (): void => {
    if (timer) clearInterval(timer);
    disableRawInput?.();
    leaveFullscreen();
    process.exit(0);
  };

  const runShortcut = async (shortcut: StatusShortcut): Promise<void> => {
    runningCommand = true;
    if (timer) clearInterval(timer);
    disableRawInput?.();
    leaveFullscreen();
    prepareStdinForChildProcess();
    runStatusShortcut(shortcut);
    await waitForKeypress();
    enterFullscreen();
    disableRawInput = enableRawTerminalInput(onKeys);
    runningCommand = false;
    render();
    timer = setInterval(tick, TICK_MS);
  };

  const onKeys = (keys: TerminalKey[]): void => {
    if (runningCommand) return;
    for (const key of keys) {
      const action = handleStatusKey(key);
      if (action === "quit") {
        stop();
        return;
      }
      if (action) {
        void runShortcut(action);
        return;
      }
    }
  };

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
    const solarStartedAt = Date.now();
    const started = new Date(solarStartedAt);
    ({ yield: solarYield, powerNow, powerHourAvg } = solarSnapshotFromData(data, trackedDate, started));
    lastSolarYieldRefreshAt = solarStartedAt;
    lastPowerRefreshAt = solarStartedAt;
    lastPowerHourStart = ukHourStartMs(started);
  } catch {
    // Non-fatal: solar lines show "-" until a fetch succeeds.
  }

  const tick = (): void => {
    if (runningCommand) return;
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
        bdayConfig = readBdayConfig();
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

      render();
    })().catch((error: unknown) => {
      if (timer) clearInterval(timer);
      disableRawInput?.();
      leaveFullscreen();
      const message = error instanceof Error ? error.message : String(error);
      console.error(message);
      process.exit(1);
    });
  };

  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  enterFullscreen();
  disableRawInput = enableRawTerminalInput(onKeys);
  render();
  timer = setInterval(tick, TICK_MS);
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
