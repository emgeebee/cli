import type { Command } from "commander";

import { getTerminalWidth } from "../../lib/terminal";
import {
  createTextStyler,
  joinAligned,
  padVisibleEnd,
  padVisibleStart,
  stripAnsi,
  visibleWidth,
  wrapText
} from "./colours";
import { JSON_SCHEMA_VERSION } from "./constants";
import { createAppError, formatAppError, toAppError } from "./errors";
import { projectOutputValue } from "./projection";

import type { ErrorEnvelope, OutputMode, OutputOptions, SuccessEnvelope } from "./types";

export type TextFormatterContext = {
  colorEnabled: boolean;
  terminalWidth: number;
  text: {
    joinAligned: typeof joinAligned;
    padVisibleEnd: typeof padVisibleEnd;
    padVisibleStart: typeof padVisibleStart;
    stripAnsi: typeof stripAnsi;
    style: ReturnType<typeof createTextStyler>;
    visibleWidth: typeof visibleWidth;
    wrapText: typeof wrapText;
  };
};

type RunCommandOptions = {
  projectionExamples?: string[];
};

export const getOutputMode = (options: OutputOptions): OutputMode => {
  if (options.json && options.text) {
    throw createAppError("INVALID_INPUT", "Choose either --json or --text, not both.");
  }

  if (options.json && options.web) {
    throw createAppError("INVALID_INPUT", "Choose either --json or --web, not both.");
  }

  if (options.json) {
    return "json";
  }

  if (options.text || options.web) {
    return "text";
  }

  return process.stdout.isTTY ? "text" : "json";
};

const escapeHtml = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const wrapWebPre = (value: string): string => `<pre>${escapeHtml(stripAnsi(value))}</pre>`;

export const runCommand = async <TData>(
  commandName: string,
  options: OutputOptions,
  handler: () => Promise<TData>,
  formatText: (data: TData, context: TextFormatterContext) => string,
  runOptions: RunCommandOptions = {}
): Promise<void> => {
  const requestedAt = new Date().toISOString();
  let outputMode: OutputMode = options.json ? "json" : process.stdout.isTTY ? "text" : "json";

  try {
    outputMode = getOutputMode(options);
    const colorEnabled =
      outputMode === "text" &&
      !options.web &&
      process.stdout.isTTY === true &&
      options.color !== false &&
      !process.env["NO_COLOR"];
    const textContext: TextFormatterContext = {
      colorEnabled,
      terminalWidth: getTerminalWidth(),
      text: {
        joinAligned,
        padVisibleEnd,
        padVisibleStart,
        stripAnsi,
        style: createTextStyler(colorEnabled),
        visibleWidth,
        wrapText
      }
    };
    const data = await handler();
    const outputData = options.output
      ? projectOutputValue(data, options.output, runOptions.projectionExamples ?? [])
      : data;
    const envelope: SuccessEnvelope<unknown> = {
      command: commandName,
      data: outputData,
      ok: true,
      requestedAt,
      schemaVersion: JSON_SCHEMA_VERSION
    };

    if (outputMode === "json") {
      writeJson(envelope);
      return;
    }

    const body = options.output ? formatProjectedText(outputData) : formatText(data, textContext);
    process.stdout.write(`${options.web ? wrapWebPre(body) : body}\n`);
  } catch (error) {
    const appError = toAppError(error);
    const envelope: ErrorEnvelope = {
      command: commandName,
      error: {
        code: appError.code,
        details: appError.details,
        message: appError.message,
        retryable: appError.retryable
      },
      ok: false,
      requestedAt,
      schemaVersion: JSON_SCHEMA_VERSION
    };

    process.exitCode = appError.exitCode;

    if (outputMode === "json") {
      writeJson(envelope);
      return;
    }

    process.stderr.write(`${formatAppError(appError)}\n`);
  }
};

export const withGlobalOutputOptions = <TOptions extends OutputOptions>(
  command: Command,
  options: TOptions
): TOptions & OutputOptions => {
  const globalOptions = command.optsWithGlobals();
  const merged: TOptions & OutputOptions = { ...options };

  if (
    typeof globalOptions === "object" &&
    globalOptions !== null &&
    "color" in globalOptions &&
    typeof globalOptions["color"] === "boolean"
  ) {
    merged.color = globalOptions["color"];
  }

  if (
    typeof globalOptions === "object" &&
    globalOptions !== null &&
    "web" in globalOptions &&
    globalOptions["web"] === true
  ) {
    merged.web = true;
  }

  return merged;
};

const formatProjectedText = (value: unknown): string => {
  if (value === null) {
    return "null";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return `${value}`;
  }

  return JSON.stringify(value, null, 2);
};

const writeJson = (value: unknown): void => {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
};
