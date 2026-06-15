#!/usr/bin/env node

import { z } from "zod";

import { fetchSolarData } from "./lib/solarApi";
import { buildSolarCliLines } from "./lib/solarView";

function usage(): void {
  console.log("Usage:");
  console.log("  solar");
  console.log("");
  console.log("Shows solar daily yield, rolling averages, and a power graph.");
}

async function main(): Promise<void> {
  try {
    const args = process.argv.slice(2);
    if (args[0] === "--help" || args[0] === "-h") {
      usage();
      return;
    }
    if (args.length > 0) {
      throw new Error("solar does not take arguments.");
    }

    const data = await fetchSolarData();
    for (const line of buildSolarCliLines(data)) {
      console.log(line);
    }
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
    process.exit(1);
  }
}

void main();

export {};
