import { z } from "zod";
import { isNarrowStatusTerminal } from "./terminal";

export const DATES_API_URL = "http://api.emgeebee.buzz:1880/api/dates";

const DAY_MS = 24 * 60 * 60 * 1000;
const UK_TZ = "Europe/London";

const BdayPersonSchema = z.object({
  bd: z.string().optional(),
  type: z.number().optional(),
});

const BdayConfigSchema = z.record(z.string(), BdayPersonSchema);

export type BdayPersonConfig = {
  bd?: string;
  type?: number;
};

export type BdayConfig = Record<string, BdayPersonConfig>;

export type UpcomingBirthday = {
  name: string;
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
    config[name] = {
      bd: bdYmd,
      ...(person.type == null ? {} : { type: person.type }),
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

export function formatUpcomingBdayLine(entry: UpcomingBirthday): string {
  if (entry.daysUntil === 0) {
    return `${entry.name}: today (turns ${entry.age})`;
  }
  return `${entry.name}: ${formatBdayDate(entry.nextYmd)} (${formatDaysUntil(entry.daysUntil)}, turns ${entry.age})`;
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

function padCell(value: string, width: number): string {
  return value + " ".repeat(Math.max(0, width - value.length));
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

const BDAY_DAYS_COL = 2;
const BDAY_WEEKS_COL = 3;
const BDAY_MONTHS_COL = 4;

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
  if (!config) return ["No birthdays configured."];
  const today = utcStartOfToday(now);
  const rows: string[][] = [];

  for (const [name, person] of Object.entries(config)) {
    const bdRaw = String(person?.bd || "").trim();
    if (!bdRaw) continue;
    const bd = parseIsoDate(bdRaw);
    const totalDays = daysSince(bd, today);
    if (totalDays < 0) continue;
    const { years, months } = ymdDiff(bd, today);
    const totalMonths = years * 12 + months;
    const totalWeeks = (totalDays / 7).toFixed(1);
    rows.push([
      name,
      bdRaw,
      String(totalDays),
      totalWeeks,
      String(totalMonths),
      normalAgeText(years, months),
    ]);
  }

  if (rows.length === 0) return ["No valid birthdays found."];
  rows.sort((a, b) => a[0].localeCompare(b[0]));

  const headers = narrow
    ? ["Name", "DOB", "Normal"]
    : ["Name", "DOB", "Days", "Weeks", "Months", "Normal"];
  const tableRows = narrow ? rows.map(narrowBdayTableRow) : rows;
  const table = makeAsciiTable(headers, tableRows);
  const prefix = withHeader ? ["=== Birthdays ===", ""] : [];
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
