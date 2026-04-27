#!/usr/bin/env node
/**
 * Print a month calendar to the terminal (similar to the `cal` command).
 * Usage: node cal.js                 -> previous 2 months, current, next 10 months
 *        node cal.js [month] [year] -> single month
 */
import { getConfigPath, readPhoneCliConfig } from "./config";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_HEADERS = "Mo Tu We Th Fr Sa Su";

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const REVERSE = "\x1b[7m";
const BLUE = "\x1b[94m";
const YELLOW = "\x1b[93m";
const GREY = "\x1b[90m";
const RED = "\x1b[91m";
const HOLIDAYS_URL = "https://1q1v3hm1n2.execute-api.us-west-2.amazonaws.com/prod/holidays";
const ANSI_REGEX = /\x1b\[[0-9;]*m/g;

type MonthDef = { year: number; month: number };
type CalendarColors = {
  birthdayMonthDays: Set<string>;
  holidayDays: Set<string>;
  bankHolidayDays: Set<string>;
};
type BdayPersonConfig = { bd?: string };
type BdayConfig = Record<string, BdayPersonConfig>;
type HolidayRange = { start?: string; end?: string };
type BankHoliday = { start?: string };
type HolidaysResponse = {
  text?: {
    holidays?: HolidayRange[];
    bankHolidays?: BankHoliday[];
  };
};

function shouldStyleHighlight(): boolean {
  return Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
}

function defaultYearWindowFrom(now: Date): MonthDef[] {
  return [-2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((offset) => {
    const t = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    return { year: t.getFullYear(), month: t.getMonth() };
  });
}

function parseArgs(): { months: MonthDef[] } {
  const rest = process.argv.slice(2).filter((a) => a !== "" && a !== "-");
  if (rest.length === 0) {
    return { months: defaultYearWindowFrom(new Date()) };
  }
  if (rest.length < 2) {
    console.error("Usage: node cal.js [month] [year]");
    console.error("  month: 1-12, year: e.g. 2026");
    process.exit(1);
  }
  const month = Number.parseInt(rest[0], 10) - 1;
  const year = Number.parseInt(rest[1], 10);
  if (Number.isNaN(month) || month < 0 || month > 11) {
    console.error("Month must be 1-12.");
    process.exit(1);
  }
  if (Number.isNaN(year) || year < 1 || year > 9999) {
    console.error("Year must be a valid number (1-9999).");
    process.exit(1);
  }
  return { months: [{ year, month }] };
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Returns 0=Monday .. 6=Sunday for the first day of the month. */
function firstDayOfMonth(year: number, month: number): number {
  return sundayFirstToMondayFirst(new Date(year, month, 1).getDay());
}

function sundayFirstToMondayFirst(day: number): number {
  return (day + 6) % 7;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function formatIsoDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatMonthDay(month: number, day: number): string {
  return `${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseIsoBirthDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  return d;
}

function parseShortDate(shortDate: string): Date | null {
  const m = /^(\d{2})-(\d{2})-(\d{2})$/.exec(shortDate.trim());
  if (!m) return null;
  const year = 2000 + Number.parseInt(m[1], 10);
  const month = Number.parseInt(m[2], 10) - 1;
  const day = Number.parseInt(m[3], 10);
  const d = new Date(year, month, day);
  if (
    d.getFullYear() !== year ||
    d.getMonth() !== month ||
    d.getDate() !== day
  ) {
    return null;
  }
  return d;
}

function dateRangeInclusive(start: Date, end: Date): Date[] {
  const from = start <= end ? start : end;
  const to = start <= end ? end : start;
  const result: Date[] = [];
  const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const endTime = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
  while (cursor.getTime() <= endTime) {
    result.push(new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate()));
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}

function colorForDay(
  year: number,
  month: number,
  day: number,
  mondayFirstWeekdayIndex: number,
  colors: CalendarColors,
): string {
  const iso = formatIsoDate(year, month, day);
  const monthDay = formatMonthDay(month, day);
  if (colors.birthdayMonthDays.has(monthDay)) {
    return RED;
  }
  if (colors.bankHolidayDays.has(iso)) {
    return YELLOW;
  }
  if (colors.holidayDays.has(iso)) {
    return BLUE;
  }
  if (mondayFirstWeekdayIndex >= 5) {
    return GREY;
  }
  return "";
}

function applyStyles(text: string, parts: string[]): string {
  if (!shouldStyleHighlight() || parts.length === 0) {
    return text;
  }
  return `${parts.join("")}${text}${RESET}`;
}

function visibleLength(value: string): number {
  return value.replace(ANSI_REGEX, "").length;
}

function padRightVisible(value: string, width: number): string {
  const diff = width - visibleLength(value);
  return diff > 0 ? `${value}${" ".repeat(diff)}` : value;
}

function colorLabel(label: string, color: string): string {
  return applyStyles(label, [color]);
}

function printLegend(): void {
  const parts = [
    `${colorLabel("■", RED)} Birthday`,
    `${colorLabel("■", YELLOW)} Bank holiday`,
    `${colorLabel("■", BLUE)} Holiday`,
    `${colorLabel("■", GREY)} Weekend`,
  ];
  console.log(`Key: ${parts.join("  ")}`);
  console.log("");
}

function cellText(
  year: number,
  month: number,
  day: number | null,
  mondayFirstWeekdayIndex: number,
  highlightDay: number | null,
  colors: CalendarColors,
): string {
  if (day == null) {
    return "  ";
  }
  const text = String(day).padStart(2, " ");
  const color = colorForDay(year, month, day, mondayFirstWeekdayIndex, colors);
  const styleParts: string[] = [];
  if (color) styleParts.push(color);
  if (highlightDay != null && day === highlightDay) {
    styleParts.push(REVERSE, BOLD);
  }
  return applyStyles(text, styleParts);
}

function padLine(
  year: number,
  month: number,
  cells: Array<number | null>,
  highlightDay: number | null,
  colors: CalendarColors,
): string {
  return cells
    .map((n, idx) => cellText(year, month, n, idx, highlightDay, colors))
    .join(" ");
}

function buildCalendarLines(
  year: number,
  month: number,
  today: Date,
  colors: CalendarColors,
): string[] {
  const highlightDay =
    today.getFullYear() === year && today.getMonth() === month
      ? today.getDate()
      : null;

  const title = `    ${MONTH_NAMES[month]} ${year}    `;
  const lastDay = daysInMonth(year, month);
  const startPad = firstDayOfMonth(year, month);
  const lines: string[] = [title, DAY_HEADERS];

  let row: Array<number | null> = [];
  for (let i = 0; i < startPad; i++) {
    row.push(null);
  }
  for (let d = 1; d <= lastDay; d++) {
    row.push(d);
    if (row.length === 7) {
      lines.push(padLine(year, month, row, highlightDay, colors));
      row = [];
    }
  }
  if (row.length > 0) {
    while (row.length < 7) {
      row.push(null);
    }
    lines.push(padLine(year, month, row, highlightDay, colors));
  }
  return lines;
}

function resolveCalConfig(): { token: string; birthdayMonthDays: Set<string> } {
  const config = readPhoneCliConfig();
  const token = asRecord(config.cal)?.token;
  if (typeof token === "string" && token.trim() !== "") {
    const birthdayMonthDays = new Set<string>();
    const bdaySection = asRecord(config.bday) as BdayConfig | null;
    if (bdaySection) {
      for (const person of Object.values(bdaySection)) {
        const raw = String(person?.bd || "").trim();
        if (!raw) continue;
        const parsed = parseIsoBirthDate(raw);
        if (!parsed) continue;
        birthdayMonthDays.add(
          formatMonthDay(parsed.getUTCMonth(), parsed.getUTCDate()),
        );
      }
    }
    return { token: token.trim(), birthdayMonthDays };
  }
  console.error(`Missing cal token at ${getConfigPath()} (expected config.cal.token).`);
  process.exit(1);
}

async function fetchCalendarColors(
  token: string,
  birthdayMonthDays: Set<string>,
): Promise<CalendarColors> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
    "x-api-key": token,
  };
  const response = await fetch(HOLIDAYS_URL, { headers });
  if (!response.ok) {
    throw new Error(`Holiday request failed (${response.status})`);
  }
  const payload = (await response.json()) as HolidaysResponse;
  const holidayDays = new Set<string>();
  const bankHolidayDays = new Set<string>();
  const text = asRecord(payload.text);

  const holidays = Array.isArray(text?.holidays) ? (text.holidays as HolidayRange[]) : [];
  for (const item of holidays) {
    if (!item?.start || !item?.end) continue;
    const start = parseShortDate(item.start);
    const end = parseShortDate(item.end);
    if (!start || !end) continue;
    for (const day of dateRangeInclusive(start, end)) {
      holidayDays.add(formatIsoDate(day.getFullYear(), day.getMonth(), day.getDate()));
    }
  }

  const bankHolidays = Array.isArray(text?.bankHolidays) ? (text.bankHolidays as BankHoliday[]) : [];
  for (const item of bankHolidays) {
    if (!item?.start) continue;
    const parsed = parseShortDate(item.start);
    if (!parsed) continue;
    bankHolidayDays.add(formatIsoDate(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()));
  }

  return { birthdayMonthDays, holidayDays, bankHolidayDays };
}

async function main(): Promise<void> {
  const { token, birthdayMonthDays } = resolveCalConfig();
  const { months } = parseArgs();
  const today = new Date();
  const colors = await fetchCalendarColors(token, birthdayMonthDays);
  printLegend();

  const allMonthLines = months.map(({ year, month }) =>
    buildCalendarLines(year, month, today, colors),
  );
  const gutter = "   ";

  for (let i = 0; i < allMonthLines.length; i += 2) {
    if (i > 0) {
      console.log();
    }
    const left = allMonthLines[i];
    const right = allMonthLines[i + 1] ?? [];
    const leftWidth = Math.max(...left.map(visibleLength));
    const rows = Math.max(left.length, right.length);
    for (let r = 0; r < rows; r++) {
      const leftLine = padRightVisible(left[r] ?? "", leftWidth);
      const rightLine = right[r] ?? "";
      console.log(rightLine ? `${leftLine}${gutter}${rightLine}` : leftLine);
    }
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Failed to build calendar: ${message}`);
  process.exit(1);
});

export {};
