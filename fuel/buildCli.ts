import { Command } from "commander";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { registerListCommand } from "./commands/listCommand";
import { registerNearCommand } from "./commands/nearCommand";
import { registerStationCommand } from "./commands/stationCommand";
import { loadConfig } from "./lib/config";
import { createDatasetStore } from "./lib/datasetStore";
import { createFuelService } from "./lib/fuelService";
import { createFuelFinderClient } from "./providers/fuelFinderClient";
import { createPostcodesClient } from "./providers/postcodesClient";

import type { FuelService } from "./lib/types";

export type CliDependencies = {
  fuelService: FuelService;
};

const readPackageVersion = (): string => {
  const candidatePaths = [
    join(__dirname, "..", "..", "package.json"),
    join(__dirname, "..", "package.json")
  ];
  for (const path of candidatePaths) {
    if (!existsSync(path)) {
      continue;
    }
    const parsed = JSON.parse(readFileSync(path, "utf8")) as { version?: unknown };
    if (typeof parsed.version === "string" && parsed.version.trim().length > 0) {
      return parsed.version;
    }
  }
  return "0.0.0";
};
const packageVersion = readPackageVersion();
const TOP_LEVEL_HELP_EXAMPLES = [
  "fuel --list commute",
  "fuel list commute",
  'fuel near "SE1 9SG" --fuel E10',
  'fuel near "51.501,-0.141" --fuel B7_STANDARD --radius 8mi',
  'fuel station "tesco watford"',
  'fuel station "<node-id>" --json --output station.prices.0.pencePerLitre'
].join("\n  ");

export const buildCli = (dependencies?: Partial<CliDependencies>): Command => {
  const config = loadConfig();
  const fuelService =
    dependencies?.fuelService ??
    createFuelService(
      createDatasetStore(config.cacheDir, createFuelFinderClient(config)),
      createPostcodesClient()
    );
  const program = new Command();

  program
    .name("fuel")
    .description("UK fuel prices in your terminal. Built for AI agents, still useful for humans.")
    .option("--no-color", "Disable ANSI colours in text output")
    .showHelpAfterError()
    .showSuggestionAfterError()
    .version(packageVersion);

  registerNearCommand(program, fuelService, config.defaultFuelType);
  registerStationCommand(program, fuelService);
  registerListCommand(program, fuelService);

  program.addHelpText(
    "after",
    `\nOutput defaults to text in a TTY and JSON when piped. Use --json or --text to override.\n\nExamples:\n  ${TOP_LEVEL_HELP_EXAMPLES}`
  );

  return program;
};
