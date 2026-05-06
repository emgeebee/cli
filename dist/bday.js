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

// bday.ts
var bday_exports = {};
module.exports = __toCommonJS(bday_exports);

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

// bday.ts
var DAY_MS = 24 * 60 * 60 * 1e3;
function usage() {
  console.log("Usage:");
  console.log("  bday");
  console.log("");
  console.log(`Config file: ${getConfigPath()} (section: "bday")`);
}
function parseIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Invalid date format "${value}". Expected YYYY-MM-DD.`);
  }
  const date = /* @__PURE__ */ new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date "${value}".`);
  }
  return date;
}
function utcStartOfToday() {
  const now = /* @__PURE__ */ new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
function daysSince(bd, today) {
  return Math.floor((today.getTime() - bd.getTime()) / DAY_MS);
}
function ymdDiff(from, to) {
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
function normalAgeText(years, months) {
  const y = `${years} year${years === 1 ? "" : "s"}`;
  const m = `${months} month${months === 1 ? "" : "s"}`;
  return `${y}, ${m}`;
}
function padCell(value, width) {
  return value + " ".repeat(Math.max(0, width - value.length));
}
function makeAsciiTable(headers, rows) {
  const widths = headers.map(
    (header, idx) => Math.max(header.length, ...rows.map((row) => (row[idx] || "").length))
  );
  const border = `+-${widths.map((w) => "-".repeat(w)).join("-+-")}-+`;
  const headerLine = `| ${headers.map((h, i) => padCell(h, widths[i])).join(" | ")} |`;
  const body = rows.map((row) => `| ${row.map((v, i) => padCell(v || "", widths[i])).join(" | ")} |`);
  return [border, headerLine, border, ...body, border];
}
function loadBdayConfig() {
  const config = readPhoneCliConfig();
  const bday = config.bday;
  if (!bday || typeof bday !== "object" || Array.isArray(bday)) {
    throw new Error(
      `Missing or invalid "bday" section in ${getConfigPath()}. Expected object keyed by person name.`
    );
  }
  return bday;
}
function printBdayTable(config) {
  const today = utcStartOfToday();
  const rows = [];
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
      normalAgeText(years, months)
    ]);
  }
  if (rows.length === 0) {
    console.log("No valid birthdays found in config.");
    return;
  }
  for (const line of makeAsciiTable(
    ["Name", "DOB", "Days", "Weeks", "Months", "Normal"],
    rows
  )) {
    console.log(line);
  }
}
async function main() {
  try {
    const args = process.argv.slice(2);
    if (args[0] === "--help" || args[0] === "-h") {
      usage();
      return;
    }
    if (args.length > 0) {
      throw new Error("This command takes no arguments.");
    }
    const config = loadBdayConfig();
    printBdayTable(config);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    console.error("");
    usage();
    process.exit(1);
  }
}
void main();
