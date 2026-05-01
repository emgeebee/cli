"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.projectOutputValue = void 0;
const errors_1 = require("./errors");
const ARRAY_INDEX_PATTERN = /^\d+$/;
const projectOutputValue = (value, path, examples = []) => {
    const segments = parseOutputPath(path, examples);
    return segments.reduce((currentValue, segment) => resolvePathSegment(currentValue, segment, path, examples), value);
};
exports.projectOutputValue = projectOutputValue;
const parseOutputPath = (path, examples) => {
    if (path.trim().length === 0) {
        throw createInvalidOutputPathError(path, examples);
    }
    const segments = path.split(".");
    if (segments.some((segment) => segment.length === 0)) {
        throw createInvalidOutputPathError(path, examples);
    }
    return segments;
};
const resolvePathSegment = (currentValue, segment, path, examples) => {
    if (Array.isArray(currentValue)) {
        if (!ARRAY_INDEX_PATTERN.test(segment)) {
            throw createInvalidOutputPathError(path, examples);
        }
        const nextValue = currentValue[Number.parseInt(segment, 10)];
        if (nextValue === undefined) {
            throw createMissingOutputPathError(path, examples);
        }
        return nextValue;
    }
    if (typeof currentValue === "object" && currentValue !== null) {
        const recordValue = currentValue;
        const nextValue = recordValue[segment];
        if (nextValue === undefined) {
            throw createMissingOutputPathError(path, examples);
        }
        return nextValue;
    }
    throw createMissingOutputPathError(path, examples);
};
const createInvalidOutputPathError = (path, examples) => (0, errors_1.createAppError)("INVALID_INPUT", `Invalid output path "${path}".`, createProjectionErrorDetails(path, examples));
const createMissingOutputPathError = (path, examples) => (0, errors_1.createAppError)("NOT_FOUND", `Output path "${path}" did not match any value.`, createProjectionErrorDetails(path, examples));
const createProjectionErrorDetails = (path, examples) => ({
    ...(examples.length > 0 ? { examples } : {}),
    ...(examples.length > 0 ? { hint: `Try paths like: ${examples.join(", ")}` } : {}),
    path
});
