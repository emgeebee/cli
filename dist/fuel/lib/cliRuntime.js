"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleCliRuntimeError = void 0;
const constants_1 = require("./constants");
const errors_1 = require("./errors");
const inferCommandName = (args) => {
    const firstPositionalArgument = args.find((argument) => !argument.startsWith("-"));
    return firstPositionalArgument ?? "fuel";
};
const shouldWriteJson = (args) => {
    if (args.includes("--json")) {
        return true;
    }
    if (args.includes("--text")) {
        return false;
    }
    return process.stdout.isTTY !== true;
};
const handleCliRuntimeError = (error, args) => {
    const appError = (0, errors_1.toAppError)(error);
    const commandName = inferCommandName(args);
    process.exitCode = appError.exitCode;
    if (shouldWriteJson(args)) {
        const envelope = {
            command: commandName,
            error: {
                code: appError.code,
                details: appError.details,
                message: appError.message,
                retryable: appError.retryable
            },
            ok: false,
            requestedAt: new Date().toISOString(),
            schemaVersion: constants_1.JSON_SCHEMA_VERSION
        };
        process.stdout.write(`${JSON.stringify(envelope, null, 2)}\n`);
        return;
    }
    process.stderr.write(`${(0, errors_1.formatAppError)(appError)}\n`);
};
exports.handleCliRuntimeError = handleCliRuntimeError;
