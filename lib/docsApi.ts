import { readPhoneCliConfig } from "../config";

export const DOCS_API_BASE = "https://1q1v3hm1n2.execute-api.us-west-2.amazonaws.com/prod";

export type DocsDocument<T> = {
  id: string;
  title?: string;
  data: T;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function readDocsTokenFromConfig(): string | null {
  const token = asRecord(readPhoneCliConfig().cal)?.token;
  if (typeof token !== "string" || !token.trim()) return null;
  return token.trim();
}

export async function readOptionalDocsToken(): Promise<string | null> {
  return readDocsTokenFromConfig();
}

export async function resolveDocsToken(): Promise<string> {
  const token = readDocsTokenFromConfig();
  if (!token) {
    throw new Error("Missing docs token (expected config.cal.token).");
  }
  return token;
}

export function docsAuthHeaders(token: string): Record<string, string> {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    "x-api-key": token,
  };
}

function extractDocumentData<T>(payload: unknown): T | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  if ("data" in record && record.data !== undefined) {
    return record.data as T;
  }
  return payload as T;
}

async function readErrorBody(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text.trim() || response.statusText;
  } catch {
    return response.statusText;
  }
}

export async function getDocument<T>(id: string, token?: string): Promise<T | null> {
  const authToken = token ?? (await resolveDocsToken());
  const response = await fetch(`${DOCS_API_BASE}/docs/${encodeURIComponent(id)}`, {
    headers: docsAuthHeaders(authToken),
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    const body = await readErrorBody(response);
    throw new Error(`Docs GET ${id} failed (${response.status}): ${body}`);
  }
  const payload = (await response.json()) as unknown;
  return extractDocumentData<T>(payload);
}

export async function putDocument<T>(
  id: string,
  title: string,
  data: T,
  token?: string,
): Promise<void> {
  const authToken = token ?? (await resolveDocsToken());
  const response = await fetch(`${DOCS_API_BASE}/docs/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: docsAuthHeaders(authToken),
    body: JSON.stringify({ title, data }),
  });
  if (!response.ok) {
    const body = await readErrorBody(response);
    throw new Error(`Docs PUT ${id} failed (${response.status}): ${body}`);
  }
}

export async function createDocument<T>(
  title: string,
  data: T,
  token?: string,
  id?: string,
): Promise<string> {
  const authToken = token ?? (await resolveDocsToken());
  const response = await fetch(`${DOCS_API_BASE}/docs`, {
    method: "POST",
    headers: docsAuthHeaders(authToken),
    body: JSON.stringify(id ? { id, title, data } : { title, data }),
  });
  if (!response.ok) {
    const body = await readErrorBody(response);
    throw new Error(`Docs POST failed (${response.status}): ${body}`);
  }
  const payload = (await response.json()) as unknown;
  if (payload && typeof payload === "object" && "id" in payload) {
    const docId = (payload as { id?: unknown }).id;
    if (typeof docId === "string" && docId.trim()) return docId.trim();
  }
  if (id) return id;
  throw new Error("Docs POST succeeded but returned no document id.");
}

/** Create or update a document (PUT, falling back to POST when the doc does not exist yet). */
export async function saveDocument<T>(
  id: string,
  title: string,
  data: T,
  token?: string,
): Promise<void> {
  const authToken = token ?? (await resolveDocsToken());
  const response = await fetch(`${DOCS_API_BASE}/docs/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: docsAuthHeaders(authToken),
    body: JSON.stringify({ title, data }),
  });
  if (response.ok) return;
  if (response.status === 404) {
    await createDocument(title, data, authToken, id);
    return;
  }
  const body = await readErrorBody(response);
  throw new Error(`Docs save ${id} failed (${response.status}): ${body}`);
}
