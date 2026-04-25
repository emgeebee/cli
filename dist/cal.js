#!/usr/bin/env node
"use strict";
/**
 * Print a month calendar to the terminal (similar to the `cal` command).
 * Usage: node cal.js                 -> this month and the next 2 months
 *        node cal.js [month] [year] -> single month
 */
Object.defineProperty(exports, "__esModule", { value: true });
const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];
const DAY_HEADERS = "Su Mo Tu We Th Fr Sa";
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const REVERSE = "\x1b[7m";
function shouldStyleHighlight() {
    return Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
}
function nextThreeMonthsFrom(now) {
    return [0, 1, 2].map((offset) => {
        const t = new Date(now.getFullYear(), now.getMonth() + offset, 1);
        return { year: t.getFullYear(), month: t.getMonth() };
    });
}
function parseArgs() {
    const rest = process.argv.slice(2).filter((a) => a !== "" && a !== "-");
    if (rest.length === 0) {
        return { months: nextThreeMonthsFrom(new Date()) };
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
function daysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
}
/** Returns 0=Sunday .. 6=Saturday for the first day of the month. */
function firstDayOfMonth(year, month) {
    return new Date(year, month, 1).getDay();
}
function cellText(day, highlightDay) {
    if (day == null) {
        return "  ";
    }
    const text = String(day).padStart(2, " ");
    if (highlightDay != null && day === highlightDay && shouldStyleHighlight()) {
        return `${REVERSE}${BOLD}${text}${RESET}`;
    }
    return text;
}
function padLine(cells, highlightDay) {
    return cells.map((n) => cellText(n, highlightDay)).join(" ");
}
function buildCalendarLines(year, month, today) {
    const highlightDay = today.getFullYear() === year && today.getMonth() === month
        ? today.getDate()
        : null;
    const title = `    ${MONTH_NAMES[month]} ${year}    `;
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
            lines.push(padLine(row, highlightDay));
            row = [];
        }
    }
    if (row.length > 0) {
        while (row.length < 7) {
            row.push(null);
        }
        lines.push(padLine(row, highlightDay));
    }
    return lines;
}
const { months } = parseArgs();
const today = new Date();
for (let i = 0; i < months.length; i++) {
    if (i > 0) {
        console.log();
    }
    const { year, month } = months[i];
    const lines = buildCalendarLines(year, month, today);
    for (const line of lines) {
        console.log(line);
    }
}
