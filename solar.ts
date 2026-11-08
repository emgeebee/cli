#!/usr/bin/env node

import { z } from "zod";

import { flushServiceCache } from "./lib/cache";
import { applyEnergyMonthlyBackfill } from "./lib/energyMonthlyBackfill";
import { loadEnergyDashboardData } from "./lib/energyDashboard";
import { yearlySummaryRowsFromMonthly } from "./lib/energyYearly";
import { fetchSolarData } from "./lib/solarApi";
import { solarMonthlyYieldRowsFromData } from "./lib/solarMonthlyYield";
import { buildSolarCliLines } from "./lib/solarView";

function usage(): void {
  console.log("Usage:");
  console.log("  power");
  console.log("  solar");
  console.log("  octo");
  console.log("  power --backfill-energy-monthly");
  console.log("");
  console.log("Shows solar yield/power plus (when configured) EDF electricity");
  console.log("and Octopus gas tariffs, daily/monthly/yearly totals.");
  console.log("`octo` is an alias for `power`.");
  console.log("");
  console.log("  --backfill-energy-monthly");
  console.log("      Merge spreadsheet history into the monthly energy cache.");
}

async function main(): Promise<void> {
  try {
    const args = process.argv.slice(2);
    if (args[0] === "--help" || args[0] === "-h") {
      usage();
      return;
    }
    if (args[0] === "--backfill-energy-monthly") {
      if (args.length > 1) {
        throw new Error("--backfill-energy-monthly takes no extra arguments.");
      }
      const result = await applyEnergyMonthlyBackfill();
      console.log(
        `Backfilled ${result.written.length} months into energy cache (${result.written[0]} -> ${result.written[result.written.length - 1]}).`,
      );
      console.log(`Monthly cache now has ${result.totalMonths} month(s).`);
      return;
    }
    if (args.length > 0) {
      throw new Error("power/solar/octo does not take arguments.");
    }

    const data = await fetchSolarData();
    const monthlyYields = await solarMonthlyYieldRowsFromData(data);
    let energy = null;
    try {
      energy = await loadEnergyDashboardData();
    } catch {
      // Energy credentials are optional for solar-only use.
      energy = null;
    }
    const yearlySummaries = await yearlySummaryRowsFromMonthly(
      energy?.monthlyForDisplay ?? {},
      monthlyYields,
    );
    for (const line of buildSolarCliLines(data, monthlyYields, energy, yearlySummaries)) {
      console.log(line);
    }
    await Promise.all([flushServiceCache("solar"), flushServiceCache("octo")]);
  } catch (error: unknown) {
    const message =
      error instanceof z.ZodError
        ? `Unexpected solar API response: ${error.issues.map((issue) => issue.message).join("; ")}`
        : error instanceof Error
          ? error.message
          : String(error);
    console.error(message);
    console.error("");
    usage();
    await Promise.all([flushServiceCache("solar"), flushServiceCache("octo")]);
    process.exit(1);
  }
}

void main();

export {};
