"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withGlobalOutputOptions = exports.runCommand = exports.getOutputMode = void 0;
const colours_1 = require("./colours");
const constants_1 = require("./constants");
const errors_1 = require("./errors");
const getOutputMode = (options) => {
    if (options.json && options.text) {
        throw (0, errors_1.toAppError)(new Error('Choose either --json or --text, not both.'));
    }
    if (options.json) {
        return 'json';
    }
    if (options.text) {
        return 'text';
    }
    return process.stdout.isTTY ? 'text' : 'json';
};
exports.getOutputMode = getOutputMode;
const runCommand = async (commandName, options, handler, formatText) => {
    const requestedAt = new Date().toISOString();
    const outputMode = (0, exports.getOutputMode)(options);
    const colorEnabled = outputMode === 'text' &&
        process.stdout.isTTY === true &&
        options.color !== false &&
        !process.env['NO_COLOR'];
    const textContext = {
        colorEnabled,
        terminalWidth: (0, colours_1.getTerminalWidth)(),
        text: {
            joinAligned: colours_1.joinAligned,
            padVisibleEnd: colours_1.padVisibleEnd,
            padVisibleStart: colours_1.padVisibleStart,
            stripAnsi: colours_1.stripAnsi,
            style: (0, colours_1.createTextStyler)(colorEnabled),
            visibleWidth: colours_1.visibleWidth,
            wrapText: colours_1.wrapText,
        },
    };
    try {
        const data = await handler();
        const envelope = {
            command: commandName,
            data,
            ok: true,
            requestedAt,
            schemaVersion: constants_1.JSON_SCHEMA_VERSION,
        };
        if (outputMode === 'json') {
            writeJson(envelope);
            return;
        }
        process.stdout.write(`${formatText(data, textContext)}\n`);
    }
    catch (error) {
        const appError = (0, errors_1.toAppError)(error);
        const envelope = {
            command: commandName,
            error: {
                code: appError.code,
                details: appError.details,
                message: appError.message,
                retryable: appError.retryable,
            },
            ok: false,
            requestedAt,
            schemaVersion: constants_1.JSON_SCHEMA_VERSION,
        };
        process.exitCode = appError.exitCode;
        if (outputMode === 'json') {
            writeJson(envelope);
            return;
        }
        process.stderr.write(`${(0, errors_1.formatAppError)(appError)}\n`);
    }
};
exports.runCommand = runCommand;
const withGlobalOutputOptions = (command, options) => {
    const globalOptions = command.optsWithGlobals();
    const color = typeof globalOptions === 'object' &&
        globalOptions !== null &&
        'color' in globalOptions &&
        typeof globalOptions['color'] === 'boolean'
        ? globalOptions['color']
        : undefined;
    return {
        ...options,
        color,
    };
};
exports.withGlobalOutputOptions = withGlobalOutputOptions;
const writeJson = (value) => {
    process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
};
