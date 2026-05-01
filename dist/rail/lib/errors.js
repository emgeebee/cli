"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatAppError = exports.toAppError = exports.isAppError = exports.createAmbiguousLocationError = exports.createAppError = void 0;
const zod_1 = require("zod");
const EXIT_CODE_BY_ERROR = {
    AMBIGUOUS_LOCATION: 2,
    AUTH_ERROR: 3,
    INTERNAL_ERROR: 4,
    INVALID_INPUT: 2,
    NOT_FOUND: 2,
    RATE_LIMITED: 3,
    TIMEOUT: 3,
    UPSTREAM_API_ERROR: 3,
};
const RETRYABLE_CODES = new Set(['RATE_LIMITED', 'TIMEOUT', 'UPSTREAM_API_ERROR']);
const createAppError = (code, message, details) => {
    const error = new Error(message);
    error.code = code;
    error.details = details;
    error.exitCode = EXIT_CODE_BY_ERROR[code];
    error.retryable = RETRYABLE_CODES.has(code);
    return error;
};
exports.createAppError = createAppError;
const createAmbiguousLocationError = (query, candidates) => (0, exports.createAppError)('AMBIGUOUS_LOCATION', `Could not confidently resolve "${query}".`, {
    candidates,
    query,
});
exports.createAmbiguousLocationError = createAmbiguousLocationError;
const isAppError = (error) => error instanceof Error &&
    'code' in error &&
    'exitCode' in error &&
    'retryable' in error;
exports.isAppError = isAppError;
const toAppError = (error) => {
    if ((0, exports.isAppError)(error)) {
        return error;
    }
    if (error instanceof zod_1.ZodError) {
        return (0, exports.createAppError)('UPSTREAM_API_ERROR', 'Received an unexpected response shape from an upstream API.', {
            issues: error.issues,
        });
    }
    if (error instanceof Error) {
        return (0, exports.createAppError)('INTERNAL_ERROR', error.message);
    }
    return (0, exports.createAppError)('INTERNAL_ERROR', 'An unknown internal error occurred.');
};
exports.toAppError = toAppError;
const formatAppError = (error) => {
    if (error.code === 'AMBIGUOUS_LOCATION' && isAmbiguousDetails(error.details)) {
        const candidates = error.details.candidates
            .map((candidate) => `- ${candidate.name} (${candidate.crs})`)
            .join('\n');
        return `${error.message}\n${candidates}\nUse "rail search \\"${error.details.query}\\"" to inspect matches.`;
    }
    return error.message;
};
exports.formatAppError = formatAppError;
const isAmbiguousDetails = (value) => typeof value === 'object' &&
    value !== null &&
    'candidates' in value &&
    Array.isArray(value['candidates']) &&
    'query' in value &&
    typeof value['query'] === 'string';
