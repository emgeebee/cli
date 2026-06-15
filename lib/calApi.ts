import { readPhoneCliConfig } from "../config";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_HEADERS = "Mo Tu We Th Fr Sa Su";
const HOLIDAYS_URL = "https://1q1v3hm1n2.execute-api.us-west-2.amazonaws.com/prod/holidays";
const ANSI_REGEX = /\x1b\[[0-9;]*m/g;

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const REVERSE = "\x1b[7m";
const BLUE = "\x1b[94m";
const YELLOW = "\x1b[93m";
const GREY = "\x1b[90m";
const RED = "\x1b[91m";

export type MonthDef = { year: number; month: number };

export type CalendarColors = {
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

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function sundayFirstToMondayFirst(day: number): number {
  return (day + 6) % 7;
}

function firstDayOfMonth(year: number, month: number): number {
  return sundayFirstToMondayFirst(new Date(year, month, 1).getDay());
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

export function padRightVisible(value: string, width: number): string {
  const diff = width - visibleLength(value);
  return diff > 0 ? `${value}${" ".repeat(diff)}` : value;
}

function colorLabel(label: string, color: string): string {
  return applyStyles(label, [color]);
}

export function buildCalendarLegendLine(): string {
  const parts = [
    `${colorLabel("■", RED)} bday`,
    `${colorLabel("■", YELLOW)} bank`,
    `${colorLabel("■", BLUE)} hol`,
    `${colorLabel("■", GREY)} w/e`,
  ];
  return `Key: ${parts.join("  ")}`;
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

export const STATUS_CALENDAR_COLUMNS = 3;
export const STATUS_CALENDAR_MONTH_WIDTH = 20;
export const STATUS_CALENDAR_GUTTER = "  ";

export function statusCalendarInnerWidth(): number {
  return (
    STATUS_CALENDAR_COLUMNS * STATUS_CALENDAR_MONTH_WIDTH +
    (STATUS_CALENDAR_COLUMNS - 1) * STATUS_CALENDAR_GUTTER.length
  );
}

function columnWidthsForRow(
  innerWidth: number | undefined,
  columns: string[][],
  gutter: string,
): number[] {
  if (innerWidth === undefined) {
    return columns.map((col) => Math.max(0, ...col.map(visibleLength)));
  }
  const gutterTotal = (columns.length - 1) * gutter.length;
  const available = innerWidth - gutterTotal;
  const base = Math.floor(available / columns.length);
  const remainder = available - base * columns.length;
  return Array.from({ length: columns.length }, (_, index) => base + (index < remainder ? 1 : 0));
}

export function joinMonthRow(
  columns: string[][],
  innerWidth?: number,
  gutter = STATUS_CALENDAR_GUTTER,
): string[] {
  if (columns.length === 0) return [];
  const colWidths = columnWidthsForRow(innerWidth, columns, gutter);
  const rows = Math.max(...columns.map((col) => col.length));
  const lines: string[] = [];
  for (let row = 0; row < rows; row += 1) {
    const parts = columns.map((col, index) =>
      padRightVisible(col[row] ?? "", colWidths[index]),
    );
    lines.push(parts.join(gutter));
  }
  return lines;
}

export function joinMonthColumns(
  left: string[],
  right: string[],
  innerWidth?: number,
  gutter = "   ",
): string[] {
  return joinMonthRow([left, right], innerWidth, gutter);
}

export function buildStatusCalendarLines(
  months: MonthDef[],
  today: Date,
  colors: CalendarColors,
  maxContentLines?: number,
  innerWidth?: number,
): string[] {
  const calendarWidth = innerWidth ?? statusCalendarInnerWidth();
  const legend = buildCalendarLegendLine();
  const lines: string[] = [padRightVisible(legend, calendarWidth)];
  for (let i = 0; i < months.length; i += STATUS_CALENDAR_COLUMNS) {
    const rowMonths = months.slice(i, i + STATUS_CALENDAR_COLUMNS).map(({ year, month }) =>
      buildCalendarLines(year, month, today, colors),
    );
    const rowLines = joinMonthRow(rowMonths, calendarWidth, STATUS_CALENDAR_GUTTER);
    const separator = lines.length > 1 ? 1 : 0;
    if (
      maxContentLines !== undefined &&
      lines.length + separator + rowLines.length > maxContentLines
    ) {
      break;
    }
    if (separator > 0) {
      lines.push("");
    }
    lines.push(...rowLines);
  }
  return lines;
}

export function buildCalendarLines(
  year: number,
  month: number,
  today: Date,
  colors: CalendarColors,
): string[] {
  const highlightDay =
    today.getFullYear() === year && today.getMonth() === month
      ? today.getDate()
      : null;

  const title = `${MONTH_NAMES[month]} ${year}`;
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

export function defaultYearWindowFrom(now: Date): MonthDef[] {
  return [-2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((offset) => {
    const t = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    return { year: t.getFullYear(), month: t.getMonth() };
  });
}

/** Status panel: 3 prior months, then current month first in row 2; future months fill complete rows. */
export function statusYearWindowFrom(now: Date = new Date()): MonthDef[] {
  const priorFutureEnd = 10;
  const offsets: number[] = [-3, -2, -1];
  for (
    let month = 0;
    month <= priorFutureEnd || (offsets.length - 3) % STATUS_CALENDAR_COLUMNS !== 0;
    month += 1
  ) {
    offsets.push(month);
  }
  return offsets.map((offset) => {
    const t = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    return { year: t.getFullYear(), month: t.getMonth() };
  });
}

export function resolveCalConfig(): { token: string; birthdayMonthDays: Set<string> } {
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
  throw new Error('Missing cal token (expected config.cal.token).');
}

export function readOptionalCalConfig(): { token: string; birthdayMonthDays: Set<string> } | null {
  try {
    return resolveCalConfig();
  } catch {
    return null;
  }
}

export async function fetchCalendarColors(
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

export type StatusCalendarData = {
  months: MonthDef[];
  colors: CalendarColors;
};

export async function loadStatusCalendarData(
  now: Date = new Date(),
): Promise<StatusCalendarData | null> {
  const calConfig = readOptionalCalConfig();
  if (!calConfig) return null;
  try {
    const colors = await fetchCalendarColors(calConfig.token, calConfig.birthdayMonthDays);
    return { months: statusYearWindowFrom(now), colors };
  } catch {
    return null;
  }
}

export async function loadStatusCalendarLines(now: Date = new Date()): Promise<string[] | null> {
  const data = await loadStatusCalendarData(now);
  if (!data) return null;
  return buildStatusCalendarLines(data.months, now, data.colors);
}
