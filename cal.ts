#!/usr/bin/env node
/**
 * Print a month calendar to the terminal (similar to the `cal` command).
 * Usage: node cal.js                 -> previous 2 months, current, next 10 months
 *        node cal.js [month] [year] -> single month
 */
import { getConfigPath } from "./config";
import {
  buildCalendarLegendLine,
  buildCalendarLines,
  defaultYearWindowFrom,
  fetchCalendarColors,
  joinMonthColumns,
  resolveCalConfig,
  type MonthDef,
} from "./lib/calApi";

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

async function main(): Promise<void> {
  let token: string;
  let birthdayMonthDays: Set<string>;
  try {
    ({ token, birthdayMonthDays } = await resolveCalConfig());
  } catch {
    console.error(`Missing cal token at ${getConfigPath()} (expected config.cal.token).`);
    process.exit(1);
  }

  const { months } = parseArgs();
  const today = new Date();
  const colors = await fetchCalendarColors(token, birthdayMonthDays);
  console.log(buildCalendarLegendLine());
  console.log("");

  const allMonthLines = months.map(({ year, month }) =>
    buildCalendarLines(year, month, today, colors),
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

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Failed to build calendar: ${message}`);
  process.exit(1);
});

export {};
