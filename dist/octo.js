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

// octo.ts
var octo_exports = {};
module.exports = __toCommonJS(octo_exports);
var import_node_fs2 = require("node:fs");

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

// octo.ts
var OCTOPUS_BASE_URL = "https://api.octopus.energy/v1";
var DAY_MS = 24 * 60 * 60 * 1e3;
var ANSI_RESET = "\x1B[0m";
var ANSI_GREEN = "\x1B[32m";
var ANSI_YELLOW = "\x1B[33m";
var ANSI_ORANGE = "\x1B[38;5;208m";
var ANSI_RED = "\x1B[31m";
var ANSI_BRIGHT_GREEN = "\x1B[92m";
var ANSI_AMBER_GAS = "\x1B[38;5;214m";
var ANSI_BRIGHT_RED = "\x1B[91m";
var ANSI_REGEX = /\x1b\[[0-9;]*m/g;
function usage() {
  console.log("Usage:");
  console.log("  octo");
  console.log("");
  console.log("Credentials can come from :");
  console.log(`  Config file: ${getConfigPath()} (section: "octo")`);
  console.log("");
  console.log("Optional:");
  console.log("  OCTOPUS_GAS_KWH_PER_UNIT (default 11.2)");
}
function resolveOctoCredentials() {
  const parseGasFactor = (value) => {
    if (!value) return null;
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) {
      throw new Error("OCTOPUS_GAS_KWH_PER_UNIT must be a positive number.");
    }
    return n;
  };
  const config = readPhoneCliConfig();
  const octo = config.octo || {};
  const token = String(octo.basicAuthToken || octo.token || "").trim();
  const accountNumber = String(octo.accountNumber || "").trim();
  const envGasFactor = String(
    octo.gasKwhPerUnit || octo.gas_kwh_per_unit || ""
  ).trim();
  const configuredGasFactor = parseGasFactor(
    String(octo.gasKwhPerUnit || octo.gas_kwh_per_unit || "").trim() || void 0
  );
  if (!token || !accountNumber) {
    throw new Error(
      [
        "Missing Octopus credentials.",
        `Configure ${getConfigPath()} with:`,
        `{ "octo": { "basicAuthToken": "...", "accountNumber": "A-..." } }`
      ].join(" ")
    );
  }
  return {
    token,
    accountNumber,
    gasKwhPerUnit: parseGasFactor(envGasFactor) ?? configuredGasFactor ?? 11.2
  };
}
function latestAgreement(agreements) {
  if (!agreements || agreements.length === 0) {
    throw new Error("No agreement found on meter point.");
  }
  const sorted = [...agreements].sort((a, b) => {
    const aTs = new Date(a.valid_from || "").getTime();
    const bTs = new Date(b.valid_from || "").getTime();
    return aTs - bTs;
  });
  return sorted[sorted.length - 1];
}
function productFromTariffCode(tariffCode) {
  const parts = tariffCode.split("-").slice(0, -1).slice(2);
  if (parts.length === 0) {
    throw new Error(
      `Unable to derive product code from tariff code: ${tariffCode}`
    );
  }
  return parts.join("-");
}
function deriveTariffs(account) {
  const property = account.properties?.[0];
  if (!property) {
    throw new Error("No property found on account.");
  }
  const ePoints = property.electricity_meter_points || [];
  const gPoints = property.gas_meter_points || [];
  const emPoint = ePoints[0];
  const gmPoint = gPoints[0];
  if (!emPoint || !gmPoint) {
    throw new Error("Electricity and gas meter points are required.");
  }
  const meterRefs = (points, key) => {
    const refs = [];
    for (const point of points || []) {
      const mpxn = String(point[key] || "").trim();
      if (!mpxn) continue;
      for (const meter of point.meters || []) {
        const serial = String(meter.serial_number || "").trim();
        if (!serial) continue;
        refs.push({ mpxn, serial });
      }
    }
    const seen = /* @__PURE__ */ new Set();
    return refs.filter((ref) => {
      const id = `${ref.mpxn}::${ref.serial}`;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  };
  const electricityMeters = meterRefs(ePoints, "mpan").map((m) => ({
    mpan: m.mpxn,
    serial: m.serial
  }));
  const gasMeters = meterRefs(gPoints, "mprn").map((m) => ({
    mprn: m.mpxn,
    serial: m.serial
  }));
  if (electricityMeters.length === 0 || gasMeters.length === 0) {
    throw new Error("Missing electricity or gas meter serials on account.");
  }
  const etariff = latestAgreement(emPoint.agreements);
  const gtariff = latestAgreement(gmPoint.agreements);
  if (!etariff.tariff_code || !gtariff.tariff_code) {
    throw new Error("Missing tariff_code on one or more agreements.");
  }
  const eProduct = productFromTariffCode(etariff.tariff_code);
  const gProduct = productFromTariffCode(gtariff.tariff_code);
  return {
    electricityMeters,
    gasMeters,
    etariff,
    gtariff,
    etariffPrices: `${OCTOPUS_BASE_URL}/products/${eProduct}/electricity-tariffs/${etariff.tariff_code}/standard-unit-rates/`,
    gtariffPrices: `${OCTOPUS_BASE_URL}/products/${gProduct}/gas-tariffs/${gtariff.tariff_code}/standard-unit-rates/`,
    etariffStanding: `${OCTOPUS_BASE_URL}/products/${eProduct}/electricity-tariffs/${etariff.tariff_code}/standing-charges/`,
    gtariffStanding: `${OCTOPUS_BASE_URL}/products/${gProduct}/gas-tariffs/${gtariff.tariff_code}/standing-charges/`
  };
}
async function fetchOctopusJson(url, token) {
  const raw = token.trim();
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${Buffer.from(`${raw}`).toString("base64")}`
    }
  });
  if (response.ok) {
    return await response.json();
  }
  if (response.status !== 401) {
    throw new Error(
      `Octopus API request failed (${response.status}) for ${url}`
    );
  }
  throw new Error(`Octopus API request failed (${response.status}) for ${url}`);
}
async function fetchAllOctopusResults(url, token) {
  const all = [];
  let nextUrl = url;
  let pageGuard = 0;
  while (nextUrl) {
    pageGuard += 1;
    if (pageGuard > 500) {
      throw new Error("Too many Octopus API pages while fetching results.");
    }
    const page = await fetchOctopusJson(nextUrl, token);
    all.push(...page.results || []);
    nextUrl = page.next || null;
  }
  return all;
}
function toIsoNoMs(date) {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}
function ratesUrlWithWindow(baseUrl, from, to) {
  const url = new URL(baseUrl);
  url.searchParams.set("period_from", toIsoNoMs(from));
  url.searchParams.set("period_to", toIsoNoMs(to));
  return url.toString();
}
function shouldUseColor() {
  return Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
}
function colorize(text, color) {
  if (!shouldUseColor()) return text;
  return `${color}${text}${ANSI_RESET}`;
}
function formatWindow(rate) {
  const from = rate.valid_from ? new Date(rate.valid_from) : null;
  const to = rate.valid_to ? new Date(rate.valid_to) : null;
  if (!from || Number.isNaN(from.getTime()) || !to || Number.isNaN(to.getTime())) {
    return "unknown";
  }
  const dayLabel = from.toLocaleDateString("en-GB", {
    weekday: "short",
    timeZone: "Europe/London"
  });
  const day = from.toLocaleDateString("en-GB", {
    day: "numeric",
    timeZone: "Europe/London"
  });
  const month = from.toLocaleDateString("en-GB", {
    month: "numeric",
    timeZone: "Europe/London"
  });
  const startTime = from.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/London"
  });
  const endTime = to.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/London"
  });
  const capDay = dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1).toLowerCase();
  return `${capDay} ${day}/${month} ${startTime} -> ${endTime}`;
}
function colorForRate(rateIncVat, fuel) {
  if (fuel === "electricity") {
    if (rateIncVat <= 5) return ANSI_GREEN;
    if (rateIncVat <= 12) return ANSI_YELLOW;
    if (rateIncVat < 20) return ANSI_ORANGE;
    return ANSI_RED;
  }
  if (rateIncVat < 4) return ANSI_GREEN;
  if (rateIncVat <= 5) return ANSI_YELLOW;
  if (rateIncVat < 6) return ANSI_ORANGE;
  return ANSI_RED;
}
function formatRateLine(rate, fuel) {
  const window = formatWindow(rate);
  const inc = rate.value_inc_vat == null ? "?" : `${rate.value_inc_vat.toFixed(4)}p`;
  if (rate.value_inc_vat == null) {
    return `${window} | ${inc}`;
  }
  return `${window} | ${colorize(inc, colorForRate(rate.value_inc_vat, fuel))}`;
}
function printRates(title, rates, fuel) {
  console.log("");
  console.log(title);
  if (rates.length === 0) {
    console.log("- No rates returned for selected window.");
    return;
  }
  const sorted = [...rates].sort((a, b) => {
    const aTs = new Date(a.valid_from || "").getTime();
    const bTs = new Date(b.valid_from || "").getTime();
    return aTs - bTs;
  });
  for (const rate of sorted) {
    console.log(`- ${formatRateLine(rate, fuel)}`);
  }
}
function padCell(value, width) {
  const visible = value.replace(ANSI_REGEX, "").length;
  return value + " ".repeat(Math.max(0, width - visible));
}
function makeAsciiTable(headers, rows) {
  const widths = headers.map(
    (header, idx) => Math.max(
      header.replace(ANSI_REGEX, "").length,
      ...rows.map((row) => (row[idx] || "").replace(ANSI_REGEX, "").length)
    )
  );
  const border = `+-${widths.map((w) => "-".repeat(w)).join("-+-")}-+`;
  const headerLine = `| ${headers.map((h, i) => padCell(h, widths[i])).join(" | ")} |`;
  const body = rows.map(
    (row) => `| ${row.map((v, i) => padCell(v || "", widths[i])).join(" | ")} |`
  );
  return [border, headerLine, border, ...body, border];
}
function dayKeyUK(date) {
  const y = date.toLocaleDateString("en-CA", { timeZone: "Europe/London" });
  return y;
}
function dayLabelShort(dayKey) {
  const d = /* @__PURE__ */ new Date(`${dayKey}T00:00:00Z`);
  const weekday = d.toLocaleDateString("en-GB", {
    weekday: "short",
    timeZone: "Europe/London"
  });
  const day = d.toLocaleDateString("en-GB", {
    day: "numeric",
    timeZone: "Europe/London"
  });
  const month = d.toLocaleDateString("en-GB", {
    month: "numeric",
    timeZone: "Europe/London"
  });
  const capDay = weekday.charAt(0).toUpperCase() + weekday.slice(1).toLowerCase();
  return `${capDay} ${day}/${month}`;
}
function lookupUnitRatePence(rates, atIso) {
  const at = new Date(atIso).getTime();
  if (Number.isNaN(at)) return 0;
  let fallback = null;
  for (const rate of rates) {
    if (rate.value_inc_vat == null) continue;
    const from = rate.valid_from ? new Date(rate.valid_from).getTime() : Number.NaN;
    const to = rate.valid_to ? new Date(rate.valid_to).getTime() : Number.POSITIVE_INFINITY;
    if (Number.isNaN(from)) continue;
    if (at >= from) {
      fallback = rate.value_inc_vat;
    }
    if (at >= from && at < to) return rate.value_inc_vat;
  }
  return fallback ?? 0;
}
function standingChargePerDayPence(standingRates) {
  if (standingRates.length === 0) return 0;
  const now = Date.now();
  const active = standingRates.find((rate) => {
    const from = rate.valid_from ? new Date(rate.valid_from).getTime() : Number.NaN;
    const to = rate.valid_to ? new Date(rate.valid_to).getTime() : Number.NaN;
    return !Number.isNaN(from) && !Number.isNaN(to) && now >= from && now < to && rate.value_inc_vat != null;
  }) || [...standingRates].sort(
    (a, b) => new Date(b.valid_from || "").getTime() - new Date(a.valid_from || "").getTime()
  ).find((rate) => rate.value_inc_vat != null);
  return active?.value_inc_vat || 0;
}
function aggregateDailyBilledPence(consumption, unitRates, standingPencePerDay, unitToKwhFactor = 1) {
  const totals = {};
  const seenDays = /* @__PURE__ */ new Set();
  for (const row of consumption) {
    const start = row.interval_start;
    const kwh = row.consumption;
    if (!start || kwh == null) continue;
    const day = dayKeyUK(new Date(start));
    seenDays.add(day);
    const unitPence = lookupUnitRatePence(unitRates, start);
    totals[day] = (totals[day] || 0) + kwh * unitToKwhFactor * unitPence;
  }
  for (const day of seenDays) {
    totals[day] = (totals[day] || 0) + standingPencePerDay;
  }
  return totals;
}
function aggregateDailyConsumedKwh(consumption, unitToKwhFactor = 1) {
  const totals = {};
  for (const row of consumption) {
    const start = row.interval_start;
    const units = row.consumption;
    if (!start || units == null) continue;
    const day = dayKeyUK(new Date(start));
    totals[day] = (totals[day] || 0) + units * unitToKwhFactor;
  }
  return totals;
}
function formatPence(value) {
  return `${value.toFixed(2)}p`;
}
function formatKwh(value) {
  return `${value.toFixed(2)}kWh`;
}
function formatPoundsFromPence(valuePence) {
  return `\xA3${(valuePence / 100).toFixed(2)}`;
}
function rankedColorByDay(dayKeys, totals, fuel) {
  const rankableDays = dayKeys.slice(0, Math.max(0, dayKeys.length - 2));
  const entries = rankableDays.map((day) => ({ day, value: totals[day] || 0 }));
  entries.sort((a, b) => a.value - b.value);
  const palette = fuel === "electricity" ? { low: ANSI_GREEN, mid: ANSI_ORANGE, high: ANSI_RED } : { low: ANSI_BRIGHT_GREEN, mid: ANSI_AMBER_GAS, high: ANSI_BRIGHT_RED };
  const map = {};
  for (let i = 0; i < entries.length; i += 1) {
    const bucket = i < 4 ? palette.low : i < 8 ? palette.mid : palette.high;
    map[entries[i].day] = bucket;
  }
  return map;
}
function lastNDaysKeysInclusive(end, days) {
  const keys = [];
  const anchor = new Date(end.getTime());
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(anchor.getTime() - i * DAY_MS);
    keys.push(dayKeyUK(d));
  }
  return keys;
}
function monthKeysBackInclusive(now, months) {
  const keys = [];
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    keys.push(`${y}-${m}`);
  }
  return keys;
}
function sortMonthKeysAsc(keys) {
  return [...keys].sort((a, b) => a.localeCompare(b));
}
function startOfMonthUtc(monthKey) {
  return /* @__PURE__ */ new Date(`${monthKey}-01T00:00:00Z`);
}
function nextMonthKey(monthKey) {
  const [yRaw, mRaw] = monthKey.split("-");
  const y = Number(yRaw);
  const m = Number(mRaw);
  const d = new Date(Date.UTC(y, m, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
function daysInMonthKey(monthKey) {
  const start = startOfMonthUtc(monthKey);
  const end = startOfMonthUtc(nextMonthKey(monthKey));
  return Math.round((end.getTime() - start.getTime()) / DAY_MS);
}
function monthLabel(monthKey) {
  const d = startOfMonthUtc(monthKey);
  return d.toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
    timeZone: "Europe/London"
  });
}
function monthKeyFromDayKey(dayKey) {
  return dayKey.slice(0, 7);
}
function currentMonthKey(now) {
  return dayKeyUK(now).slice(0, 7);
}
function priorCalendarMonthKey(monthKeyYm) {
  const [ys, ms] = monthKeyYm.split("-");
  let y = Number(ys);
  let m = Number(ms);
  m -= 1;
  if (m < 1) {
    m = 12;
    y -= 1;
  }
  return `${y}-${String(m).padStart(2, "0")}`;
}
function londonCalendarDayOfMonth(now) {
  const dk = dayKeyUK(now);
  return Number(dk.slice(8));
}
function isDeferredMonthlyStatsWindowUk(now) {
  return londonCalendarDayOfMonth(now) <= 2;
}
var MONTHLY_AVG_EXCLUDED_TRAILING_UK_DAYS = 2;
function ukDayKeyMinusCalendarDays(dayKey, subtractDays) {
  const [yRaw, mRaw, dRaw] = dayKey.split("-").map(Number);
  const d = new Date(Date.UTC(yRaw, mRaw - 1, dRaw));
  d.setUTCDate(d.getUTCDate() - subtractDays);
  const y = d.getUTCFullYear();
  const mo = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  return `${y}-${String(mo).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
function latestUkDayKeyIncludedInMonthlyAverages(now) {
  return ukDayKeyMinusCalendarDays(
    dayKeyUK(now),
    MONTHLY_AVG_EXCLUDED_TRAILING_UK_DAYS
  );
}
function filterDailyTotalsThroughDayInclusive(totals, lastDayInclusive) {
  const out = {};
  for (const [k, v] of Object.entries(totals)) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(k) && k <= lastDayInclusive) {
      out[k] = v;
    }
  }
  return out;
}
function suppressCachingPendingPriorFinishedMonthUk(now) {
  return isDeferredMonthlyStatsWindowUk(now);
}
function evictUnsettledPriorMonthFromCache(cache, now) {
  if (!suppressCachingPendingPriorFinishedMonthUk(now)) return false;
  const prior = priorCalendarMonthKey(currentMonthKey(now));
  if (!cache[prior]) return false;
  delete cache[prior];
  return true;
}
function isFinishedMonth(monthKey, now) {
  return monthKey < currentMonthKey(now);
}
function shouldPersistFinishedMonthTotals(monthKey, now) {
  if (!isFinishedMonth(monthKey, now)) return false;
  if (suppressCachingPendingPriorFinishedMonthUk(now) && monthKey === priorCalendarMonthKey(currentMonthKey(now))) {
    return false;
  }
  return true;
}
function cachedFinishedMonthIsComplete(monthKey, cache) {
  const rec = cache[monthKey];
  if (!rec) return false;
  return rec.days >= daysInMonthKey(monthKey);
}
function monthlyAverageCacheFromConfig() {
  const config = readPhoneCliConfig();
  const octo = config.octo || {};
  const raw = octo.monthlyAverageCache;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const cache = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!/^\d{4}-\d{2}$/.test(key)) continue;
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const rec = value;
    const eCost = Number(rec.eCost);
    const gCost = Number(rec.gCost);
    const eKwh = Number(rec.eKwh);
    const gKwh = Number(rec.gKwh);
    const days = Number(rec.days);
    if (!Number.isFinite(eCost) || !Number.isFinite(gCost) || !Number.isFinite(eKwh) || !Number.isFinite(gKwh) || !Number.isFinite(days) || days <= 0) {
      continue;
    }
    cache[key] = {
      eCost,
      gCost,
      eKwh,
      gKwh,
      days,
      updatedAt: String(rec.updatedAt || "")
    };
  }
  return cache;
}
function saveMonthlyAverageCache(cache) {
  const configPath = getConfigPath();
  const config = readPhoneCliConfig();
  const octo = config.octo || {};
  octo.monthlyAverageCache = cache;
  config.octo = octo;
  (0, import_node_fs2.writeFileSync)(configPath, `${JSON.stringify(config, null, 2)}
`, "utf8");
}
function monthlyAveragesFromDaily(eDailyCost, gDailyCost, eDailyKwh, gDailyKwh) {
  const keys = /* @__PURE__ */ new Set([
    ...Object.keys(eDailyCost),
    ...Object.keys(gDailyCost),
    ...Object.keys(eDailyKwh),
    ...Object.keys(gDailyKwh)
  ]);
  const sums = {};
  for (const dayKey of keys) {
    const month = monthKeyFromDayKey(dayKey);
    sums[month] ||= { eCost: 0, gCost: 0, eKwh: 0, gKwh: 0, days: 0 };
    sums[month].eCost += eDailyCost[dayKey] || 0;
    sums[month].gCost += gDailyCost[dayKey] || 0;
    sums[month].eKwh += eDailyKwh[dayKey] || 0;
    sums[month].gKwh += gDailyKwh[dayKey] || 0;
    sums[month].days += 1;
  }
  const out = {};
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  for (const [month, sum] of Object.entries(sums)) {
    if (sum.days <= 0) continue;
    out[month] = {
      eCost: sum.eCost / sum.days,
      gCost: sum.gCost / sum.days,
      eKwh: sum.eKwh / sum.days,
      gKwh: sum.gKwh / sum.days,
      days: sum.days,
      updatedAt: nowIso
    };
  }
  return out;
}
function mergeDailyTotals(base, extra) {
  const merged = { ...base };
  for (const [day, value] of Object.entries(extra)) {
    merged[day] = (merged[day] || 0) + value;
  }
  return merged;
}
function printPast14DaysHorizontal(eDailyCost, gDailyCost, eDailyKwh, gDailyKwh, now) {
  const dayKeys = lastNDaysKeysInclusive(now, 14);
  const eColorByDay = rankedColorByDay(dayKeys, eDailyCost, "electricity");
  const gColorByDay = rankedColorByDay(dayKeys, gDailyCost, "gas");
  console.log("");
  console.log("Past 14 days (daily totals, inc VAT + consumed kWh)");
  const headers = [
    "Date",
    "\u26A1 cost",
    "Gas cost",
    "Total cost",
    "\u26A1 kWh",
    "Gas kWh"
  ];
  const rows = dayKeys.map((k) => [
    dayLabelShort(k),
    colorize(formatPence(eDailyCost[k] || 0), eColorByDay[k] || ANSI_RESET),
    colorize(formatPence(gDailyCost[k] || 0), gColorByDay[k] || ANSI_RESET),
    formatPence((eDailyCost[k] || 0) + (gDailyCost[k] || 0)),
    formatKwh(eDailyKwh[k] || 0),
    formatKwh(gDailyKwh[k] || 0)
  ]);
  for (const line of makeAsciiTable(headers, rows)) {
    console.log(line);
  }
}
function printAverageMonthlySummary(months, cache, now) {
  void now;
  const rows = months.map((month) => {
    const item = cache[month];
    if (!item) return [monthLabel(month), "-", "-", "-", "-", "-"];
    return [
      monthLabel(month),
      formatPence(item.eCost),
      formatPence(item.gCost),
      formatPence(item.eCost + item.gCost),
      formatKwh(item.eKwh),
      formatKwh(item.gKwh)
    ];
  });
  console.log("");
  console.log(
    `Average daily totals by calendar month (inc VAT + consumed kWh)`
  );
  for (const line of makeAsciiTable(
    ["Month", "\u26A1 cost", "Gas cost", "Total cost", "\u26A1 kWh", "Gas kWh"],
    rows
  )) {
    console.log(line);
  }
}
function previousMonthKey(now) {
  return priorCalendarMonthKey(currentMonthKey(now));
}
function printFinalMonthTotals(cache, now) {
  const currentKey = currentMonthKey(now);
  const prevKey = previousMonthKey(now);
  const skipped = MONTHLY_AVG_EXCLUDED_TRAILING_UK_DAYS;
  const rows = [
    {
      key: currentKey,
      label: `${monthLabel(currentKey)}`
    },
    {
      key: prevKey,
      label: `${monthLabel(prevKey)}`
    }
  ].map((item) => {
    const rec = cache[item.key];
    if (!rec) {
      return [item.label, "-", "-", "-"];
    }
    const eTotal = rec.eCost * rec.days;
    const gTotal = rec.gCost * rec.days;
    return [
      item.label,
      formatPoundsFromPence(eTotal),
      formatPoundsFromPence(gTotal),
      formatPoundsFromPence(eTotal + gTotal)
    ];
  });
  console.log("");
  console.log("Monthly total cost summary");
  for (const line of makeAsciiTable(
    ["Month", "\u26A1 total", "Gas total", "Total"],
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
    const { token, accountNumber, gasKwhPerUnit } = resolveOctoCredentials();
    const accountUrl = `${OCTOPUS_BASE_URL}/accounts/${accountNumber}/`;
    const account = await fetchOctopusJson(
      accountUrl,
      token
    );
    const derived = deriveTariffs(account);
    const from = /* @__PURE__ */ new Date();
    const to = new Date(from.getTime() + 2 * DAY_MS);
    const historyFrom = new Date(from.getTime() - 35 * DAY_MS);
    const eRatesUrl = ratesUrlWithWindow(derived.etariffPrices, from, to);
    const gRatesUrl = ratesUrlWithWindow(derived.gtariffPrices, from, to);
    const eHistoryUrl = ratesUrlWithWindow(
      derived.etariffPrices,
      historyFrom,
      from
    );
    const gHistoryUrl = ratesUrlWithWindow(
      derived.gtariffPrices,
      historyFrom,
      from
    );
    const eStandingUrl = ratesUrlWithWindow(
      derived.etariffStanding,
      historyFrom,
      from
    );
    const gStandingUrl = ratesUrlWithWindow(
      derived.gtariffStanding,
      historyFrom,
      from
    );
    const eConsumptionUrls = derived.electricityMeters.map(
      (meter) => `${OCTOPUS_BASE_URL}/electricity-meter-points/${encodeURIComponent(meter.mpan)}/meters/${encodeURIComponent(meter.serial)}/consumption/?period_from=${encodeURIComponent(toIsoNoMs(historyFrom))}&period_to=${encodeURIComponent(toIsoNoMs(from))}&order_by=period`
    );
    const gConsumptionUrls = derived.gasMeters.map(
      (meter) => `${OCTOPUS_BASE_URL}/gas-meter-points/${encodeURIComponent(meter.mprn)}/meters/${encodeURIComponent(meter.serial)}/consumption/?period_from=${encodeURIComponent(toIsoNoMs(historyFrom))}&period_to=${encodeURIComponent(toIsoNoMs(from))}&order_by=period`
    );
    const [
      electricityResults,
      gasResults,
      eHistoryResults,
      gHistoryResults,
      eStandingResults,
      gStandingResults
    ] = await Promise.all([
      fetchAllOctopusResults(eRatesUrl, token),
      fetchAllOctopusResults(gRatesUrl, token),
      fetchAllOctopusResults(eHistoryUrl, token),
      fetchAllOctopusResults(gHistoryUrl, token),
      fetchAllOctopusResults(eStandingUrl, token),
      fetchAllOctopusResults(gStandingUrl, token)
    ]);
    const [eConsumptionPages, gConsumptionPages] = await Promise.all([
      Promise.all(
        eConsumptionUrls.map(
          (url) => fetchAllOctopusResults(url, token)
        )
      ),
      Promise.all(
        gConsumptionUrls.map(
          (url) => fetchAllOctopusResults(url, token)
        )
      )
    ]);
    const eConsumptionResults = eConsumptionPages.flat();
    const gConsumptionResults = gConsumptionPages.flat();
    console.log(`Octopus account ${accountNumber}`);
    console.log(`Window: ${toIsoNoMs(from)} -> ${toIsoNoMs(to)}`);
    console.log(`Electric tariff: ${derived.etariff.tariff_code}`);
    console.log(`Gas tariff: ${derived.gtariff.tariff_code}`);
    console.log(`Gas conversion: ${gasKwhPerUnit} kWh/unit`);
    printRates(
      "Electricity rates (inc VAT)",
      electricityResults,
      "electricity"
    );
    printRates("Gas rates (inc VAT)", gasResults, "gas");
    const eDaily = aggregateDailyBilledPence(
      eConsumptionResults,
      eHistoryResults,
      standingChargePerDayPence(eStandingResults),
      1
    );
    const gDaily = aggregateDailyBilledPence(
      gConsumptionResults,
      gHistoryResults,
      standingChargePerDayPence(gStandingResults),
      gasKwhPerUnit
    );
    const eDailyKwh = aggregateDailyConsumedKwh(eConsumptionResults, 1);
    const gDailyKwh = aggregateDailyConsumedKwh(
      gConsumptionResults,
      gasKwhPerUnit
    );
    printPast14DaysHorizontal(eDaily, gDaily, eDailyKwh, gDailyKwh, from);
    if (isDeferredMonthlyStatsWindowUk(from)) {
      console.log("");
      console.log("Average daily totals by calendar month: not ready yet");
      console.log("");
      console.log("Monthly total cost summary: not ready yet");
    } else {
      const lastUkDayInAvg = latestUkDayKeyIncludedInMonthlyAverages(from);
      const fetchWindowMonths = monthKeysBackInclusive(from, 3);
      const monthlyCache = monthlyAverageCacheFromConfig();
      const unsettledPriorEvicted = evictUnsettledPriorMonthFromCache(
        monthlyCache,
        from
      );
      const monthlyForDisplay = { ...monthlyCache };
      const cachedMonths = sortMonthKeysAsc(Object.keys(monthlyCache));
      const monthKeys = sortMonthKeysAsc(
        Array.from(/* @__PURE__ */ new Set([...cachedMonths, ...fetchWindowMonths]))
      );
      const priorFinishedMonth = previousMonthKey(from);
      const missingMonths = fetchWindowMonths.filter((m) => {
        if (!monthlyCache[m]) return true;
        return m === priorFinishedMonth && shouldPersistFinishedMonthTotals(m, from) && !cachedFinishedMonthIsComplete(m, monthlyCache);
      });
      let eMonthlyDaily = { ...eDaily };
      let gMonthlyDaily = { ...gDaily };
      let eMonthlyKwh = { ...eDailyKwh };
      let gMonthlyKwh = { ...gDailyKwh };
      if (missingMonths.length > 0) {
        const oldestMissing = missingMonths[0];
        const newestMissing = missingMonths[missingMonths.length - 1];
        const monthlyFrom = startOfMonthUtc(oldestMissing);
        const monthlyTo = startOfMonthUtc(nextMonthKey(newestMissing));
        const gapEnd = monthlyTo < historyFrom ? monthlyTo : historyFrom;
        if (monthlyFrom < gapEnd) {
          const eMonthlyHistoryUrl = ratesUrlWithWindow(
            derived.etariffPrices,
            monthlyFrom,
            gapEnd
          );
          const gMonthlyHistoryUrl = ratesUrlWithWindow(
            derived.gtariffPrices,
            monthlyFrom,
            gapEnd
          );
          const eMonthlyStandingUrl = ratesUrlWithWindow(
            derived.etariffStanding,
            monthlyFrom,
            gapEnd
          );
          const gMonthlyStandingUrl = ratesUrlWithWindow(
            derived.gtariffStanding,
            monthlyFrom,
            gapEnd
          );
          const eMonthlyConsumptionUrls = derived.electricityMeters.map(
            (meter) => `${OCTOPUS_BASE_URL}/electricity-meter-points/${encodeURIComponent(meter.mpan)}/meters/${encodeURIComponent(meter.serial)}/consumption/?period_from=${encodeURIComponent(toIsoNoMs(monthlyFrom))}&period_to=${encodeURIComponent(toIsoNoMs(gapEnd))}&order_by=period`
          );
          const gMonthlyConsumptionUrls = derived.gasMeters.map(
            (meter) => `${OCTOPUS_BASE_URL}/gas-meter-points/${encodeURIComponent(meter.mprn)}/meters/${encodeURIComponent(meter.serial)}/consumption/?period_from=${encodeURIComponent(toIsoNoMs(monthlyFrom))}&period_to=${encodeURIComponent(toIsoNoMs(gapEnd))}&order_by=period`
          );
          const [
            eGapRates,
            gGapRates,
            eGapStanding,
            gGapStanding,
            eGapConsumptionPages,
            gGapConsumptionPages
          ] = await Promise.all([
            fetchAllOctopusResults(eMonthlyHistoryUrl, token),
            fetchAllOctopusResults(gMonthlyHistoryUrl, token),
            fetchAllOctopusResults(eMonthlyStandingUrl, token),
            fetchAllOctopusResults(gMonthlyStandingUrl, token),
            Promise.all(
              eMonthlyConsumptionUrls.map(
                (url) => fetchAllOctopusResults(url, token)
              )
            ),
            Promise.all(
              gMonthlyConsumptionUrls.map(
                (url) => fetchAllOctopusResults(url, token)
              )
            )
          ]);
          const eGapConsumption = eGapConsumptionPages.flat();
          const gGapConsumption = gGapConsumptionPages.flat();
          eMonthlyDaily = mergeDailyTotals(
            eMonthlyDaily,
            aggregateDailyBilledPence(
              eGapConsumption,
              eGapRates,
              standingChargePerDayPence(eGapStanding),
              1
            )
          );
          gMonthlyDaily = mergeDailyTotals(
            gMonthlyDaily,
            aggregateDailyBilledPence(
              gGapConsumption,
              gGapRates,
              standingChargePerDayPence(gGapStanding),
              gasKwhPerUnit
            )
          );
          eMonthlyKwh = mergeDailyTotals(
            eMonthlyKwh,
            aggregateDailyConsumedKwh(eGapConsumption, 1)
          );
          gMonthlyKwh = mergeDailyTotals(
            gMonthlyKwh,
            aggregateDailyConsumedKwh(gGapConsumption, gasKwhPerUnit)
          );
        }
      }
      eMonthlyDaily = filterDailyTotalsThroughDayInclusive(
        eMonthlyDaily,
        lastUkDayInAvg
      );
      gMonthlyDaily = filterDailyTotalsThroughDayInclusive(
        gMonthlyDaily,
        lastUkDayInAvg
      );
      eMonthlyKwh = filterDailyTotalsThroughDayInclusive(eMonthlyKwh, lastUkDayInAvg);
      gMonthlyKwh = filterDailyTotalsThroughDayInclusive(gMonthlyKwh, lastUkDayInAvg);
      const computedMonthly = monthlyAveragesFromDaily(
        eMonthlyDaily,
        gMonthlyDaily,
        eMonthlyKwh,
        gMonthlyKwh
      );
      for (const mk of Object.keys(computedMonthly)) {
        if (monthlyCache[mk] && !missingMonths.includes(mk) && mk !== currentMonthKey(from)) {
          continue;
        }
        monthlyForDisplay[mk] = computedMonthly[mk];
      }
      if (missingMonths.length > 0) {
        for (const month of missingMonths) {
          if (!computedMonthly[month]) continue;
          if (shouldPersistFinishedMonthTotals(month, from)) {
            monthlyCache[month] = computedMonthly[month];
          }
        }
        saveMonthlyAverageCache(monthlyCache);
      } else if (unsettledPriorEvicted) {
        saveMonthlyAverageCache(monthlyCache);
      }
      printAverageMonthlySummary(monthKeys, monthlyForDisplay, from);
      printFinalMonthTotals(monthlyForDisplay, from);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    console.error("");
    usage();
    process.exit(1);
  }
}
void main();
