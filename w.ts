#!/usr/bin/env node

import {
  fetchBbcWeatherAggregated,
  resolveDefaultLocation,
  sanitizeWeatherLocation,
} from "./lib/bbcWeather";
import { buildFullWeatherLines, type WeatherResponse } from "./lib/wApi";

function usage(): void {
  console.log("Usage:");
  console.log("  w");
  console.log("  w <postcode>");
  console.log("");
  console.log("Examples:");
  console.log("  w");
  console.log("  w ws9");
  console.log("  w sw1a");
  console.log("");
}

function parseArgs(argv: string[]): { help?: true; postcode?: string } {
  const args = argv.slice(2);
  if (args[0] === "--help" || args[0] === "-h") {
    return { help: true };
  }
  if (args.length === 0) {
    return { postcode: resolveDefaultLocation() };
  }
  if (args.length > 1) {
    throw new Error("Pass at most one postcode.");
  }
  const postcode = sanitizeWeatherLocation(args[0]);
  if (!postcode) {
    return { postcode: resolveDefaultLocation() };
  }
  return { postcode };
}

async function main(): Promise<void> {
  try {
    const parsed = parseArgs(process.argv);
    if (parsed.help) {
      usage();
      return;
    }
    const postcode = parsed.postcode || resolveDefaultLocation();
    const data = (await fetchBbcWeatherAggregated(postcode)) as WeatherResponse;
    const lines = await buildFullWeatherLines(data, postcode);
    for (const line of lines) {
      console.log(line);
    }
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
