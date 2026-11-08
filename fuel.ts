#!/usr/bin/env node

import { buildCli } from "./fuel/buildCli";
import { handleCliRuntimeError } from "./fuel/lib/cliRuntime";
import { createAppError } from "./fuel/lib/errors";
import { loadStationListsConfig, STATIONS_API_URL } from "./fuel/lib/listConfig";

/** Global flags that do not take a value (used when deciding the default list command). */
const GLOBAL_FLAGS_WITHOUT_VALUE = new Set([
  "--web",
  "--no-color",
  "--help",
  "-h",
  "--version",
  "-V",
]);

const normalizeLegacyListOption = (argv: string[]): string[] => {
  const normalizedArgv = argv[0] === "--" ? argv.slice(1) : argv;
  const listOptionIndex = normalizedArgv.findIndex((argument) => argument === "--list");

  if (listOptionIndex === -1) {
    return normalizedArgv;
  }

  const listName = normalizedArgv[listOptionIndex + 1];

  if (!listName) {
    return normalizedArgv;
  }

  const argumentsWithoutListOption = normalizedArgv.filter(
    (_, index) => index !== listOptionIndex && index !== listOptionIndex + 1
  );

  if (argumentsWithoutListOption.length > 0) {
    return normalizedArgv;
  }

  return ["list", listName];
};

const partitionGlobalFlags = (
  argv: string[],
): { globals: string[]; rest: string[] } => {
  const globals: string[] = [];
  const rest: string[] = [];
  for (const argument of argv) {
    if (GLOBAL_FLAGS_WITHOUT_VALUE.has(argument)) {
      globals.push(argument);
    } else {
      rest.push(argument);
    }
  }
  return { globals, rest };
};

void (async () => {
  let cliArguments = normalizeLegacyListOption(process.argv.slice(2));

  try {
    const { globals, rest } = partitionGlobalFlags(cliArguments);
    if (rest.length === 0) {
      const lists = await loadStationListsConfig();
      const listNames = Object.keys(lists);
      if (listNames.length === 0) {
        throw createAppError(
          "INVALID_INPUT",
          `No station lists returned from ${STATIONS_API_URL}.`
        );
      }
      cliArguments = [...globals, "list", listNames[0]!];
    } else {
      cliArguments = [...globals, ...rest];
    }

    await buildCli().parseAsync([process.argv[0] ?? "node", process.argv[1] ?? "fuel", ...cliArguments]);
  } catch (error: unknown) {
    handleCliRuntimeError(error, cliArguments);
  }
})();

export {};
