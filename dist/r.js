#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const buildCli_1 = require("./rail/buildCli");
const errors_1 = require("./rail/lib/errors");
void (0, buildCli_1.buildCli)()
    .parseAsync([process.argv[0] ?? "node", process.argv[1] ?? "r", ...process.argv.slice(2)])
    .catch((error) => {
    const message = (0, errors_1.formatAppError)((0, errors_1.toAppError)(error));
    process.stderr.write(`${message}\n`);
    process.exit(1);
});
