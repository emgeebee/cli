import stringWidth from "string-width";
import stripAnsi from "strip-ansi";
import { z } from "zod";
import { isNarrowStatusTerminal } from "./terminal";

export const DATES_API_URL = "http://api.emgeebee.buzz:1880/api/dates";

const DAY_MS = 24 * 60 * 60 * 1000;
const UK_TZ = "Europe/London";
const ANSI_RESET = "\x1b[0m";

// Tier 1 is most important; tier 6 is least. Hot → cool → muted.
const TIER_COLORS: readonly string[] = [
  "\x1b[91m", // 1: bright red
  "\x1b[38;5;208m", // 2: orange
  "\x1b[33m", // 3: yellow
  "\x1b[38;5;154m", // 4: chartreuse
  "\x1b[32m", // 5: green
  "\x1b[90m", // 6: dim gray
];

const BdayPersonSchema = z.object({
  bd: z.string().optional(),
  type: z.number().optional(),
  tier: z.number().optional(),
});

const BdayConfigSchema = z.record(z.string(), BdayPersonSchema);

export type BdayPersonConfig = {
  bd?: string;
  tier?: number;
};

function normalizeTier(tier: number | undefined): number {
  if (tier == null || !Number.isFinite(tier)) return 1;
  return Math.min(6, Math.max(1, Math.round(tier)));
}

function personTier(person: z.infer<typeof BdayPersonSchema>): number {
  return normalizeTier(person.tier ?? person.type);
}

function configPersonTier(person: BdayPersonConfig): number {
  return normalizeTier(person.tier);
}

export type BdayConfig = Record<string, BdayPersonConfig>;

export type UpcomingBirthday = {
  name: string;
  tier: number;
  bdYmd: string;
  nextYmd: string;
  daysUntil: number;
  age: number;
};

export function normalizeBirthDateYmd(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toLocaleDateString("en-CA", { timeZone: UK_TZ });
}

function normalizeBdayConfig(raw: z.infer<typeof BdayConfigSchema>): BdayConfig {
  const config: BdayConfig = {};
  for (const [name, person] of Object.entries(raw)) {
    const bdYmd = normalizeBirthDateYmd(String(person?.bd || ""));
    if (!bdYmd) continue;
    const tier = personTier(person);
    config[name] = {
      bd: bdYmd,
      ...(tier === 1 ? {} : { tier }),
    };
  }
  return config;
}

export async function fetchBdayConfig(): Promise<BdayConfig | null> {
  try {
    const response = await fetch(DATES_API_URL, {
      headers: {
        Accept: "application/json",
      },
    });
    if (!response.ok) {
      return null;
    }
    const config = normalizeBdayConfig(BdayConfigSchema.parse(await response.json()));
    return Object.keys(config).length > 0 ? config : null;
  } catch {
    return null;
  }
}

export function birthdayMonthDaysFromConfig(config: BdayConfig | null): Set<string> {
  const birthdayMonthDays = new Set<string>();
  if (!config) return birthdayMonthDays;
  for (const person of Object.values(config)) {
    const bdYmd = String(person?.bd || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(bdYmd)) continue;
    const [, month, day] = bdYmd.split("-").map(Number);
    birthdayMonthDays.add(`${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  }
  return birthdayMonthDays;
}

function ukTodayYmd(now: Date = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: UK_TZ });
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function birthdayYmdInYear(month: number, day: number, year: number): string {
  if (month === 2 && day === 29 && !isLeapYear(year)) {
    return `${year}-02-28`;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function ymdToUtcMs(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function nextBirthdayYmd(bdYmd: string, now: Date = new Date()): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(bdYmd)) return null;
  const [, month, day] = bdYmd.split("-").map(Number);
  const todayYmd = ukTodayYmd(now);
  const year = Number(todayYmd.slice(0, 4));
  let candidate = birthdayYmdInYear(month, day, year);
  if (candidate < todayYmd) {
    candidate = birthdayYmdInYear(month, day, year + 1);
  }
  return candidate;
}

export function nextUpcomingBirthdays(
  config: BdayConfig | null,
  now: Date = new Date(),
  limit = 3,
): UpcomingBirthday[] {
  if (!config) return [];

  const todayYmd = ukTodayYmd(now);
  const upcoming: UpcomingBirthday[] = [];

  for (const [name, person] of Object.entries(config)) {
    const bdYmd = String(person?.bd || "").trim();
    if (!bdYmd) continue;
    const nextYmd = nextBirthdayYmd(bdYmd, now);
    if (!nextYmd) continue;
    const daysUntil = Math.floor((ymdToUtcMs(nextYmd) - ymdToUtcMs(todayYmd)) / DAY_MS);
    const birthYear = Number(bdYmd.slice(0, 4));
    const nextYear = Number(nextYmd.slice(0, 4));
    upcoming.push({
      name,
      tier: configPersonTier(person),
      bdYmd,
      nextYmd,
      daysUntil,
      age: nextYear - birthYear,
    });
  }

  return upcoming
    .sort((a, b) => a.daysUntil - b.daysUntil || a.name.localeCompare(b.name))
    .slice(0, limit);
}

function formatBdayDate(ymd: string): string {
  const date = new Date(`${ymd}T12:00:00Z`);
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: UK_TZ,
  });
}

function formatDaysUntil(daysUntil: number): string {
  if (daysUntil === 0) return "today";
  if (daysUntil === 1) return "in 1 day";
  return `in ${daysUntil} days`;
}

function formatNextBdayDaysCell(daysUntil: number): string {
  if (daysUntil === 0) return "today";
  return String(daysUntil);
}

export function formatBdayName(name: string): string {
  const spaced = name.replace(/([a-z\d])([A-Z])/g, "$1 $2");
  return spaced
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function formatUpcomingBdayLine(entry: UpcomingBirthday): string {
  const name = colorizeTierCell(formatBdayName(entry.name), entry.tier);
  if (entry.daysUntil === 0) {
    return `${name}: today (turns ${entry.age})`;
  }
  return `${name}: ${formatBdayDate(entry.nextYmd)} (${formatDaysUntil(entry.daysUntil)}, turns ${entry.age})`;
}

export function upcomingBdaySectionLines(
  config: BdayConfig | null,
  now: Date,
  limit = 3,
): string[] {
  return nextUpcomingBirthdays(config, now, limit).map(formatUpcomingBdayLine);
}

function parseIsoDate(value: string): Date {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date "${value}".`);
  }
  return date;
}

function utcStartOfToday(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function daysSince(bd: Date, today: Date): number {
  return Math.floor((today.getTime() - bd.getTime()) / DAY_MS);
}

function ymdDiff(from: Date, to: Date): { years: number; months: number; days: number } {
  let years = to.getUTCFullYear() - from.getUTCFullYear();
  let months = to.getUTCMonth() - from.getUTCMonth();
  let days = to.getUTCDate() - from.getUTCDate();

  if (days < 0) {
    months -= 1;
    const lastDayPrevMonth = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 0)).getUTCDate();
    days += lastDayPrevMonth;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return { years, months, days };
}

function normalAgeText(years: number, months: number): string {
  const y = `${years} year${years === 1 ? "" : "s"}`;
  const m = `${months} month${months === 1 ? "" : "s"}`;
  return `${y}, ${m}`;
}

function visibleLength(value: string): number {
  return stringWidth(stripAnsi(value));
}

function shouldStyleTier(): boolean {
  return Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
}

function colorForTier(tier: number): string {
  return TIER_COLORS[normalizeTier(tier) - 1];
}

function colorizeTierCell(value: string, tier: number): string {
  const color = colorForTier(tier);
  if (!shouldStyleTier()) return value;
  return `${color}${value}${ANSI_RESET}`;
}

function padCell(value: string, width: number): string {
  return value + " ".repeat(Math.max(0, width - visibleLength(value)));
}

function makeAsciiTable(headers: string[], rows: string[][]): string[] {
  const widths = headers.map((header, idx) =>
    Math.max(header.length, ...rows.map((row) => (row[idx] || "").length)),
  );
  const border = `+-${widths.map((w) => "-".repeat(w)).join("-+-")}-+`;
  const headerLine = `| ${headers.map((h, i) => padCell(h, widths[i])).join(" | ")} |`;
  const body = rows.map((row) => `| ${row.map((v, i) => padCell(v || "", widths[i])).join(" | ")} |`);
  return [border, headerLine, border, ...body, border];
}

const BDAY_NEXT_COL = 2;
const BDAY_DAYS_COL = 3;
const BDAY_WEEKS_COL = 4;
const BDAY_MONTHS_COL = 5;

function narrowBdayTableRow<T>(values: T[]): T[] {
  return values.filter(
    (_, i) => i !== BDAY_DAYS_COL && i !== BDAY_WEEKS_COL && i !== BDAY_MONTHS_COL,
  );
}

export type BuildBdayTableOptions = {
  narrow?: boolean;
  header?: boolean;
};

export function buildBdayTableLines(
  config: BdayConfig | null,
  now: Date = new Date(),
  maxContentLines?: number,
  options?: BuildBdayTableOptions,
): string[] {
  const narrow = options?.narrow ?? isNarrowStatusTerminal();
  const withHeader = options?.header ?? true;
  if (!config) return ["No dates configured."];
  const today = utcStartOfToday(now);
  const rows: Array<{ sortKey: number; cells: string[] }> = [];

  for (const [name, person] of Object.entries(config)) {
    const bdRaw = String(person?.bd || "").trim();
    if (!bdRaw) continue;
    const bd = parseIsoDate(bdRaw);
    const totalDays = daysSince(bd, today);
    if (totalDays < 0) continue;
    const nextYmd = nextBirthdayYmd(bdRaw, now);
    if (!nextYmd) continue;
    const todayYmd = ukTodayYmd(now);
    const daysUntil = Math.floor((ymdToUtcMs(nextYmd) - ymdToUtcMs(todayYmd)) / DAY_MS);
    const tier = configPersonTier(person);
    const { years, months } = ymdDiff(bd, today);
    const totalMonths = years * 12 + months;
    const totalWeeks = (totalDays / 7).toFixed(1);
    rows.push({
      sortKey: daysUntil,
      cells: [
        colorizeTierCell(formatBdayName(name), tier),
        bdRaw,
        formatNextBdayDaysCell(daysUntil),
        String(totalDays),
        totalWeeks,
        String(totalMonths),
        normalAgeText(years, months),
      ],
    });
  }

  if (rows.length === 0) return ["No valid dates found."];
  rows.sort((a, b) => a.sortKey - b.sortKey || stripAnsi(a.cells[0]).localeCompare(stripAnsi(b.cells[0])));

  const headers = narrow
    ? ["Name", "DOB", "Next", "Normal"]
    : ["Name", "DOB", "Next", "Days", "Weeks", "Months", "Normal"];
  const tableRows = narrow
    ? rows.map((row) => narrowBdayTableRow(row.cells))
    : rows.map((row) => row.cells);
  const table = makeAsciiTable(headers, tableRows);
  const prefix = withHeader ? ["=== Dates ===", ""] : [];
  const lines = [...prefix, ...table];
  if (maxContentLines == null || lines.length <= maxContentLines) {
    return lines;
  }
  const tableStart = prefix.length;
  const tableOverhead = tableStart + 3;
  const maxTableLines = Math.max(3, maxContentLines - tableOverhead);
  if (maxTableLines >= table.length) return lines.slice(0, maxContentLines);
  return [...lines.slice(0, tableStart), ...table.slice(0, maxTableLines)];
}
