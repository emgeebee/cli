#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const buildCli_1 = require("./fuel/buildCli");
const cliRuntime_1 = require("./fuel/lib/cliRuntime");
const normalizeLegacyListOption = (argv) => {
    const normalizedArgv = argv[0] === "--" ? argv.slice(1) : argv;
    const listOptionIndex = normalizedArgv.findIndex((argument) => argument === "--list");
    if (listOptionIndex === -1) {
        return normalizedArgv;
    }
    const listName = normalizedArgv[listOptionIndex + 1];
    if (!listName) {
        return normalizedArgv;
    }
    const argumentsWithoutListOption = normalizedArgv.filter((_, index) => index !== listOptionIndex && index !== listOptionIndex + 1);
    if (argumentsWithoutListOption.length > 0) {
        return normalizedArgv;
    }
    return ["list", listName];
};
const cliArguments = normalizeLegacyListOption(process.argv.slice(2));
void (0, buildCli_1.buildCli)()
    .parseAsync([process.argv[0] ?? "node", process.argv[1] ?? "fuel", ...cliArguments])
    .catch((error) => {
    (0, cliRuntime_1.handleCliRuntimeError)(error, cliArguments);
});
