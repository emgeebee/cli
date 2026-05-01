"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestJson = void 0;
const constants_1 = require("../lib/constants");
const errors_1 = require("../lib/errors");
const requestJson = async ({ body, headers, label, method = "GET", schema, timeoutMs = constants_1.REQUEST_TIMEOUT_MS, url }) => {
    try {
        const response = await fetch(url, {
            ...(body ? { body } : {}),
            headers: {
                accept: "application/json",
                ...headers
            },
            method,
            signal: AbortSignal.timeout(timeoutMs)
        });
        const bodyText = await response.text();
        const parsedBody = bodyText === "" ? undefined : safeJsonParse(bodyText);
        if (!response.ok) {
            throw createStatusError(response.status, label, parsedBody);
        }
        return schema.parse(parsedBody);
    }
    catch (error) {
        if (error instanceof Error && error.name === "TimeoutError") {
            throw (0, errors_1.createAppError)("TIMEOUT", `${label} timed out.`);
        }
        if (error instanceof TypeError) {
            throw (0, errors_1.createAppError)("UPSTREAM_API_ERROR", `${label} could not be reached.`);
        }
        throw error;
    }
};
exports.requestJson = requestJson;
const safeJsonParse = (value) => {
    try {
        return JSON.parse(value);
    }
    catch (error) {
        throw (0, errors_1.createAppError)("UPSTREAM_API_ERROR", "Received malformed JSON from an upstream API.", {
            bodyPreview: value.slice(0, 250),
            reason: error instanceof Error ? error.message : String(error)
        });
    }
};
const createStatusError = (status, label, body) => {
    const upstreamMessage = extractUpstreamMessage(body);
    if (status === 401 || status === 403) {
        return (0, errors_1.createAppError)("AUTH_ERROR", createAuthorizationErrorMessage(label, status, upstreamMessage), {
            status
        });
    }
    if (status === 404) {
        return (0, errors_1.createAppError)("NOT_FOUND", createNotFoundErrorMessage(label, status, upstreamMessage), {
            status
        });
    }
    if (status === 429) {
        return (0, errors_1.createAppError)("RATE_LIMITED", createRateLimitErrorMessage(label, status, upstreamMessage), {
            status
        });
    }
    return (0, errors_1.createAppError)("UPSTREAM_API_ERROR", createDefaultStatusMessage(label, status, upstreamMessage), {
        status
    });
};
const createAuthorizationErrorMessage = (label, status, upstreamMessage) => {
    if (label === "Fuel Finder access token request") {
        return `Fuel Finder rejected the client credentials (HTTP ${status}). Check FUEL_FINDER_CLIENT_ID and FUEL_FINDER_CLIENT_SECRET, and if you set FUEL_FINDER_BASE_URL make sure the credentials belong to that environment.${formatUpstreamMessageSuffix(upstreamMessage)}`;
    }
    if (label.startsWith("Fuel Finder")) {
        return `Fuel Finder rejected the authenticated request (HTTP ${status}). Refresh and retry after verifying the configured credentials still have access.${formatUpstreamMessageSuffix(upstreamMessage)}`;
    }
    return createDefaultStatusMessage(label, status, upstreamMessage);
};
const createNotFoundErrorMessage = (label, status, upstreamMessage) => {
    if (label.startsWith('Postcode lookup for "')) {
        return `${label}: postcode not found.${formatUpstreamMessageSuffix(upstreamMessage)}`;
    }
    return createDefaultStatusMessage(label, status, upstreamMessage);
};
const createRateLimitErrorMessage = (label, status, upstreamMessage) => {
    if (label.startsWith("Fuel Finder")) {
        return `Fuel Finder rate limited the request (HTTP ${status}). Wait and retry; the published limit is 30 requests per minute with 1 concurrent request per client.${formatUpstreamMessageSuffix(upstreamMessage)}`;
    }
    return createDefaultStatusMessage(label, status, upstreamMessage);
};
const createDefaultStatusMessage = (label, status, upstreamMessage) => `${upstreamMessage ? `${label}: ${upstreamMessage}` : `${label} failed with HTTP ${status}.`}`;
const formatUpstreamMessageSuffix = (upstreamMessage) => upstreamMessage ? ` Upstream message: ${upstreamMessage}` : "";
const extractUpstreamMessage = (body) => {
    if (typeof body !== "object" || body === null) {
        return undefined;
    }
    if ("message" in body && typeof body["message"] === "string") {
        return body["message"];
    }
    if ("error" in body && typeof body["error"] === "string") {
        return body["error"];
    }
    if ("error" in body && typeof body["error"] === "object" && body["error"] !== null) {
        const errorDetails = body["error"];
        if (typeof errorDetails["details"] === "string") {
            return errorDetails["details"];
        }
    }
    return undefined;
};
