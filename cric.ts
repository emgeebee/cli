#!/usr/bin/env node

import { toYmd } from "./bbc";
import {
  cricketFixtureLines,
  fetchTodayCricket,
} from "./lib/cricApi";

function usage(): void {
  console.log("Usage:");
  console.log("  cric");
}

function printFixtures(data: Parameters<typeof cricketFixtureLines>[0], ymd: string): void {
  const lines = cricketFixtureLines(data, ymd);
  if (lines.length === 1 && lines[0] === "none today") {
    console.log("No cricket fixtures found today.");
    return;
  }
  for (const line of lines) {
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

    const today = toYmd(new Date());
    const data = await fetchTodayCricket(today);
    printFixtures(data, today);
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
