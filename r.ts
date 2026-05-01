#!/usr/bin/env node

import { buildCli } from "./rail/buildCli";
import { formatAppError, toAppError } from "./rail/lib/errors";

void buildCli()
  .parseAsync([process.argv[0] ?? "node", process.argv[1] ?? "r", ...process.argv.slice(2)])
  .catch((error: unknown) => {
    const message = formatAppError(toAppError(error));
    process.stderr.write(`${message}\n`);
    process.exit(1);
  });

export {};
