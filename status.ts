#!/usr/bin/env node

import { getConfigPath } from "./config";
import {
  fetchBbcWeatherAggregated,
  resolveDefaultLocation,
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
import {
  formatTodayTomorrowGasLine,
  formatElectricityPeriodAvgTable,
  loadTodayTomorrowElectricityRates,
  loadTodayTomorrowGasRates,
  type OctopusRate,
} from "./lib/octoApi";
import { formatTemperatureText } from "./lib/temperatureColours";
import { readBdayConfig, upcomingBdaySectionLines, type BdayConfig } from "./lib/bdayApi";
import {
  buildStatusCalendarLines,
  loadStatusCalendarData,
  statusCalendarInnerWidth,
  type StatusCalendarData,
} from "./lib/calApi";
import { loadFootballStatusLines } from "./lib/ballApi";
import { loadCricketStatusLines } from "./lib/cricApi";
import { datesSectionLabel } from "./lib/moneyApi";
import {
  runStatusShortcut,
  statusShortcutFooter,
  statusShortcutFooterWidth,
  statusShortcutForKey,
  type StatusShortcut,
} from "./lib/commands";
import { fetchWfhStatus, houseSectionLabel } from "./lib/wfhApi";
import { buildFullWeatherLines, type WeatherResponse } from "./lib/wApi";
import {
  enterFullscreen,
  leaveFullscreen,
  maxCalendarContentLines,
  type FullscreenPanelLines,
  writeFullscreenLines,
} from "./lib/terminal";
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

function formatSolarYieldLine(solarYield: number | null): string {
  return `solar yield: ${solarYield == null ? "-" : formatColoredKwh(solarYield)}`;
}

function formatSolarPowerLine(
  powerNow: number | null,
  powerAvg: number | null,
  now: Date,
): string {
  const nowText = powerNow == null ? "-" : formatColoredWattsPrecise(powerNow);
  const avgText = powerAvg == null ? "-" : formatColoredWattsPrecise(powerAvg);
  const hourLabel = formatUkHourLabel(ukHourStartMs(now));
  return `solar: ${nowText} // avg (${hourLabel}): ${avgText}`;
}

function formatHouseTempsLine(downstairsTemp: number | null, shedTemp: number | null): string {
  const kitchen = formatTemperatureText(downstairsTemp, { fractionDigits: 0, unknownText: "-" });
  const shed = formatTemperatureText(shedTemp, { fractionDigits: 0, unknownText: "-" });
  return `temp: ${kitchen} (kitchen) // ${shed} (shed)`;
}

function sectionDivider(name: string): string {
  return `── ${name} ──`;
}

function sectionBreak(name: string): string[] {
  return ["", sectionDivider(name)];
}

type GasSnapshot = {
  line: string;
};

type HouseOctoSnapshot = {
  gas: GasSnapshot;
  electricityLines: string[];
};

type StatusDisplayState = {
  now: Date;
  todayYmd: string;
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

  return [
    ...sectionBreak(datesSectionLabel(now)),
    `time: ${formatTime(now)}, ${formatDate(now)}`,
    ...upcomingBdaySectionLines(state.bdayConfig, now),
    ...sectionBreak("solar"),
    formatSolarYieldLine(state.solarYield),
    formatSolarPowerLine(state.powerNow, state.powerHourAvg, now),
    ...sectionBreak(houseSectionLabel(now, state.wfh)),
    formatHouseTempsLine(state.downstairsTemp, state.shedTemp),
    state.houseOcto.gas.line,
    ...state.houseOcto.electricityLines,
    "",
    statusShortcutFooter(),
  ];
}

function buildSportsPanelLines(title: string, lines: string[]): string[] {
  return ["", sectionDivider(title), ...lines];
}

async function loadFullWeatherLines(location: string): Promise<string[]> {
  const data = (await fetchBbcWeatherAggregated(location)) as WeatherResponse;
  return buildFullWeatherLines(data, location);
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

function writeDisplay(
  statusLines: string[],
  fullscreen: boolean,
  panels: FullscreenPanelLines = {},
): void {
  if (fullscreen) {
    writeFullscreenLines(statusLines, statusShortcutFooterWidth(), panels);
    return;
  }
  for (const line of statusLines) {
    console.log(line);
  }
  if (panels.weatherLines) {
    for (const line of panels.weatherLines) {
      console.log(line);
    }
  }
  if (panels.cricLines) {
    for (const line of panels.cricLines) {
      console.log(line);
    }
  }
  if (panels.footyLines) {
    for (const line of panels.footyLines) {
      console.log(line);
    }
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
    line: formatTodayTomorrowGasLine([], []),
  };
}

function gasSnapshotFromRates(rates: {
  today: OctopusRate[];
  tomorrow: OctopusRate[];
}): GasSnapshot {
  return {
    line: formatTodayTomorrowGasLine(rates.today, rates.tomorrow),
  };
}

function emptyElectricityLines(): string[] {
  return [];
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
      electricityLines: formatElectricityPeriodAvgTable(
        electricityRates.today,
        electricityRates.tomorrow,
      ),
    };
  } catch {
    return emptyHouseOctoSnapshot();
  }
}

async function loadSportsLines(ymd: string): Promise<{ cricLines: string[]; footyLines: string[] }> {
  const [cricResult, footyResult] = await Promise.allSettled([
    loadCricketStatusLines(ymd),
    loadFootballStatusLines(ymd),
  ]);
  return {
    cricLines: cricResult.status === "fulfilled" ? cricResult.value : ["-"],
    footyLines: footyResult.status === "fulfilled" ? footyResult.value : ["-"],
  };
}

async function printOnce(): Promise<void> {
  const now = new Date();
  const dayKey = ukTodayYmd(now);
  const bdayConfig = readBdayConfig();
  const location = resolveDefaultLocation();
  const [weatherLines, solar, wfh, temps, houseOcto, sports] = await Promise.all([
    loadFullWeatherLines(location),
    loadSolarSnapshot(dayKey, now),
    fetchWfhStatus(),
    loadTemps(),
    loadHouseOctoPrices(now),
    loadSportsLines(dayKey),
  ]);
  writeDisplay(
    buildStatusLines({
      now,
      todayYmd: dayKey,
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
    {
      weatherLines,
      cricLines: buildSportsPanelLines("cric", sports.cricLines),
      footyLines: buildSportsPanelLines("footy", sports.footyLines),
    },
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
  let fullWeatherLines: string[] = [];
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
  let calendarData: StatusCalendarData | null = null;
  let cricLines: string[] = ["-"];
  let footyLines: string[] = ["-"];
  let runningCommand = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  let disableRawInput: (() => void) | undefined;

  const displayState = (): StatusDisplayState => ({
    now: new Date(),
    todayYmd: trackedDate,
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
    const state = displayState();
    const boxWidth = statusShortcutFooterWidth();
    const calendarWidth = statusCalendarInnerWidth();
    const statusLines = buildStatusLines(state);
    const calendarLines = calendarData
      ? buildStatusCalendarLines(
          calendarData.months,
          state.now,
          calendarData.colors,
          maxCalendarContentLines(statusLines.length, true),
          calendarWidth,
        )
      : null;
    writeDisplay(statusLines, true, {
      calendarLines,
      calendarInnerWidth: calendarWidth,
      weatherLines: fullWeatherLines.length > 0 ? fullWeatherLines : null,
      cricLines: buildSportsPanelLines("cric", cricLines),
      footyLines: buildSportsPanelLines("footy", footyLines),
    });
  };

  const refreshWeather = async (): Promise<void> => {
    fullWeatherLines = await loadFullWeatherLines(location);
  };

  const refreshCalendar = async (now: Date): Promise<void> => {
    calendarData = await loadStatusCalendarData(now);
  };

  const refreshSports = async (ymd: string): Promise<void> => {
    ({ cricLines, footyLines } = await loadSportsLines(ymd));
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

  [wfh, { downstairsTemp, shedTemp }, houseOcto, calendarData, { cricLines, footyLines }] =
    await Promise.all([
      fetchWfhStatus(),
      loadTemps(),
      loadHouseOctoPrices(),
      loadStatusCalendarData(),
      loadSportsLines(trackedDate),
    ]);
  try {
    await refreshWeather();
  } catch {
    fullWeatherLines = ["weather unavailable"];
  }
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
        [, wfh] = await Promise.all([
          refreshWeather().catch(() => {
            fullWeatherLines = ["weather unavailable"];
          }),
          fetchWfhStatus(),
          refreshCalendar(now),
          refreshSports(today),
        ]);
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
