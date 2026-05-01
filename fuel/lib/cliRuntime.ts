import { JSON_SCHEMA_VERSION } from "./constants";
import { formatAppError, toAppError } from "./errors";

import type { ErrorEnvelope } from "./types";

const inferCommandName = (args: string[]): string => {
  const firstPositionalArgument = args.find((argument) => !argument.startsWith("-"));

  return firstPositionalArgument ?? "fuel";
};

const shouldWriteJson = (args: string[]): boolean => {
  if (args.includes("--json")) {
    return true;
  }

  if (args.includes("--text")) {
    return false;
  }

  return process.stdout.isTTY !== true;
};

export const handleCliRuntimeError = (error: unknown, args: string[]): void => {
  const appError = toAppError(error);
  const commandName = inferCommandName(args);

  process.exitCode = appError.exitCode;

  if (shouldWriteJson(args)) {
    const envelope: ErrorEnvelope = {
      command: commandName,
      error: {
        code: appError.code,
        details: appError.details,
        message: appError.message,
        retryable: appError.retryable
      },
      ok: false,
      requestedAt: new Date().toISOString(),
      schemaVersion: JSON_SCHEMA_VERSION
    };

    process.stdout.write(`${JSON.stringify(envelope, null, 2)}\n`);
    return;
  }

  process.stderr.write(`${formatAppError(appError)}\n`);
};
