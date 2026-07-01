import type { Command } from "commander";

import { loadStationListsConfig, STATIONS_API_URL } from "../lib/listConfig";
import { formatStationListText } from "../lib/formatting";
import { createAppError } from "../lib/errors";
import { runCommand, withGlobalOutputOptions } from "../lib/output";

import { addOutputOptions } from "./shared";

import type { FuelService, OutputOptions } from "../lib/types";

type ListCommandOptions = OutputOptions & {
  refresh?: boolean;
};

export const registerListCommand = (program: Command, fuelService: FuelService): void => {
  const command = addOutputOptions(program.command("list <listName>"))
    .description(`Inspect stations from a named list at ${STATIONS_API_URL}`)
    .option("--refresh", "Refresh cached Fuel Finder data before querying")
    .showHelpAfterError()
    .addHelpText(
      "after",
      `\nStation lists are loaded from ${STATIONS_API_URL}.\nEach list includes a fuel type and station entries with "searchText", optional "display", and optional numeric "sort" (lower first).\nPrices are coloured by rank: cheapest 20% green, dearest 40% red.\n\nExample:\n  fuel list parents`
    );

  command.action(async (listName: string, options: ListCommandOptions, commandInstance: Command) => {
    const outputOptions = withGlobalOutputOptions(commandInstance, options);

    await runCommand(
      "list",
      outputOptions,
      async () => {
        const config = await loadStationListsConfig();
        const listDefinition = config[listName];

        if (!listDefinition) {
          throw createAppError("NOT_FOUND", `List "${listName}" was not found at ${STATIONS_API_URL}.`);
        }

        return fuelService.findStationList(listName, {
          fuelType: listDefinition.fuel,
          queries: listDefinition.stations,
          refresh: options.refresh ?? false
        });
      },
      formatStationListText,
      {
        projectionExamples: ["input.fuelType", "stations.0.selectedPricePencePerLitre", "stations.0.display"]
      }
    );
  });
};
