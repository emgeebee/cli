import type { Command } from "commander";

import { DEFAULT_LIMIT, DEFAULT_NEAR_SORT, DEFAULT_RADIUS_MILES, SUPPORTED_FUEL_TYPES } from "../lib/constants";
import { parseFuelType, parseLimit, parseNearSort, parseRadiusMiles } from "../lib/commandUtils";
import { createAppError } from "../lib/errors";
import { formatNearText } from "../lib/formatting";
import { runCommand, withGlobalOutputOptions } from "../lib/output";

import { addOutputOptions } from "./shared";

import type { FuelService, FuelType, OutputOptions } from "../lib/types";

type NearCommandOptions = OutputOptions & {
  fuel?: string;
  limit: number;
  radius: number;
  refresh?: boolean;
  sort: string;
};

export const registerNearCommand = (program: Command, fuelService: FuelService, defaultFuelType?: FuelType): void => {
  const command = addOutputOptions(program.command("near <location>"))
    .description("Find stations near a UK postcode or lat,lon coordinates")
    .option("--fuel <fuelType>", `Fuel type: ${SUPPORTED_FUEL_TYPES.join(", ")}`)
    .option("--radius <distance>", "Search radius in miles or km", parseRadiusMiles, DEFAULT_RADIUS_MILES)
    .option("--limit <count>", "Maximum number of stations to return", parseLimit, DEFAULT_LIMIT)
    .option("--sort <sort>", "Sort by best, price, distance, or freshest", DEFAULT_NEAR_SORT)
    .option("--refresh", "Refresh cached Fuel Finder data before querying")
    .showHelpAfterError()
    .addHelpText(
      "after",
      '\nExamples:\n  fuel near "SE1 9SG" --fuel E10\n  fuel near "SE1 9SG"   # uses fuel.defaultFuelType from ~/.phone_cli.json when set\n  fuel near "51.501,-0.141" --fuel B7_STANDARD --radius 8mi --limit 5\n  fuel near "NE1 1AA" --fuel E5 --sort freshest --json'
    );

  command.action(async (location: string, options: NearCommandOptions, commandInstance: Command) => {
    const outputOptions = withGlobalOutputOptions(commandInstance, options);
    const requestedFuel = options.fuel ?? defaultFuelType;
    if (!requestedFuel) {
      throw createAppError(
        "INVALID_INPUT",
        "Missing fuel type. Pass --fuel <fuelType> or set fuel.defaultFuelType in ~/.phone_cli.json."
      );
    }

    await runCommand(
      "near",
      outputOptions,
      () =>
        fuelService.findStationsNear(location, {
          fuelType: parseFuelType(requestedFuel),
          limit: options.limit,
          radiusMiles: options.radius,
          refresh: options.refresh ?? false,
          sort: parseNearSort(options.sort)
        }),
      formatNearText,
      {
        projectionExamples: [
          "stations.0.selectedPricePencePerLitre",
          "stations.0.nodeId",
          "resolvedLocation.postcode"
        ]
      }
    );
  });
};
