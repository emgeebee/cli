#!/usr/bin/env node

import { buildCli } from "./fuel/buildCli";
import { handleCliRuntimeError } from "./fuel/lib/cliRuntime";

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

const cliArguments = normalizeLegacyListOption(process.argv.slice(2));

void buildCli()
  .parseAsync([process.argv[0] ?? "node", process.argv[1] ?? "fuel", ...cliArguments])
  .catch((error: unknown) => {
    handleCliRuntimeError(error, cliArguments);
  });

export {};
