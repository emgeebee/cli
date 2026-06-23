#!/usr/bin/env node

import { getConfigPath } from "./config";
import {
  fetchBbcWeatherAggregated,
  formatSunriseSunsetStatusLine,
  resolveDefaultLocation,
  todaySunriseSunset,
  ukTodayYmd,
} from "./lib/bbcWeather";
import {
  currentHourPowerAvgWatts,
  fetchSolarData,
  formatColoredKwh,
  powerNowWatts,
  todayYieldKwh,
  ukHourStartMs,
  type SolarResponse,
} from "./lib/solarApi";
import {
  solarMonthlyYieldRowsFromData,
  type SolarMonthlyYieldRow,
} from "./lib/solarMonthlyYield";
import {
  buildSolarPanelLines,
  formatSolarStatusPowerLines,
  yieldAveragesFromData,
  type YieldAverage,
} from "./lib/solarView";
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
  type StatusCalendarData,
} from "./lib/calApi";
import {
  fitFootballStatusLines,
  fitPanelContentLines,
  loadFootballStatusLines,
  loadPremierLeagueTableStatusLines,
  loadVillaFixturesStatusLines,
} from "./lib/ballApi";
import { loadCricketStatusLines } from "./lib/cricApi";
import {
  buildCmdMenuLines,
  CMD_MENU_INNER_WIDTH,
  deviceForKey,
  isWfhMenuKey,
  roomForKey,
  stateForKey,
  triggerCmdTarget,
  triggerWfhToggle,
  type CmdDevice,
  type CmdMenuSelection,
  type CmdMenuStep,
  type CmdRoom,
  type CmdState,
} from "./lib/cmdApi";
import { moneyRemaining } from "./lib/moneyApi";
import {
  buildAllShortcutsMenuLines,
  buildStatusBarShortcutLines,
  runStatusShortcut,
  SHORTCUTS_MENU_INNER_WIDTH,
  statusShortcutForKey,
  type StatusShortcut,
} from "./lib/commands";
import { fetchWfhStatus, houseSectionLabel } from "./lib/wfhApi";
import { buildFullWeatherLines, withWeatherPanelCountdown, type WeatherResponse } from "./lib/wApi";
import {
  enterFullscreen,
  leaveFullscreen,
  maxCalendarContentLines,
  maxCompactPanelBodyLines,
  resolveStatusLayoutTier,
  shouldStackCalendarUnderStatus,
  isStatusOnlyTerminal,
  statusLayoutInnerWidth,
  statusSideColumnInnerWidth,
  writeCenteredBox,
  emptyFullscreenPaginationState,
  type CompactRotatePanel,
  type SportsRotatePanel,
  type FullscreenPanelLines,
  type FullscreenPaginationState,
  type StatusLayoutTier,
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
const PANEL_ALTERNATE_MS = 15_000;
const SOLAR_YIELD_REFRESH_MS = 30 * 60 * 1000;
const SOLAR_POWER_REFRESH_MS = 10 * 60 * 1000;
const TEMP_REFRESH_MS = 10 * 60 * 1000;
const GAS_REFRESH_MS = 30 * 60 * 1000;
const CRICKET_REFRESH_MS = 5 * 60 * 1000;
const PL_TABLE_REFRESH_MS = 30 * 60 * 1000;
const VILLA_REFRESH_MS = 30 * 60 * 1000;

function usage(): void {
  console.log("Usage:");
  console.log("  status");
  console.log("");
  console.log("In a TTY, stays open and updates every second. Bar: a/c/n/p/q; a opens full shortcut menu.");
  console.log("Piped output prints once.");
  console.log(`Uses defaultLocation from ${getConfigPath()} for sunrise/sunset (falls back to cm2).`);
  console.log("Solar daily yield refreshes every 30 minutes.");
  console.log("Solar power now and hourly average refresh every 10 minutes.");
  console.log("Downstairs and shed temperatures refresh every 10 minutes.");
  console.log("Gas and electricity prices refresh every 30 minutes (requires octo config).");
  console.log("Cricket scores refresh every 5 minutes.");
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
  return `Solar Yield: ${solarYield == null ? "-" : formatColoredKwh(solarYield)}`;
}

function formatHouseTempsLine(downstairsTemp: number | null, shedTemp: number | null): string {
  const kitchen = formatTemperatureText(downstairsTemp, { fractionDigits: 0, unknownText: "-" });
  const shed = formatTemperatureText(shedTemp, { fractionDigits: 0, unknownText: "-" });
  return `Temp: ${kitchen} (Kitchen) // ${shed} (Shed)`;
}

function statusBoxTitle(now: Date): string {
  const date = formatDate(now);
  const remaining = moneyRemaining(now);
  const money = remaining == null ? "-" : String(remaining);
  return `=== Status (${date}) // ${money} ===`;
}

function capitalizeHouseSection(label: string): string {
  return label.replace(/\b[a-z]/g, (char) => char.toUpperCase());
}

function capitalizeGasLine(line: string): string {
  return line
    .replace(/^today gas:/i, "Today Gas:")
    .replace(/, tomorrow gas:/i, ", Tomorrow Gas:");
}

function capitalizeBdayLine(line: string): string {
  return line
    .replace(/: today /i, ": Today ")
    .replace(/\(in /gi, "(In ")
    .replace(/, turns /i, ", Turns ");
}

function capitalizeElectricityLines(lines: string[]): string[] {
  return lines.map((line) =>
    line
      .replace("| day ", "| Day ")
      .replace("| today ", "| Today ")
      .replace("| tomorrow ", "| Tomorrow "),
  );
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
  sunrise: string;
  sunset: string;
  houseOcto: HouseOctoSnapshot;
  bdayConfig: BdayConfig | null;
  wfh: boolean | null;
  downstairsTemp: number | null;
  shedTemp: number | null;
  solarYield: number | null;
  powerNow: number | null;
  powerHourAvg: number | null;
  yieldAverages: YieldAverage[] | null;
  monthlyYields: SolarMonthlyYieldRow[] | null;
};

function buildStatusLines(state: StatusDisplayState): string[] {
  const now = state.now;

  return [
    statusBoxTitle(now),
    "",
    `Time: ${formatTime(now)}`,
    formatSunriseSunsetStatusLine(state.sunrise, state.sunset, now, state.todayYmd),
    ...upcomingBdaySectionLines(state.bdayConfig, now).map(capitalizeBdayLine),
    ...sectionBreak("Solar"),
    formatSolarYieldLine(state.solarYield),
    ...formatSolarStatusPowerLines(
      state.powerNow,
      state.powerHourAvg,
      now,
      state.yieldAverages,
      state.monthlyYields,
    ),
    ...sectionBreak(capitalizeHouseSection(houseSectionLabel(now, state.wfh))),
    formatHouseTempsLine(state.downstairsTemp, state.shedTemp),
    capitalizeGasLine(state.houseOcto.gas.line),
    ...capitalizeElectricityLines(state.houseOcto.electricityLines),
  ];
}

function isWeatherPanelReady(lines: string[]): boolean {
  return lines.length > 0 && lines[0].startsWith("=== Weather");
}

function isSolarPanelReady(lines: string[]): boolean {
  return lines.length > 0 && lines[0].startsWith("=== Solar");
}

const SPORTS_PANEL_NAMES: Record<SportsRotatePanel, string> = {
  cric: "Cricket",
  footy: "Football",
  plTable: "PL Table",
  villa: "Villa",
};

const COMPACT_PANEL_LABELS: Record<CompactRotatePanel, string> = {
  weather: "Weather",
  solar: "Solar",
  cric: "Cricket",
  footy: "Football",
  plTable: "PL Table",
  villa: "Villa",
  calendar: "Dates",
};

function buildSportsRotationPool(
  hasCric: boolean,
  hasFooty: boolean,
  hasPlTable: boolean,
  hasVilla: boolean,
): SportsRotatePanel[] {
  const pool: SportsRotatePanel[] = [];
  if (hasCric) pool.push("cric");
  if (hasFooty) pool.push("footy");
  if (hasPlTable) pool.push("plTable");
  if (hasVilla) pool.push("villa");
  return pool;
}

function buildCompactRotationPool(
  stackCalendar: boolean,
  calendarLines: string[] | null,
  hasWeather: boolean,
  hasSolar: boolean,
  hasCric: boolean,
  hasFooty: boolean,
  hasPlTable: boolean,
  hasVilla: boolean,
): CompactRotatePanel[] {
  const pool: CompactRotatePanel[] = [];
  if (!stackCalendar && calendarLines && calendarLines.length > 0) pool.push("calendar");
  if (hasWeather) pool.push("weather");
  if (hasFooty) pool.push("footy");
  if (hasCric) pool.push("cric");
  if (hasPlTable) pool.push("plTable");
  if (hasVilla) pool.push("villa");
  if (hasSolar) pool.push("solar");
  return pool;
}

function rotationNextLabel(next: string, seconds: number, paused: boolean): string {
  return paused ? `${next} paused` : `${next} in ${seconds}`;
}

function withCompactPanelCountdown(
  lines: string[],
  countdown?: { seconds: number; next: CompactRotatePanel; paused?: boolean },
): string[] {
  if (!countdown || lines.length === 0) return lines;
  const label = COMPACT_PANEL_LABELS[countdown.next];
  const suffix = rotationNextLabel(label, countdown.seconds, countdown.paused ?? false);
  const line = lines[0];
  if (line.startsWith("── ") && line.endsWith(" ──")) {
    const name = line.slice(3, -3);
    return [`── ${name} (${suffix}, n) ──`, ...lines.slice(1)];
  }
  const title = line.replace(/ ===$/, ` (${suffix}, n) ===`);
  return [title, ...lines.slice(1)];
}

function usesCompactRotation(tier: StatusLayoutTier): boolean {
  return tier === "compact" || tier === "stacked" || tier === "twoColumn";
}

function renderAllShortcutsMenu(): void {
  writeCenteredBox(buildAllShortcutsMenuLines(), SHORTCUTS_MENU_INNER_WIDTH);
}

function isSportsPanelVisible(
  tier: StatusLayoutTier,
  panel: SportsRotatePanel,
  hasPanel: boolean,
  compactDisplay: CompactRotatePanel | undefined,
  sportsDisplay: SportsRotatePanel | undefined,
): boolean {
  if (tier === "statusOnly" || !hasPanel) return false;
  if (usesCompactRotation(tier)) {
    return compactDisplay === panel;
  }
  if (tier === "threeColumn") {
    return sportsDisplay === panel;
  }
  if (tier === "full") {
    return true;
  }
  return false;
}

function sportsPanelHasContent(lines: string[]): boolean {
  if (lines.length === 0 || lines[0] === "-" || lines[0] === "none") return false;
  if (lines.length === 1 && lines[0] === "none today") return false;
  return true;
}

function cricketPanelAvailable(lines: string[]): boolean {
  return lines.length > 0 && lines[0] !== "-";
}

function plTablePanelAvailable(lines: string[]): boolean {
  return lines.length > 0 && lines[0] !== "-";
}

function buildSportsPanelLines(
  panel: SportsRotatePanel,
  lines: string[],
  countdown?: { seconds: number; next: SportsRotatePanel; paused?: boolean },
): string[] {
  const title = SPORTS_PANEL_NAMES[panel];
  const heading = countdown
    ? `=== ${title} (${rotationNextLabel(SPORTS_PANEL_NAMES[countdown.next], countdown.seconds, countdown.paused ?? false)}, n) ===`
    : sectionDivider(title);
  const body = [heading, "", ...lines];
  return body;
}

async function loadWeatherSnapshot(
  location: string,
  todayYmd: string,
): Promise<{ lines: string[]; sunrise: string; sunset: string }> {
  const data = (await fetchBbcWeatherAggregated(location)) as WeatherResponse;
  const { sunrise, sunset } = todaySunriseSunset(data, todayYmd);
  const lines = await buildFullWeatherLines(data, location);
  return { lines, sunrise, sunset };
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
): FullscreenPaginationState {
  if (fullscreen) {
    return writeFullscreenLines(statusLines, statusLayoutInnerWidth(), panels);
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
  if (panels.plTableLines) {
    for (const line of panels.plTableLines) {
      console.log(line);
    }
  }
  if (panels.villaLines) {
    for (const line of panels.villaLines) {
      console.log(line);
    }
  }
  return emptyFullscreenPaginationState();
}

async function loadSolarSnapshot(dayKey: string, now: Date): Promise<{
  yield: number | null;
  powerNow: number | null;
  powerHourAvg: number | null;
  yieldAverages: YieldAverage[] | null;
  monthlyYields: SolarMonthlyYieldRow[] | null;
}> {
  try {
    const data = await fetchSolarData();
    return {
      ...solarSnapshotFromData(data, dayKey, now),
      yieldAverages: yieldAveragesFromData(data),
      monthlyYields: solarMonthlyYieldRowsFromData(data, now),
    };
  } catch {
    return {
      yield: null,
      powerNow: null,
      powerHourAvg: null,
      yieldAverages: null,
      monthlyYields: null,
    };
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
  const [weatherSnapshot, solar, wfh, temps, houseOcto, sports, plTableLines, villaLines] = await Promise.all([
    loadWeatherSnapshot(location, dayKey),
    loadSolarSnapshot(dayKey, now),
    fetchWfhStatus(),
    loadTemps(),
    loadHouseOctoPrices(now),
    loadSportsLines(dayKey),
    loadPremierLeagueTableStatusLines(),
    loadVillaFixturesStatusLines(),
  ]);
  writeDisplay(
    buildStatusLines({
      now,
      todayYmd: dayKey,
      sunrise: weatherSnapshot.sunrise,
      sunset: weatherSnapshot.sunset,
      houseOcto,
      bdayConfig,
      wfh,
      downstairsTemp: temps.downstairsTemp,
      shedTemp: temps.shedTemp,
      solarYield: solar.yield,
      powerNow: solar.powerNow,
      powerHourAvg: solar.powerHourAvg,
      yieldAverages: solar.yieldAverages,
      monthlyYields: solar.monthlyYields,
    }),
    false,
    {
      weatherLines: weatherSnapshot.lines,
      cricLines: buildSportsPanelLines("cric", sports.cricLines),
      footyLines: buildSportsPanelLines("footy", sports.footyLines),
      plTableLines: plTablePanelAvailable(plTableLines)
        ? buildSportsPanelLines("plTable", plTableLines)
        : null,
      villaLines: sportsPanelHasContent(villaLines)
        ? buildSportsPanelLines("villa", villaLines)
        : null,
    },
  );
}

function handleStatusKey(key: TerminalKey): StatusShortcut | "quit" | "flip-next" | "toggle-pause" | "shortcuts-menu" | "cmd-menu" | null {
  if (key.type === "ctrl-c") {
    return "quit";
  }
  if (key.type !== "char") {
    return null;
  }
  if (key.char === "q") {
    return "quit";
  }
  if (key.char === "c") {
    return "cmd-menu";
  }
  if (key.char === "n") {
    return "flip-next";
  }
  if (key.char === "p") {
    return "toggle-pause";
  }
  if (key.char === "a") {
    return "shortcuts-menu";
  }
  return statusShortcutForKey(key.char);
}

type CmdMenuState =
  | { active: false }
  | { active: true; step: "top" }
  | { active: true; step: "device"; room: CmdRoom }
  | { active: true; step: "state"; room: CmdRoom; device: CmdDevice }
  | { active: true; step: "running" }
  | { active: true; step: "done"; message: string }
  | { active: true; step: "error"; message: string };

function cmdMenuSelection(state: CmdMenuState): CmdMenuSelection {
  if (!state.active) return {};
  if (state.step === "device" || state.step === "state") {
    const selection: CmdMenuSelection = { room: state.room };
    if (state.step === "state") {
      selection.device = state.device;
    }
    return selection;
  }
  return {};
}

function renderCmdMenu(state: CmdMenuState): void {
  if (!state.active) return;
  const step: CmdMenuStep = state.step;
  const message = state.step === "done" || state.step === "error" ? state.message : undefined;
  writeCenteredBox(buildCmdMenuLines(step, cmdMenuSelection(state), message), CMD_MENU_INNER_WIDTH);
}

async function runCmdMenuAction(
  room: CmdRoom,
  device: CmdDevice,
  state: CmdState,
  onUpdate: (next: CmdMenuState) => void,
): Promise<void> {
  onUpdate({ active: true, step: "running" });
  try {
    const message = await triggerCmdTarget({ room, device, state });
    onUpdate({ active: true, step: "done", message });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    onUpdate({ active: true, step: "error", message });
  }
}

async function runCmdMenuWfh(
  onUpdate: (next: CmdMenuState) => void,
  onWfhChanged: (wfh: boolean) => void,
): Promise<void> {
  onUpdate({ active: true, step: "running" });
  try {
    const { message, wfh } = await triggerWfhToggle();
    onWfhChanged(wfh);
    onUpdate({ active: true, step: "done", message });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    onUpdate({ active: true, step: "error", message });
  }
}

async function runLive(): Promise<void> {
  const location = resolveDefaultLocation();
  let trackedDate = ukTodayYmd();
  let bdayConfig = readBdayConfig();
  let fullWeatherLines: string[] = [];
  let sunrise = "-";
  let sunset = "-";
  let wfh: boolean | null = null;
  let houseOcto = emptyHouseOctoSnapshot();
  let downstairsTemp: number | null = null;
  let shedTemp: number | null = null;
  let solarYield: number | null = null;
  let powerNow: number | null = null;
  let powerHourAvg: number | null = null;
  let yieldAverages: YieldAverage[] | null = null;
  let monthlyYields: SolarMonthlyYieldRow[] | null = null;
  let lastSolarYieldRefreshAt = 0;
  let lastPowerRefreshAt = 0;
  let lastPowerHourStart = 0;
  let lastTempRefreshAt = 0;
  let lastGasRefreshAt = 0;
  let lastCricRefreshAt = 0;
  let lastPlTableRefreshAt = 0;
  let lastVillaRefreshAt = 0;
  let calendarData: StatusCalendarData | null = null;
  let cricLines: string[] = ["-"];
  let footyLines: string[] = ["-"];
  let plTableLines: string[] = ["-"];
  let villaLines: string[] = ["-"];
  let solarData: SolarResponse | null = null;
  let sportsRotatePhase: SportsRotatePanel = "cric";
  let lastSportsAlternateAt = Date.now();
  let middleAlternatePhase: "weather" | "solar" = "weather";
  let lastMiddleAlternateAt = Date.now();
  let compactRotatePhase: CompactRotatePanel = "weather";
  let lastCompactRotateAt = Date.now();
  let rotationPaused = false;
  let rotationPausedAt = 0;
  let footyPanelWasVisible: boolean | null = null;
  let villaPanelWasVisible: boolean | null = null;
  let footyRefreshGeneration = 0;
  let villaRefreshGeneration = 0;
  let cmdMenuState: CmdMenuState = { active: false };
  let shortcutsMenuOpen = false;
  let runningCommand = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  let disableRawInput: (() => void) | undefined;
  let panelPageOffsets: Record<string, number> = {};
  let latestPagination = emptyFullscreenPaginationState();

  const displayState = (): StatusDisplayState => ({
    now: new Date(),
    todayYmd: trackedDate,
    sunrise,
    sunset,
    houseOcto,
    bdayConfig,
    wfh,
    downstairsTemp,
    shedTemp,
    solarYield,
    powerNow,
    powerHourAvg,
    yieldAverages,
    monthlyYields,
  });

  const render = (): void => {
    if (shortcutsMenuOpen) {
      latestPagination = emptyFullscreenPaginationState();
      renderAllShortcutsMenu();
      return;
    }

    if (cmdMenuState.active) {
      latestPagination = emptyFullscreenPaginationState();
      renderCmdMenu(cmdMenuState);
      return;
    }

    const state = displayState();
    const panelWidth = statusLayoutInnerWidth();
    const statusLines = buildStatusLines(state);
    const shortcutContentLineCount = 1;
    const calendarLines = calendarData
      ? buildStatusCalendarLines(
          calendarData.months,
          state.now,
          calendarData.colors,
          maxCalendarContentLines(statusLines.length, true, shortcutContentLineCount),
          panelWidth,
        )
      : null;

    const baseWeatherPanel = fullWeatherLines;
    const baseSolarPanel = solarData
      ? buildSolarPanelLines(solarData, undefined, panelWidth, monthlyYields ?? [])
      : [];
    const hasWeather = isWeatherPanelReady(baseWeatherPanel);
    const hasSolar = isSolarPanelReady(baseSolarPanel);
    const hasCric = cricketPanelAvailable(cricLines);
    const hasFootyRaw = sportsPanelHasContent(footyLines);
    const hasPlTableRaw = plTablePanelAvailable(plTableLines);
    const hasVillaRaw = sportsPanelHasContent(villaLines);
    const statusOnly = isStatusOnlyTerminal();
    const stackCalendar =
      !statusOnly &&
      shouldStackCalendarUnderStatus(statusLines.length, shortcutContentLineCount) &&
      Boolean(calendarLines?.length);

    const tier = statusOnly
      ? "statusOnly"
      : resolveStatusLayoutTier(statusLines.length, panelWidth, {
          calendarLines,
          calendarInnerWidth: panelWidth,
          weatherLines: hasWeather ? baseWeatherPanel : null,
          solarLines: hasSolar ? baseSolarPanel : null,
          cricLines: hasCric ? buildSportsPanelLines("cric", cricLines) : null,
          footyLines: hasFootyRaw ? buildSportsPanelLines("footy", footyLines) : null,
          plTableLines: hasPlTableRaw ? buildSportsPanelLines("plTable", plTableLines) : null,
          villaLines: hasVillaRaw ? buildSportsPanelLines("villa", villaLines) : null,
        });

    const sidePanelWidth =
      tier === "threeColumn" || tier === "full"
        ? statusSideColumnInnerWidth(panelWidth)
        : panelWidth;
    const preFitSportsPanels = tier === "statusOnly" || tier === "compact" || tier === "stacked";
    const shortcutPlaceholder = ["-"];
    const maxFootyLines = preFitSportsPanels
      ? maxCompactPanelBodyLines(
          tier,
          sidePanelWidth,
          statusLines,
          calendarLines,
          stackCalendar,
          panelWidth,
          shortcutPlaceholder,
        )
      : Number.POSITIVE_INFINITY;
    const fittedFootyLines = preFitSportsPanels
      ? fitFootballStatusLines(footyLines, maxFootyLines)
      : footyLines;
    const fittedVillaLines = preFitSportsPanels
      ? fitFootballStatusLines(villaLines, maxFootyLines)
      : villaLines;
    const fittedPlTableLines = preFitSportsPanels
      ? fitPanelContentLines(plTableLines, maxFootyLines)
      : plTableLines;
    const hasFooty = sportsPanelHasContent(fittedFootyLines);
    const hasPlTable = plTablePanelAvailable(fittedPlTableLines);
    const hasVilla = sportsPanelHasContent(fittedVillaLines);
    const baseCricPanel = buildSportsPanelLines("cric", cricLines);
    const baseFootyPanel = buildSportsPanelLines("footy", fittedFootyLines);
    const basePlTablePanel = buildSportsPanelLines("plTable", fittedPlTableLines);
    const baseVillaPanel = buildSportsPanelLines("villa", fittedVillaLines);

    const compactPool = buildCompactRotationPool(
      stackCalendar,
      calendarLines,
      hasWeather,
      hasSolar,
      hasCric,
      hasFooty,
      hasPlTable,
      hasVilla,
    );
    let compactDisplay: CompactRotatePanel | undefined;
    let compactSwitchCountdown:
      | { seconds: number; next: CompactRotatePanel; paused?: boolean }
      | undefined;
    if (usesCompactRotation(tier) && compactPool.length > 0) {
      if (!compactPool.includes(compactRotatePhase)) {
        compactRotatePhase = compactPool[0];
      }
      if (compactPool.length > 1) {
        const nowMs = rotationPaused ? rotationPausedAt : Date.now();
        if (!rotationPaused && nowMs - lastCompactRotateAt >= PANEL_ALTERNATE_MS) {
          const index = compactPool.indexOf(compactRotatePhase);
          compactRotatePhase = compactPool[(index + 1) % compactPool.length];
          lastCompactRotateAt = nowMs;
        }
        compactDisplay = compactRotatePhase;
        const secondsLeft = Math.max(
          0,
          Math.ceil((PANEL_ALTERNATE_MS - (nowMs - lastCompactRotateAt)) / 1000),
        );
        const nextIndex = (compactPool.indexOf(compactRotatePhase) + 1) % compactPool.length;
        compactSwitchCountdown = {
          seconds: secondsLeft,
          next: compactPool[nextIndex],
          paused: rotationPaused,
        };
      } else {
        compactDisplay = compactPool[0];
      }
    }

    let sportsDisplay: SportsRotatePanel | undefined;
    let sportsSwitchCountdown:
      | { seconds: number; next: SportsRotatePanel; paused?: boolean }
      | undefined;
    const sportsPool = buildSportsRotationPool(hasCric, hasFooty, hasPlTable, hasVilla);
    if (tier === "threeColumn" && sportsPool.length > 0) {
      if (!sportsPool.includes(sportsRotatePhase)) {
        sportsRotatePhase = sportsPool[0];
      }
      if (sportsPool.length > 1) {
        const nowMs = rotationPaused ? rotationPausedAt : Date.now();
        if (!rotationPaused && nowMs - lastSportsAlternateAt >= PANEL_ALTERNATE_MS) {
          const index = sportsPool.indexOf(sportsRotatePhase);
          sportsRotatePhase = sportsPool[(index + 1) % sportsPool.length];
          lastSportsAlternateAt = nowMs;
        }
        sportsDisplay = sportsRotatePhase;
        const secondsLeft = Math.max(
          0,
          Math.ceil((PANEL_ALTERNATE_MS - (nowMs - lastSportsAlternateAt)) / 1000),
        );
        const nextIndex = (sportsPool.indexOf(sportsRotatePhase) + 1) % sportsPool.length;
        sportsSwitchCountdown = {
          seconds: secondsLeft,
          next: sportsPool[nextIndex],
          paused: rotationPaused,
        };
      } else {
        sportsDisplay = sportsPool[0];
      }
    }

    const cricPanel =
      tier === "threeColumn" && sportsDisplay === "cric" && sportsSwitchCountdown
        ? buildSportsPanelLines("cric", cricLines, sportsSwitchCountdown)
        : baseCricPanel;
    const footyPanel =
      tier === "threeColumn" && sportsDisplay === "footy" && sportsSwitchCountdown
        ? buildSportsPanelLines("footy", fittedFootyLines, sportsSwitchCountdown)
        : baseFootyPanel;
    const plTablePanel =
      tier === "threeColumn" && sportsDisplay === "plTable" && sportsSwitchCountdown
        ? buildSportsPanelLines("plTable", fittedPlTableLines, sportsSwitchCountdown)
        : basePlTablePanel;
    const villaPanel =
      tier === "threeColumn" && sportsDisplay === "villa" && sportsSwitchCountdown
        ? buildSportsPanelLines("villa", fittedVillaLines, sportsSwitchCountdown)
        : baseVillaPanel;

    const canAlternateMiddle = hasWeather && hasSolar;
    let middleDisplay: "weather" | "solar" = "weather";
    let middleSwitchCountdown:
      | { seconds: number; next: "weather" | "solar"; paused?: boolean }
      | undefined;
    if (tier === "threeColumn" && canAlternateMiddle) {
      const nowMs = rotationPaused ? rotationPausedAt : Date.now();
      if (!rotationPaused && nowMs - lastMiddleAlternateAt >= PANEL_ALTERNATE_MS) {
        middleAlternatePhase = middleAlternatePhase === "weather" ? "solar" : "weather";
        lastMiddleAlternateAt = nowMs;
      }
      middleDisplay = middleAlternatePhase;
      const secondsLeft = Math.max(
        0,
        Math.ceil((PANEL_ALTERNATE_MS - (nowMs - lastMiddleAlternateAt)) / 1000),
      );
      middleSwitchCountdown = {
        seconds: secondsLeft,
        next: middleAlternatePhase === "weather" ? "solar" : "weather",
        paused: rotationPaused,
      };
    } else if (hasSolar && !hasWeather) {
      middleDisplay = "solar";
    }

    const weatherPanel =
      tier === "threeColumn" && middleDisplay === "weather" && middleSwitchCountdown
        ? withWeatherPanelCountdown(baseWeatherPanel, {
            seconds: middleSwitchCountdown.seconds,
            next: "solar",
            paused: middleSwitchCountdown.paused,
          })
        : baseWeatherPanel;
    const solarPanel =
      tier === "threeColumn" && middleDisplay === "solar" && solarData
        ? buildSolarPanelLines(
            solarData,
            middleSwitchCountdown
              ? {
                  seconds: middleSwitchCountdown.seconds,
                  next: "weather",
                  paused: middleSwitchCountdown.paused,
                }
              : undefined,
            sidePanelWidth,
            monthlyYields ?? [],
          )
        : baseSolarPanel;

    const shortcutLines = buildStatusBarShortcutLines();

    const compactCountdown = compactSwitchCountdown;
    const panelLines = (
      panel: CompactRotatePanel,
      lines: string[],
      allowWide: boolean,
    ): string[] | null => {
      if (!lines.length) return null;
      if (usesCompactRotation(tier)) {
        if (compactDisplay !== panel) return null;
        return withCompactPanelCountdown(lines, compactCountdown);
      }
      if (!allowWide) return null;
      return lines;
    };

    latestPagination = writeDisplay(statusLines, true, {
      layoutTier: tier,
      stackCalendar,
      compactDisplay,
      pageOffsets: panelPageOffsets,
      calendarLines,
      calendarInnerWidth: panelWidth,
      shortcutLines,
      weatherLines: panelLines("weather", weatherPanel, tier === "full" || tier === "threeColumn"),
      solarLines: panelLines("solar", solarPanel, tier === "full" || tier === "threeColumn"),
      middleDisplay: tier === "threeColumn" ? middleDisplay : undefined,
      cricLines: panelLines("cric", cricPanel, tier === "full" || tier === "threeColumn"),
      footyLines: panelLines("footy", footyPanel, tier === "full" || tier === "threeColumn"),
      plTableLines: panelLines("plTable", plTablePanel, tier === "full" || tier === "threeColumn"),
      villaLines: panelLines("villa", villaPanel, tier === "full" || tier === "threeColumn"),
      sportsDisplay: tier === "threeColumn" ? sportsDisplay : undefined,
    });

    const footyVisible = isSportsPanelVisible(tier, "footy", hasFooty, compactDisplay, sportsDisplay);
    if (footyVisible && footyPanelWasVisible === false) {
      void refreshFootball(trackedDate);
    }
    footyPanelWasVisible = footyVisible;

    const villaVisible = isSportsPanelVisible(tier, "villa", hasVilla, compactDisplay, sportsDisplay);
    if (villaVisible && villaPanelWasVisible === false) {
      void refreshVilla();
    }
    villaPanelWasVisible = villaVisible;
  };

  const pageVisibleOverflowPanels = (): boolean => {
    if (!latestPagination.hasOverflow) return false;
    panelPageOffsets = {
      ...panelPageOffsets,
    };
    for (const key of latestPagination.overflowKeys) {
      panelPageOffsets[key] = latestPagination.nextOffsets[key] ?? 0;
    }
    render();
    return true;
  };

  const refreshWeather = async (): Promise<void> => {
    const snapshot = await loadWeatherSnapshot(location, trackedDate);
    fullWeatherLines = snapshot.lines;
    sunrise = snapshot.sunrise;
    sunset = snapshot.sunset;
  };

  const refreshCalendar = async (now: Date): Promise<void> => {
    calendarData = await loadStatusCalendarData(now);
  };

  const refreshFootball = async (ymd: string): Promise<void> => {
    const generation = ++footyRefreshGeneration;
    try {
      const lines = await loadFootballStatusLines(ymd);
      if (generation !== footyRefreshGeneration) return;
      footyLines = lines;
      render();
    } catch {
      if (generation !== footyRefreshGeneration) return;
      footyLines = ["-"];
      render();
    }
  };

  const refreshVilla = async (): Promise<void> => {
    const generation = ++villaRefreshGeneration;
    try {
      const lines = await loadVillaFixturesStatusLines();
      if (generation !== villaRefreshGeneration) return;
      villaLines = lines;
      render();
    } catch {
      if (generation !== villaRefreshGeneration) return;
      villaLines = ["-"];
      render();
    }
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

  const closeShortcutsMenu = (): void => {
    shortcutsMenuOpen = false;
    render();
  };

  const openShortcutsMenu = (): void => {
    shortcutsMenuOpen = true;
    render();
  };

  const handleShortcutsMenuKey = (key: TerminalKey): void => {
    if (key.type === "ctrl-c") {
      stop();
      return;
    }
    if (key.type === "escape") {
      closeShortcutsMenu();
      return;
    }
    if (key.type !== "char") return;

    if (key.char === "a") {
      closeShortcutsMenu();
      return;
    }
    if (key.char === "q") {
      stop();
      return;
    }
    if (key.char === "c") {
      closeShortcutsMenu();
      openCmdMenu();
      return;
    }

    const shortcut = statusShortcutForKey(key.char);
    if (shortcut) {
      closeShortcutsMenu();
      void runShortcut(shortcut);
    }
  };

  const closeCmdMenu = (): void => {
    cmdMenuState = { active: false };
    render();
  };

  const openCmdMenu = (): void => {
    cmdMenuState = { active: true, step: "top" };
    render();
  };

  const handleCmdMenuKey = (key: TerminalKey): void => {
    if (!cmdMenuState.active) return;

    if (key.type === "ctrl-c" || key.type === "escape") {
      closeCmdMenu();
      return;
    }

    if (cmdMenuState.step === "running") {
      return;
    }

    if (cmdMenuState.step === "done" || cmdMenuState.step === "error") {
      if (key.type === "char" || key.type === "enter") {
        closeCmdMenu();
      }
      return;
    }

    if (key.type !== "char") return;

    if (key.char === "q") {
      closeCmdMenu();
      return;
    }

    if (cmdMenuState.step === "top") {
      if (isWfhMenuKey(key.char)) {
        void runCmdMenuWfh(
          (next) => {
            cmdMenuState = next;
            render();
          },
          (nextWfh) => {
            wfh = nextWfh;
          },
        );
        return;
      }
      const room = roomForKey(key.char);
      if (!room) return;
      cmdMenuState = { active: true, step: "device", room };
      render();
      return;
    }

    if (cmdMenuState.step === "device") {
      const device = deviceForKey(key.char, cmdMenuState.room);
      if (!device) return;
      cmdMenuState = {
        active: true,
        step: "state",
        room: cmdMenuState.room,
        device,
      };
      render();
      return;
    }

    const state = stateForKey(key.char);
    if (!state) return;
    const { room, device } = cmdMenuState;
    void runCmdMenuAction(room, device, state, (next) => {
      cmdMenuState = next;
      render();
    });
  };

  const toggleRotationPause = (): void => {
    if (rotationPaused) {
      const pausedDuration = Date.now() - rotationPausedAt;
      lastCompactRotateAt += pausedDuration;
      lastSportsAlternateAt += pausedDuration;
      lastMiddleAlternateAt += pausedDuration;
      rotationPaused = false;
    } else {
      rotationPausedAt = Date.now();
      rotationPaused = true;
    }
    render();
  };

  const flipRotatingPanels = (): void => {
    const nowMs = Date.now();
    if (rotationPaused) {
      rotationPausedAt = nowMs;
    }
    const state = displayState();
    const panelWidth = statusLayoutInnerWidth();
    const statusLines = buildStatusLines(state);
    const calendarLines = calendarData
      ? buildStatusCalendarLines(
          calendarData.months,
          state.now,
          calendarData.colors,
          maxCalendarContentLines(statusLines.length, true),
          panelWidth,
        )
      : null;
    const baseSolarPanel = solarData
      ? buildSolarPanelLines(solarData, undefined, panelWidth, monthlyYields ?? [])
      : [];
    const hasWeather = isWeatherPanelReady(fullWeatherLines);
    const hasSolar = isSolarPanelReady(baseSolarPanel);
    const hasCric = cricketPanelAvailable(cricLines);
    const hasFooty = sportsPanelHasContent(footyLines);
    const hasPlTable = plTablePanelAvailable(plTableLines);
    const hasVilla = sportsPanelHasContent(villaLines);
    const stackCalendar =
      shouldStackCalendarUnderStatus(statusLines.length) && Boolean(calendarLines?.length);
    const tier = resolveStatusLayoutTier(statusLines.length, panelWidth, {
      calendarLines,
      calendarInnerWidth: panelWidth,
      weatherLines: hasWeather ? fullWeatherLines : null,
      solarLines: hasSolar ? baseSolarPanel : null,
      cricLines: hasCric ? buildSportsPanelLines("cric", cricLines) : null,
      footyLines: hasFooty ? buildSportsPanelLines("footy", footyLines) : null,
      plTableLines: hasPlTable ? buildSportsPanelLines("plTable", plTableLines) : null,
      villaLines: hasVilla ? buildSportsPanelLines("villa", villaLines) : null,
    });
    const compactPool = buildCompactRotationPool(
      stackCalendar,
      calendarLines,
      hasWeather,
      hasSolar,
      hasCric,
      hasFooty,
      hasPlTable,
      hasVilla,
    );

    if (usesCompactRotation(tier) && compactPool.length > 1) {
      const index = compactPool.indexOf(compactRotatePhase);
      compactRotatePhase = compactPool[(index + 1) % compactPool.length];
      lastCompactRotateAt = nowMs;
    }
    const sportsPool = buildSportsRotationPool(hasCric, hasFooty, hasPlTable, hasVilla);
    if (tier === "threeColumn" && sportsPool.length > 1) {
      const index = sportsPool.indexOf(sportsRotatePhase);
      sportsRotatePhase = sportsPool[(index + 1) % sportsPool.length];
      lastSportsAlternateAt = nowMs;
    }
    if (tier === "threeColumn" && hasWeather && hasSolar) {
      middleAlternatePhase = middleAlternatePhase === "weather" ? "solar" : "weather";
      lastMiddleAlternateAt = nowMs;
    }
    render();
  };

  const onKeys = (keys: TerminalKey[]): void => {
    if (runningCommand) return;
    for (const key of keys) {
      if (shortcutsMenuOpen) {
        handleShortcutsMenuKey(key);
        return;
      }
      if (cmdMenuState.active) {
        handleCmdMenuKey(key);
        return;
      }
      if (key.type === "char" && key.char === "d" && pageVisibleOverflowPanels()) {
        return;
      }
      const action = handleStatusKey(key);
      if (action === "quit") {
        stop();
        return;
      }
      if (action === "cmd-menu") {
        openCmdMenu();
        return;
      }
      if (action === "flip-next") {
        flipRotatingPanels();
        return;
      }
      if (action === "toggle-pause") {
        toggleRotationPause();
        return;
      }
      if (action === "shortcuts-menu") {
        openShortcutsMenu();
        return;
      }
      if (action) {
        void runShortcut(action);
        return;
      }
    }
  };

  [wfh, { downstairsTemp, shedTemp }, houseOcto, calendarData, { cricLines, footyLines }, plTableLines, villaLines] =
    await Promise.all([
      fetchWfhStatus(),
      loadTemps(),
      loadHouseOctoPrices(),
      loadStatusCalendarData(),
      loadSportsLines(trackedDate),
      loadPremierLeagueTableStatusLines(),
      loadVillaFixturesStatusLines(),
    ]);
  try {
    await refreshWeather();
  } catch {
    fullWeatherLines = ["weather unavailable"];
    sunrise = "-";
    sunset = "-";
  }
  const startedAt = Date.now();
  lastTempRefreshAt = startedAt;
  lastGasRefreshAt = startedAt;
  lastCricRefreshAt = startedAt;
  lastPlTableRefreshAt = startedAt;
  lastVillaRefreshAt = startedAt;

  try {
    const data = await fetchSolarData();
    solarData = data;
    yieldAverages = yieldAveragesFromData(data);
    const solarStartedAt = Date.now();
    const started = new Date(solarStartedAt);
    monthlyYields = solarMonthlyYieldRowsFromData(data, started);
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
      const needCricRefresh = dayChanged || nowMs - lastCricRefreshAt >= CRICKET_REFRESH_MS;
      const needPlTableRefresh = dayChanged || nowMs - lastPlTableRefreshAt >= PL_TABLE_REFRESH_MS;
      const needVillaRefresh = dayChanged || nowMs - lastVillaRefreshAt >= VILLA_REFRESH_MS;

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
          loadPremierLeagueTableStatusLines().then((lines) => {
            plTableLines = lines;
          }),
          loadVillaFixturesStatusLines().then((lines) => {
            villaLines = lines;
          }),
        ]);
        lastCricRefreshAt = nowMs;
        lastPlTableRefreshAt = nowMs;
        lastVillaRefreshAt = nowMs;
      } else {
        if (needCricRefresh) {
          try {
            cricLines = await loadCricketStatusLines(trackedDate);
            lastCricRefreshAt = nowMs;
          } catch {
            // Keep last known values on transient API errors.
          }
        }
        if (needPlTableRefresh) {
          try {
            plTableLines = await loadPremierLeagueTableStatusLines();
            lastPlTableRefreshAt = nowMs;
          } catch {
            // Keep last known values on transient API errors.
          }
        }
        if (needVillaRefresh) {
          try {
            villaLines = await loadVillaFixturesStatusLines();
            lastVillaRefreshAt = nowMs;
          } catch {
            // Keep last known values on transient API errors.
          }
        }
      }

      if (needYieldRefresh || needPowerRefresh) {
        try {
          const data = await fetchSolarData();
          solarData = data;
          if (needYieldRefresh) {
            solarYield = todayYieldKwh(data, trackedDate);
            yieldAverages = yieldAveragesFromData(data);
            monthlyYields = solarMonthlyYieldRowsFromData(data, now);
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
