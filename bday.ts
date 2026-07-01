#!/usr/bin/env node

import { DATES_API_URL, fetchBdayConfig, type BdayConfig } from "./lib/bdayApi";

const DAY_MS = 24 * 60 * 60 * 1000;

function usage(): void {
  console.log("Usage:");
  console.log("  bday");
  console.log("");
  console.log(`Birthdays API: ${DATES_API_URL}`);
}

function parseIsoDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Invalid date format "${value}". Expected YYYY-MM-DD.`);
  }
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date "${value}".`);
  }
  return date;
}

function utcStartOfToday(): Date {
  const now = new Date();
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

async function loadBdayConfig(): Promise<BdayConfig> {
  const config = await fetchBdayConfig();
  if (!config) {
    throw new Error(`Failed to load birthdays from ${DATES_API_URL}.`);
  }
  return config;
}

function printBdayTable(config: BdayConfig): void {
  const today = utcStartOfToday();
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

  if (rows.length === 0) {
    console.log("No valid birthdays found.");
    return;
  }

  for (const line of makeAsciiTable(
    ["Name", "DOB", "Days", "Weeks", "Months", "Normal"],
    rows,
  )) {
    console.log(line);
  }
}

async function main(): Promise<void> {
  try {
    const args = process.argv.slice(2);
    if (args[0] === "--help" || args[0] === "-h") {
      usage();
      return;
    }
    if (args.length > 0) {
      throw new Error("This command takes no arguments.");
    }

    const config = await loadBdayConfig();
    printBdayTable(config);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    console.error("");
    usage();
    process.exit(1);
  }
}

void main();

export {};
