import { Command } from "commander";
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

// `phone_cli` compiles as CommonJS; avoid `import.meta` / `createRequire`.
// Use `__dirname` so the path still works after compilation into `dist/`.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const packageJson = require(join(__dirname, "..", "..", "package.json")) as { version: string };
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
    .version(packageJson.version);

  registerNearCommand(program, fuelService, config.defaultFuelType);
  registerStationCommand(program, fuelService);
  registerListCommand(program, fuelService);

  program.addHelpText(
    "after",
    `\nOutput defaults to text in a TTY and JSON when piped. Use --json or --text to override.\n\nExamples:\n  ${TOP_LEVEL_HELP_EXAMPLES}`
  );

  return program;
};
