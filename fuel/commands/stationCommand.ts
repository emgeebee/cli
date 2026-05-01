import type { Command } from "commander";

import { formatStationText } from "../lib/formatting";
import { runCommand, withGlobalOutputOptions } from "../lib/output";

import { addOutputOptions } from "./shared";

import type { FuelService, OutputOptions } from "../lib/types";

type StationCommandOptions = OutputOptions & {
  refresh?: boolean;
};

export const registerStationCommand = (program: Command, fuelService: FuelService): void => {
  const command = addOutputOptions(program.command("station <query>"))
    .description("Inspect a station by node ID or cached local text match")
    .option("--refresh", "Refresh cached Fuel Finder data before querying")
    .showHelpAfterError()
    .addHelpText(
      "after",
      '\nExamples:\n  fuel station "0028acef..."\n  fuel station "tesco watford"\n  fuel station "SL6 0AA" --json'
    );

  command.action(async (query: string, options: StationCommandOptions, commandInstance: Command) => {
    const outputOptions = withGlobalOutputOptions(commandInstance, options);

    await runCommand(
      "station",
      outputOptions,
      () =>
        fuelService.findStation(query, {
          refresh: options.refresh ?? false
        }),
      formatStationText,
      {
        projectionExamples: [
          "station.nodeId",
          "station.prices.0.pencePerLitre",
          "station.location.postcode"
        ]
      }
    );
  });
};
