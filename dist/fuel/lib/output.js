"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withGlobalOutputOptions = exports.runCommand = exports.getOutputMode = void 0;
const terminal_1 = require("../../lib/terminal");
const colours_1 = require("./colours");
const constants_1 = require("./constants");
const errors_1 = require("./errors");
const projection_1 = require("./projection");
const getOutputMode = (options) => {
    if (options.json && options.text) {
        throw (0, errors_1.createAppError)("INVALID_INPUT", "Choose either --json or --text, not both.");
    }
    if (options.json) {
        return "json";
    }
    if (options.text) {
        return "text";
    }
    return process.stdout.isTTY ? "text" : "json";
};
exports.getOutputMode = getOutputMode;
const runCommand = async (commandName, options, handler, formatText, runOptions = {}) => {
    const requestedAt = new Date().toISOString();
    let outputMode = options.json ? "json" : process.stdout.isTTY ? "text" : "json";
    try {
        outputMode = (0, exports.getOutputMode)(options);
        const colorEnabled = outputMode === "text" &&
            process.stdout.isTTY === true &&
            options.color !== false &&
            !process.env["NO_COLOR"];
        const textContext = {
            colorEnabled,
            terminalWidth: (0, terminal_1.getTerminalWidth)(),
            text: {
                joinAligned: colours_1.joinAligned,
                padVisibleEnd: colours_1.padVisibleEnd,
                padVisibleStart: colours_1.padVisibleStart,
                stripAnsi: colours_1.stripAnsi,
                style: (0, colours_1.createTextStyler)(colorEnabled),
                visibleWidth: colours_1.visibleWidth,
                wrapText: colours_1.wrapText
            }
        };
        const data = await handler();
        const outputData = options.output
            ? (0, projection_1.projectOutputValue)(data, options.output, runOptions.projectionExamples ?? [])
            : data;
        const envelope = {
            command: commandName,
            data: outputData,
            ok: true,
            requestedAt,
            schemaVersion: constants_1.JSON_SCHEMA_VERSION
        };
        if (outputMode === "json") {
            writeJson(envelope);
            return;
        }
        process.stdout.write(`${options.output ? formatProjectedText(outputData) : formatText(data, textContext)}\n`);
    }
    catch (error) {
        const appError = (0, errors_1.toAppError)(error);
        const envelope = {
            command: commandName,
            error: {
                code: appError.code,
                details: appError.details,
                message: appError.message,
                retryable: appError.retryable
            },
            ok: false,
            requestedAt,
            schemaVersion: constants_1.JSON_SCHEMA_VERSION
        };
        process.exitCode = appError.exitCode;
        if (outputMode === "json") {
            writeJson(envelope);
            return;
        }
        process.stderr.write(`${(0, errors_1.formatAppError)(appError)}\n`);
    }
};
exports.runCommand = runCommand;
const withGlobalOutputOptions = (command, options) => {
    const globalOptions = command.optsWithGlobals();
    const color = typeof globalOptions === "object" &&
        globalOptions !== null &&
        "color" in globalOptions &&
        typeof globalOptions["color"] === "boolean"
        ? globalOptions["color"]
        : undefined;
    if (color === undefined) {
        return options;
    }
    return {
        ...options,
        color
    };
};
exports.withGlobalOutputOptions = withGlobalOutputOptions;
const formatProjectedText = (value) => {
    if (value === null) {
        return "null";
    }
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        return `${value}`;
    }
    return JSON.stringify(value, null, 2);
};
const writeJson = (value) => {
    process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
};
