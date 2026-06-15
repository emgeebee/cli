#!/usr/bin/env node
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// cal.ts
var cal_exports = {};
module.exports = __toCommonJS(cal_exports);

// config.ts
var import_node_fs = require("node:fs");
var import_node_path = require("node:path");
var import_node_os = require("node:os");
var CONFIG_FILE = ".phone_cli.json";
function getConfigPath() {
  return (0, import_node_path.join)((0, import_node_os.homedir)(), CONFIG_FILE);
}
function readPhoneCliConfig() {
  const path = getConfigPath();
  try {
    const raw = (0, import_node_fs.readFileSync)(path, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Top-level JSON must be an object.");
    }
    return parsed;
  } catch (error) {
    if (typeof error === "object" && error != null && "code" in error && error.code === "ENOENT") {
      return {};
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read config at ${path}: ${message}`);
  }
}

// lib/calApi.ts
var MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];
var DAY_HEADERS = "Mo Tu We Th Fr Sa Su";
var HOLIDAYS_URL = "https://1q1v3hm1n2.execute-api.us-west-2.amazonaws.com/prod/holidays";
var ANSI_REGEX = /\x1b\[[0-9;]*m/g;
var RESET = "\x1B[0m";
var BOLD = "\x1B[1m";
var REVERSE = "\x1B[7m";
var BLUE = "\x1B[94m";
var YELLOW = "\x1B[93m";
var GREY = "\x1B[90m";
var RED = "\x1B[91m";
function shouldStyleHighlight() {
  return Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
}
function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}
function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}
function sundayFirstToMondayFirst(day) {
  return (day + 6) % 7;
}
function firstDayOfMonth(year, month) {
  return sundayFirstToMondayFirst(new Date(year, month, 1).getDay());
}
function formatIsoDate(year, month, day) {
  return `${String(year).padStart(4, "0")}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
function formatMonthDay(month, day) {
  return `${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
function parseIsoBirthDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const d = /* @__PURE__ */ new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  return d;
}
function parseShortDate(shortDate) {
  const m = /^(\d{2})-(\d{2})-(\d{2})$/.exec(shortDate.trim());
  if (!m) return null;
  const year = 2e3 + Number.parseInt(m[1], 10);
  const month = Number.parseInt(m[2], 10) - 1;
  const day = Number.parseInt(m[3], 10);
  const d = new Date(year, month, day);
  if (d.getFullYear() !== year || d.getMonth() !== month || d.getDate() !== day) {
    return null;
  }
  return d;
}
function dateRangeInclusive(start, end) {
  const from = start <= end ? start : end;
  const to = start <= end ? end : start;
  const result = [];
  const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const endTime = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
  while (cursor.getTime() <= endTime) {
    result.push(new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate()));
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}
function colorForDay(year, month, day, mondayFirstWeekdayIndex, colors) {
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
function applyStyles(text, parts) {
  if (!shouldStyleHighlight() || parts.length === 0) {
    return text;
  }
  return `${parts.join("")}${text}${RESET}`;
}
function visibleLength(value) {
  return value.replace(ANSI_REGEX, "").length;
}
function padRightVisible(value, width) {
  const diff = width - visibleLength(value);
  return diff > 0 ? `${value}${" ".repeat(diff)}` : value;
}
function colorLabel(label, color) {
  return applyStyles(label, [color]);
}
function buildCalendarLegendLine() {
  const parts = [
    `${colorLabel("\u25A0", RED)} bday`,
    `${colorLabel("\u25A0", YELLOW)} bank`,
    `${colorLabel("\u25A0", BLUE)} hol`,
    `${colorLabel("\u25A0", GREY)} w/e`
  ];
  return `Key: ${parts.join("  ")}`;
}
function cellText(year, month, day, mondayFirstWeekdayIndex, highlightDay, colors) {
  if (day == null) {
    return "  ";
  }
  const text = String(day).padStart(2, " ");
  const color = colorForDay(year, month, day, mondayFirstWeekdayIndex, colors);
  const styleParts = [];
  if (color) styleParts.push(color);
  if (highlightDay != null && day === highlightDay) {
    styleParts.push(REVERSE, BOLD);
  }
  return applyStyles(text, styleParts);
}
function padLine(year, month, cells, highlightDay, colors) {
  return cells.map((n, idx) => cellText(year, month, n, idx, highlightDay, colors)).join(" ");
}
var STATUS_CALENDAR_GUTTER = "  ";
function columnWidthsForRow(innerWidth, columns, gutter) {
  if (innerWidth === void 0) {
    return columns.map((col) => Math.max(0, ...col.map(visibleLength)));
  }
  const gutterTotal = (columns.length - 1) * gutter.length;
  const available = innerWidth - gutterTotal;
  const base = Math.floor(available / columns.length);
  const remainder = available - base * columns.length;
  return Array.from({ length: columns.length }, (_, index) => base + (index < remainder ? 1 : 0));
}
function joinMonthRow(columns, innerWidth, gutter = STATUS_CALENDAR_GUTTER) {
  if (columns.length === 0) return [];
  const colWidths = columnWidthsForRow(innerWidth, columns, gutter);
  const rows = Math.max(...columns.map((col) => col.length));
  const lines = [];
  for (let row = 0; row < rows; row += 1) {
    const parts = columns.map(
      (col, index) => padRightVisible(col[row] ?? "", colWidths[index])
    );
    lines.push(parts.join(gutter));
  }
  return lines;
}
function joinMonthColumns(left, right, innerWidth, gutter = "   ") {
  return joinMonthRow([left, right], innerWidth, gutter);
}
function buildCalendarLines(year, month, today, colors) {
  const highlightDay = today.getFullYear() === year && today.getMonth() === month ? today.getDate() : null;
  const title = `${MONTH_NAMES[month]} ${year}`;
  const lastDay = daysInMonth(year, month);
  const startPad = firstDayOfMonth(year, month);
  const lines = [title, DAY_HEADERS];
  let row = [];
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
function defaultYearWindowFrom(now) {
  return [-2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((offset) => {
    const t = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    return { year: t.getFullYear(), month: t.getMonth() };
  });
}
function resolveCalConfig() {
  const config = readPhoneCliConfig();
  const token = asRecord(config.cal)?.token;
  if (typeof token === "string" && token.trim() !== "") {
    const birthdayMonthDays = /* @__PURE__ */ new Set();
    const bdaySection = asRecord(config.bday);
    if (bdaySection) {
      for (const person of Object.values(bdaySection)) {
        const raw = String(person?.bd || "").trim();
        if (!raw) continue;
        const parsed = parseIsoBirthDate(raw);
        if (!parsed) continue;
        birthdayMonthDays.add(
          formatMonthDay(parsed.getUTCMonth(), parsed.getUTCDate())
        );
      }
    }
    return { token: token.trim(), birthdayMonthDays };
  }
  throw new Error("Missing cal token (expected config.cal.token).");
}
async function fetchCalendarColors(token, birthdayMonthDays) {
  const headers = {
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
    "x-api-key": token
  };
  const response = await fetch(HOLIDAYS_URL, { headers });
  if (!response.ok) {
    throw new Error(`Holiday request failed (${response.status})`);
  }
  const payload = await response.json();
  const holidayDays = /* @__PURE__ */ new Set();
  const bankHolidayDays = /* @__PURE__ */ new Set();
  const text = asRecord(payload.text);
  const holidays = Array.isArray(text?.holidays) ? text.holidays : [];
  for (const item of holidays) {
    if (!item?.start || !item?.end) continue;
    const start = parseShortDate(item.start);
    const end = parseShortDate(item.end);
    if (!start || !end) continue;
    for (const day of dateRangeInclusive(start, end)) {
      holidayDays.add(formatIsoDate(day.getFullYear(), day.getMonth(), day.getDate()));
    }
  }
  const bankHolidays = Array.isArray(text?.bankHolidays) ? text.bankHolidays : [];
  for (const item of bankHolidays) {
    if (!item?.start) continue;
    const parsed = parseShortDate(item.start);
    if (!parsed) continue;
    bankHolidayDays.add(formatIsoDate(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()));
  }
  return { birthdayMonthDays, holidayDays, bankHolidayDays };
}

// cal.ts
function parseArgs() {
  const rest = process.argv.slice(2).filter((a) => a !== "" && a !== "-");
  if (rest.length === 0) {
    return { months: defaultYearWindowFrom(/* @__PURE__ */ new Date()) };
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
async function main() {
  let token;
  let birthdayMonthDays;
  try {
    ({ token, birthdayMonthDays } = resolveCalConfig());
  } catch {
    console.error(`Missing cal token at ${getConfigPath()} (expected config.cal.token).`);
    process.exit(1);
  }
  const { months } = parseArgs();
  const today = /* @__PURE__ */ new Date();
  const colors = await fetchCalendarColors(token, birthdayMonthDays);
  console.log(buildCalendarLegendLine());
  console.log("");
  const allMonthLines = months.map(
    ({ year, month }) => buildCalendarLines(year, month, today, colors)
  );
  for (let i = 0; i < allMonthLines.length; i += 2) {
    if (i > 0) {
      console.log();
    }
    for (const line of joinMonthColumns(allMonthLines[i], allMonthLines[i + 1] ?? [])) {
      console.log(line);
    }
  }
}
main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Failed to build calendar: ${message}`);
  process.exit(1);
});
