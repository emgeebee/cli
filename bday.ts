#!/usr/bin/env node

import { buildBdayTableLines, DATES_API_URL, fetchBdayConfig, type BdayConfig } from "./lib/bdayApi";
import { statusLayoutInnerWidth } from "./lib/terminal";

function usage(): void {
  console.log("Usage:");
  console.log("  bday");
  console.log("");
  console.log(`Birthdays API: ${DATES_API_URL}`);
}

async function loadBdayConfig(): Promise<BdayConfig> {
  const config = await fetchBdayConfig();
  if (!config) {
    throw new Error(`Failed to load birthdays from ${DATES_API_URL}.`);
  }
  return config;
}

function printBdayTable(config: BdayConfig): void {
  for (const line of buildBdayTableLines(config, new Date(), undefined, {
    header: false,
    panelWidth: statusLayoutInnerWidth(),
  })) {
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
