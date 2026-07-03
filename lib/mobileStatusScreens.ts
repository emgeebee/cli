import {
  fitFootballStatusLinesCenteredOnToday,
  fitPanelContentLines,
  fitVillaStatusLines,
} from "./ballApi";
import { buildBdayTableLines, type BdayConfig } from "./bdayApi";
import {
  buildStatusCalendarLines,
  mobileCalendarWindowFrom,
  type CalendarColors,
  type MonthDef,
} from "./calApi";
import {
  formatElectricityPeriodAvgTable,
  formatMonthlyTotalCostSummaryLines,
  type OctopusRate,
} from "./octoApi";
import { buildSolarPowerGraphPanelLines } from "./solarView";
import type { SolarResponse } from "./solarApi";
import {
  buildDailyForecastLines,
  buildHourlyForecastFromNowLines,
  type WeatherResponse,
} from "./wApi";

export type MobileRotateScreen =
  | "status"
  | "footy"
  | "villa"
  | "octo"
  | "solar"
  | "weatherDaily"
  | "weatherHourly"
  | "cric"
  | "calendar"
  | "birthdays";

export const MOBILE_ROTATE_SCREENS: MobileRotateScreen[] = [
  "status",
  "footy",
  "villa",
  "octo",
  "solar",
  "weatherDaily",
  "weatherHourly",
  "cric",
  "calendar",
  "birthdays",
];

export const MOBILE_SCREEN_LABELS: Record<MobileRotateScreen, string> = {
  status: "Status",
  footy: "Football",
  villa: "Villa",
  octo: "Octo",
  solar: "Solar",
  weatherDaily: "Weather",
  weatherHourly: "Weather hourly",
  cric: "Cricket",
  calendar: "Dates",
  birthdays: "Birthdays",
};

export type MobileScreenCountdown = {
  seconds: number;
  next: MobileRotateScreen;
  paused?: boolean;
};

export type MobileScreenContext = {
  now: Date;
  panelWidth: number;
  maxBodyLines: number;
  statusLines: string[];
  footyLines: string[];
  villaLines: string[];
  cricLines: string[];
  gasLine: string;
  todayElectricity: OctopusRate[];
  tomorrowElectricity: OctopusRate[];
  solarData: SolarResponse | null;
  weatherData: WeatherResponse | null;
  weatherLocation: string;
  calendarColors: CalendarColors | null;
  bdayConfig: BdayConfig | null;
  narrowOcto: boolean;
};

function rotationNextLabel(next: string, seconds: number, paused: boolean): string {
  return paused ? `${next} paused` : `${next} in ${seconds}`;
}

export function withMobileScreenCountdown(
  lines: string[],
  countdown?: MobileScreenCountdown,
): string[] {
  if (!countdown || lines.length === 0) return lines;
  const label = MOBILE_SCREEN_LABELS[countdown.next];
  const suffix = rotationNextLabel(label, countdown.seconds, countdown.paused ?? false);
  const line = lines[0];
  if (line.startsWith("=== ") && line.endsWith(" ===")) {
    const name = line.slice(4, -4);
    return [`=== ${name} (${suffix}, n) ===`, ...lines.slice(1)];
  }
  if (line.startsWith("=== ")) {
    return [`${line.replace(/ ===$/, "")} (${suffix}, n) ===`, ...lines.slice(1)];
  }
  return [`=== ${line} (${suffix}, n) ===`, ...lines.slice(1)];
}

function capitalizeGasLine(line: string): string {
  return line
    .replace(/^today gas:/i, "Today Gas:")
    .replace(/, tomorrow gas:/i, ", Tomorrow Gas:");
}

function capitalizeElectricityLines(lines: string[]): string[] {
  return lines.map((line) =>
    line
      .replace("| day ", "| Day ")
      .replace("| today ", "| Today ")
      .replace("| tomo ", "| Tomo ")
      .replace("| tomorrow ", "| Tomorrow "),
  );
}

function buildFootyScreenLines(ctx: MobileScreenContext): string[] {
  const body = fitFootballStatusLinesCenteredOnToday(ctx.footyLines, ctx.maxBodyLines - 2);
  return ["=== Football ===", "", ...body];
}

function buildVillaScreenLines(ctx: MobileScreenContext): string[] {
  const body = fitVillaStatusLines(ctx.villaLines, ctx.maxBodyLines - 2);
  return ["=== Villa ===", "", ...body];
}

function buildOctoScreenLines(ctx: MobileScreenContext): string[] {
  const lines = ["=== Octo ===", "", capitalizeGasLine(ctx.gasLine)];
  const electricity = capitalizeElectricityLines(
    formatElectricityPeriodAvgTable(ctx.todayElectricity, ctx.tomorrowElectricity, {
      narrow: ctx.narrowOcto,
    }),
  );
  if (electricity.length > 0) {
    lines.push("", ...electricity);
  }
  const monthly = formatMonthlyTotalCostSummaryLines(ctx.now);
  if (monthly.length > 0) {
    lines.push("", ...monthly);
  }
  return fitPanelContentLines(lines, ctx.maxBodyLines);
}

function buildSolarScreenLines(ctx: MobileScreenContext): string[] {
  if (!ctx.solarData) return ["=== Solar ===", "", "Solar unavailable."];
  return fitPanelContentLines(
    buildSolarPowerGraphPanelLines(ctx.solarData, ctx.panelWidth),
    ctx.maxBodyLines,
  );
}

function buildWeatherDailyScreenLines(ctx: MobileScreenContext): string[] {
  if (!ctx.weatherData) return ["=== Weather ===", "", "Weather unavailable."];
  return buildDailyForecastLines(ctx.weatherData, ctx.weatherLocation, ctx.maxBodyLines);
}

function buildWeatherHourlyScreenLines(ctx: MobileScreenContext): string[] {
  if (!ctx.weatherData) return ["=== Weather ===", "", "Weather unavailable."];
  return buildHourlyForecastFromNowLines(
    ctx.weatherData,
    ctx.weatherLocation,
    ctx.now,
    ctx.maxBodyLines,
  );
}

function buildCricScreenLines(ctx: MobileScreenContext): string[] {
  const body = fitPanelContentLines(ctx.cricLines, Math.max(1, ctx.maxBodyLines - 2));
  return ["=== Cricket ===", "", ...body];
}

function buildCalendarScreenLines(ctx: MobileScreenContext): string[] {
  if (!ctx.calendarColors) return ["=== Dates ===", "", "Calendar unavailable."];
  const months: MonthDef[] = mobileCalendarWindowFrom(ctx.now);
  return buildStatusCalendarLines(
    months,
    ctx.now,
    ctx.calendarColors,
    ctx.maxBodyLines,
    ctx.panelWidth,
  );
}

function buildBirthdaysScreenLines(ctx: MobileScreenContext): string[] {
  return buildBdayTableLines(ctx.bdayConfig, ctx.now, ctx.maxBodyLines);
}

export function buildMobileScreenLines(
  screen: MobileRotateScreen,
  ctx: MobileScreenContext,
  countdown?: MobileScreenCountdown,
): string[] | null {
  if (screen === "status") return null;

  let lines: string[];
  switch (screen) {
    case "footy":
      lines = buildFootyScreenLines(ctx);
      break;
    case "villa":
      lines = buildVillaScreenLines(ctx);
      break;
    case "octo":
      lines = buildOctoScreenLines(ctx);
      break;
    case "solar":
      lines = buildSolarScreenLines(ctx);
      break;
    case "weatherDaily":
      lines = buildWeatherDailyScreenLines(ctx);
      break;
    case "weatherHourly":
      lines = buildWeatherHourlyScreenLines(ctx);
      break;
    case "cric":
      lines = buildCricScreenLines(ctx);
      break;
    case "calendar":
      lines = buildCalendarScreenLines(ctx);
      break;
    case "birthdays":
      lines = buildBirthdaysScreenLines(ctx);
      break;
    default:
      return null;
  }

  return withMobileScreenCountdown(lines, countdown);
}
