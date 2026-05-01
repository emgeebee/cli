import { REQUEST_TIMEOUT_MS } from "../lib/constants";
import { createAppError } from "../lib/errors";

type RequestJsonOptions<TData> = {
  body?: string;
  headers?: Record<string, string>;
  label: string;
  method?: string;
  schema: {
    parse: (input: unknown) => TData;
  };
  timeoutMs?: number;
  url: URL;
};

export const requestJson = async <TData>({
  body,
  headers,
  label,
  method = "GET",
  schema,
  timeoutMs = REQUEST_TIMEOUT_MS,
  url
}: RequestJsonOptions<TData>): Promise<TData> => {
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
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw createAppError("TIMEOUT", `${label} timed out.`);
    }

    if (error instanceof TypeError) {
      throw createAppError("UPSTREAM_API_ERROR", `${label} could not be reached.`);
    }

    throw error;
  }
};

const safeJsonParse = (value: string): unknown => {
  try {
    return JSON.parse(value);
  } catch (error) {
    throw createAppError("UPSTREAM_API_ERROR", "Received malformed JSON from an upstream API.", {
      bodyPreview: value.slice(0, 250),
      reason: error instanceof Error ? error.message : String(error)
    });
  }
};

const createStatusError = (status: number, label: string, body: unknown): Error => {
  const upstreamMessage = extractUpstreamMessage(body);

  if (status === 401 || status === 403) {
    return createAppError("AUTH_ERROR", createAuthorizationErrorMessage(label, status, upstreamMessage), {
      status
    });
  }

  if (status === 404) {
    return createAppError("NOT_FOUND", createNotFoundErrorMessage(label, status, upstreamMessage), {
      status
    });
  }

  if (status === 429) {
    return createAppError("RATE_LIMITED", createRateLimitErrorMessage(label, status, upstreamMessage), {
      status
    });
  }

  return createAppError("UPSTREAM_API_ERROR", createDefaultStatusMessage(label, status, upstreamMessage), {
    status
  });
};

const createAuthorizationErrorMessage = (
  label: string,
  status: number,
  upstreamMessage: string | undefined
): string => {
  if (label === "Fuel Finder access token request") {
    return `Fuel Finder rejected the client credentials (HTTP ${status}). Check FUEL_FINDER_CLIENT_ID and FUEL_FINDER_CLIENT_SECRET, and if you set FUEL_FINDER_BASE_URL make sure the credentials belong to that environment.${formatUpstreamMessageSuffix(upstreamMessage)}`;
  }

  if (label.startsWith("Fuel Finder")) {
    return `Fuel Finder rejected the authenticated request (HTTP ${status}). Refresh and retry after verifying the configured credentials still have access.${formatUpstreamMessageSuffix(upstreamMessage)}`;
  }

  return createDefaultStatusMessage(label, status, upstreamMessage);
};

const createNotFoundErrorMessage = (
  label: string,
  status: number,
  upstreamMessage: string | undefined
): string => {
  if (label.startsWith('Postcode lookup for "')) {
    return `${label}: postcode not found.${formatUpstreamMessageSuffix(upstreamMessage)}`;
  }

  return createDefaultStatusMessage(label, status, upstreamMessage);
};

const createRateLimitErrorMessage = (
  label: string,
  status: number,
  upstreamMessage: string | undefined
): string => {
  if (label.startsWith("Fuel Finder")) {
    return `Fuel Finder rate limited the request (HTTP ${status}). Wait and retry; the published limit is 30 requests per minute with 1 concurrent request per client.${formatUpstreamMessageSuffix(upstreamMessage)}`;
  }

  return createDefaultStatusMessage(label, status, upstreamMessage);
};

const createDefaultStatusMessage = (
  label: string,
  status: number,
  upstreamMessage: string | undefined
): string => `${upstreamMessage ? `${label}: ${upstreamMessage}` : `${label} failed with HTTP ${status}.`}`;

const formatUpstreamMessageSuffix = (upstreamMessage: string | undefined): string =>
  upstreamMessage ? ` Upstream message: ${upstreamMessage}` : "";

const extractUpstreamMessage = (body: unknown): string | undefined => {
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
    const errorDetails = body["error"] as Record<string, unknown>;

    if (typeof errorDetails["details"] === "string") {
      return errorDetails["details"];
    }
  }

  return undefined;
};
