"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestJson = void 0;
const errors_1 = require("../lib/errors");
const requestJson = async ({ hint, label, schema, url, }) => {
    try {
        console.log('requestJson', url.toString());
        const response = await fetch(url, {
            headers: {
                accept: 'application/json',
            },
            signal: AbortSignal.timeout(10_000),
        });
        const bodyText = await response.text();
        if (!response.ok) {
            const parsedBody = bodyText === '' ? undefined : safeJsonParse(bodyText, hint);
            throw createStatusError(response.status, label, parsedBody, hint);
        }
        if (bodyText === '') {
            throw (0, errors_1.createAppError)('UPSTREAM_API_ERROR', withHint(`${label} returned an empty response.`, hint));
        }
        return schema.parse(safeJsonParse(bodyText, hint));
    }
    catch (error) {
        if (error instanceof Error && error.name === 'TimeoutError') {
            throw (0, errors_1.createAppError)('TIMEOUT', withHint(`${label} timed out.`, hint));
        }
        if (error instanceof TypeError) {
            throw (0, errors_1.createAppError)('UPSTREAM_API_ERROR', withHint(`${label} could not be reached.`, hint));
        }
        throw error;
    }
};
exports.requestJson = requestJson;
const safeJsonParse = (value, hint) => {
    try {
        return JSON.parse(value);
    }
    catch (error) {
        throw (0, errors_1.createAppError)('UPSTREAM_API_ERROR', withHint('Received malformed JSON from an upstream API.', hint), {
            bodyPreview: value.slice(0, 250),
            reason: error instanceof Error ? error.message : String(error),
        });
    }
};
const createStatusError = (status, label, body, hint) => {
    const upstreamMessage = extractUpstreamMessage(body);
    const message = upstreamMessage ? `${label}: ${upstreamMessage}` : `${label} failed with HTTP ${status}.`;
    const finalMessage = withHint(message, hint);
    if (status === 401 || status === 403) {
        return (0, errors_1.createAppError)('AUTH_ERROR', finalMessage, {
            status,
        });
    }
    if (status === 404) {
        return (0, errors_1.createAppError)('NOT_FOUND', finalMessage, {
            status,
        });
    }
    if (status === 429) {
        return (0, errors_1.createAppError)('RATE_LIMITED', finalMessage, {
            status,
        });
    }
    return (0, errors_1.createAppError)('UPSTREAM_API_ERROR', finalMessage, {
        status,
    });
};
const extractUpstreamMessage = (body) => {
    if (typeof body !== 'object' || body === null) {
        return undefined;
    }
    const message = 'message' in body ? body.message : undefined;
    return typeof message === 'string' ? message : undefined;
};
const withHint = (message, hint) => (hint ? `${message} ${hint}` : message);
