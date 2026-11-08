import {
  ensureOctoCacheLoaded,
  readServiceCache,
  updateServiceCache,
} from "./cache";
import {
  getConfigPath,
  readPhoneCliConfig,
  writePhoneCliConfig,
} from "../config";

/** Cached gas prices — YYYY-MM-DD to unit rate slot(s) for that UK day. */
export type GasPriceCache = Record<string, OctopusRate[]>;

/** Peak (day) / off-peak (night) unit rates for an Economy 7 style tariff. */
export type ElectricityDualRates = {
  peak: OctopusRate[];
  offPeak: OctopusRate[];
};

export type ElectricityPriceCache = Record<string, ElectricityDualRates>;

/** @deprecated Prefer ElectricityDualRates; kept for one-time cache migration. */
export type CachedElectricityRate = {
  valid_from: string;
  valid_to: string;
  value_inc_vat: number;
};

/** Cached billed daily totals for a UK calendar day (inc VAT pence + kWh). */
export type DailyDayTotals = {
  eCost: number;
  gCost: number;
  eKwh: number;
  gKwh: number;
};

export type DailyTotalsCache = Record<string, DailyDayTotals>;

export type OctopusAgreement = {
  tariff_code?: string;
  valid_from?: string;
  valid_to?: string | null;
};

export type OctopusMeterPoint = {
  mpan?: string;
  mprn?: string;
  meters?: Array<{
    serial_number?: string;
    active_from?: string;
  }>;
  agreements?: OctopusAgreement[];
};

export type OctopusProperty = {
  electricity_meter_points?: OctopusMeterPoint[];
  gas_meter_points?: OctopusMeterPoint[];
};

export type OctopusAccountResponse = {
  properties?: OctopusProperty[];
};

export type OctopusRate = {
  valid_from?: string;
  valid_to?: string;
  value_inc_vat?: number;
  value_exc_vat?: number;
  payment_method?: string | null;
};

/** How peak/off-peak unit rates are applied to consumption intervals. */
export type ElectricityRateMode =
  /** Eco7-style: separate day/night collections; pick by UK hour. */
  | "eco7"
  /** Timed windows in standard-unit-rates (e.g. EDF GoElectric); match by valid_from/to. */
  | "windowed";

export type ElectricityTariffDerivation = {
  electricityMeters: Array<{ mpan: string; serial: string }>;
  etariff: OctopusAgreement;
  /** Primary unit-rate collection URL (day rates or standard-unit-rates). */
  etariffDayPrices: string;
  /** Night/off-peak unit-rate collection URL (Eco7 only). */
  etariffNightPrices: string | null;
  etariffStanding: string;
  isEco7: boolean;
  rateMode: ElectricityRateMode;
  offPeakStartHour: number;
  offPeakEndHour: number;
  electricityBaseUrl: string;
  electricityToken: string;
};

export type GasTariffDerivation = {
  gasMeters: Array<{ mprn: string; serial: string }>;
  gtariff: OctopusAgreement;
  gtariffPrices: string;
  gtariffStanding: string;
  gasBaseUrl: string;
  gasToken: string;
};

/** Combined derivation used by the energy dashboard (elec from EDF, gas from Octopus). */
export type TariffDerivation = ElectricityTariffDerivation & GasTariffDerivation;

export const OCTOPUS_BASE_URL = "https://api.octopus.energy/v1";
export const EDF_BASE_URL = "https://api.edfgb-kraken.energy/v1";
export const DAY_MS = 24 * 60 * 60 * 1000;
/** Keep the last 14 UK calendar days (today + 13 prior); drop older day keys. */
export const DAILY_PRICE_CACHE_MAX_AGE_DAYS = 13;
export const DAILY_PRICE_CACHE_HISTORY_DAYS = 14;
/** Finished daily cost/kWh rows for the energy billing lookback window. */
export const DAILY_TOTALS_BILLING_LOOKBACK_DAYS = 40;
export const DAILY_TOTALS_CACHE_MAX_AGE_DAYS = 39;
/** Billed daily totals are not treated as final until this many UK days after the day. */
export const DAILY_TOTALS_SETTLE_DAYS = 3;
/** Past-N-day energy columns in `power` (matches solar 4-week table). */
export const DAILY_TOTALS_DISPLAY_DAYS = 28;
/** Monthly energy history shown alongside solar monthly yield. */
export const ENERGY_MONTHLY_HISTORY_MONTHS = 24;
/** Default Economy 7 off-peak window in UK local hours: [start, end). */
export const DEFAULT_ECO7_OFF_PEAK_START_HOUR = 0;
export const DEFAULT_ECO7_OFF_PEAK_END_HOUR = 7;
const UK_TZ = "Europe/London";
const ANSI_RESET = "\x1b[0m";
const ANSI_GREEN = "\x1b[32m";
const ANSI_YELLOW = "\x1b[33m";
const ANSI_ORANGE = "\x1b[38;5;208m";
const ANSI_RED = "\x1b[31m";
const ANSI_REGEX = /\x1b\[[0-9;]*m/g;

export type FuelType = "electricity" | "gas";

function parsePositiveNumber(value: string | undefined, label: string): number | null {
  if (!value) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`${label} must be a positive number.`);
  }
  return n;
}

function parseHour(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 24) {
    throw new Error(`Off-peak hour must be between 0 and 24 (got ${value}).`);
  }
  return n;
}

export function resolveOctoCredentials(): {
  token: string;
  accountNumber: string;
  gasKwhPerUnit: number;
} {
  const config = readPhoneCliConfig();
  const octo = config.octo || {};
  const token = String(octo.basicAuthToken || octo.token || "").trim();
  const accountNumber = String(octo.accountNumber || "").trim();
  const envGasFactor = String(
    octo.gasKwhPerUnit || octo.gas_kwh_per_unit || "",
  ).trim();
  const configuredGasFactor = parsePositiveNumber(
    String(octo.gasKwhPerUnit || octo.gas_kwh_per_unit || "").trim() || undefined,
    "OCTOPUS_GAS_KWH_PER_UNIT",
  );
  if (!token || !accountNumber) {
    throw new Error(
      [
        "Missing Octopus credentials.",
        `Configure ${getConfigPath()} with:`,
        `{ "octo": { "basicAuthToken": "...", "accountNumber": "A-..." } }`,
      ].join(" "),
    );
  }
  return {
    token,
    accountNumber,
    gasKwhPerUnit:
      parsePositiveNumber(envGasFactor, "OCTOPUS_GAS_KWH_PER_UNIT") ??
      configuredGasFactor ??
      11.2,
  };
}

export type EdfCredentialConfig = {
  accountNumber: string;
  /** Short-lived access token, if already known. */
  token: string | null;
  refreshToken: string | null;
  email: string | null;
  password: string | null;
  offPeakStartHour: number;
  offPeakEndHour: number;
};

type CachedEdfAccessToken = {
  token: string;
  expiresAtMs: number;
};

let edfAccessTokenCache: CachedEdfAccessToken | null = null;
let edfAccessTokenInFlight: Promise<string> | null = null;

export function resolveEdfCredentialConfig(): EdfCredentialConfig {
  const config = readPhoneCliConfig();
  const edf = config.edf || {};
  const octo = config.octo || {};
  const token = String(
    edf.token || edf.basicAuthToken || octo.edfToken || octo.edfBasicAuthToken || "",
  ).trim();
  const refreshToken = String(edf.refreshToken || octo.edfRefreshToken || "").trim();
  const email = String(edf.email || "").trim();
  const password = String(edf.password || "").trim();
  const accountNumber = String(
    edf.accountNumber || octo.edfAccountNumber || "",
  ).trim();
  if (!accountNumber) {
    throw new Error(
      [
        "Missing EDF account number.",
        `Configure ${getConfigPath()} with:`,
        `{ "edf": { "accountNumber": "A-...", "refreshToken": "..." } }`,
      ].join(" "),
    );
  }
  if (!token && !refreshToken && !(email && password)) {
    throw new Error(
      [
        "Missing EDF credentials.",
        `Configure ${getConfigPath()} with one of:`,
        `{ "edf": { "accountNumber": "A-...", "refreshToken": "..." } }`,
        `or { "edf": { "accountNumber": "A-...", "email": "...", "password": "..." } }`,
      ].join(" "),
    );
  }
  return {
    accountNumber,
    token: token || null,
    refreshToken: refreshToken || null,
    email: email || null,
    password: password || null,
    offPeakStartHour: parseHour(
      String(edf.offPeakStartHour ?? octo.edfOffPeakStartHour ?? "").trim() || undefined,
      DEFAULT_ECO7_OFF_PEAK_START_HOUR,
    ),
    offPeakEndHour: parseHour(
      String(edf.offPeakEndHour ?? octo.edfOffPeakEndHour ?? "").trim() || undefined,
      DEFAULT_ECO7_OFF_PEAK_END_HOUR,
    ),
  };
}

/** @deprecated Prefer resolveEdfCredentialConfig + resolveEdfAccessToken. */
export function resolveEdfCredentials(): {
  token: string;
  accountNumber: string;
  offPeakStartHour: number;
  offPeakEndHour: number;
} {
  const cfg = resolveEdfCredentialConfig();
  if (!cfg.token) {
    throw new Error(
      "EDF access token is not available synchronously; use resolveEdfAccessToken().",
    );
  }
  return {
    token: cfg.token,
    accountNumber: cfg.accountNumber,
    offPeakStartHour: cfg.offPeakStartHour,
    offPeakEndHour: cfg.offPeakEndHour,
  };
}

function jwtExpiryMs(token: string): number | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"),
    ) as { exp?: unknown };
    if (typeof payload.exp !== "number" || !Number.isFinite(payload.exp)) return null;
    return payload.exp * 1000;
  } catch {
    return null;
  }
}

function persistEdfRefreshToken(refreshToken: string): void {
  const config = readPhoneCliConfig();
  const edf = { ...(config.edf || {}) };
  if (String(edf.refreshToken || "") === refreshToken) return;
  edf.refreshToken = refreshToken;
  writePhoneCliConfig({ ...config, edf });
}

type ObtainKrakenTokenResult = {
  token?: string | null;
  refreshToken?: string | null;
  refreshExpiresIn?: number | null;
};

async function obtainKrakenToken(input: Record<string, string>): Promise<ObtainKrakenTokenResult> {
  const response = await fetch(`${EDF_BASE_URL}/graphql/`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: `
        mutation obtainKrakenToken($input: ObtainJSONWebTokenInput!) {
          obtainKrakenToken(input: $input) {
            token
            refreshToken
            refreshExpiresIn
          }
        }
      `,
      variables: { input },
    }),
  });
  if (!response.ok) {
    throw new Error(`EDF token request failed (${response.status}).`);
  }
  const body = (await response.json()) as {
    data?: { obtainKrakenToken?: ObtainKrakenTokenResult | null };
    errors?: Array<{ message?: string }>;
  };
  if (body.errors?.length) {
    throw new Error(
      `EDF token request failed: ${body.errors.map((e) => e.message || "unknown").join("; ")}`,
    );
  }
  const result = body.data?.obtainKrakenToken;
  if (!result?.token) {
    throw new Error("EDF token request returned no access token.");
  }
  return result;
}

/**
 * Resolve a usable EDF access token, refreshing via refreshToken (or email/password) as needed.
 */
export async function resolveEdfAccessToken(now: Date = new Date()): Promise<string> {
  const skewMs = 60_000;
  if (
    edfAccessTokenCache &&
    edfAccessTokenCache.expiresAtMs - skewMs > now.getTime()
  ) {
    return edfAccessTokenCache.token;
  }
  if (edfAccessTokenInFlight) return edfAccessTokenInFlight;

  edfAccessTokenInFlight = (async () => {
    const cfg = resolveEdfCredentialConfig();
    if (cfg.token) {
      const expiresAtMs = jwtExpiryMs(cfg.token) ?? now.getTime() + 55 * 60_000;
      if (expiresAtMs - skewMs > now.getTime()) {
        edfAccessTokenCache = { token: cfg.token, expiresAtMs };
        return cfg.token;
      }
    }

    let obtained: ObtainKrakenTokenResult;
    if (cfg.refreshToken) {
      obtained = await obtainKrakenToken({ refreshToken: cfg.refreshToken });
    } else if (cfg.email && cfg.password) {
      obtained = await obtainKrakenToken({ email: cfg.email, password: cfg.password });
    } else if (cfg.token) {
      // Configured static token is expired and no refresh path exists.
      throw new Error(
        "EDF access token expired. Add edf.refreshToken (or email/password) to renew it.",
      );
    } else {
      throw new Error("Missing EDF credentials for token refresh.");
    }

    const token = String(obtained.token || "").trim();
    if (!token) {
      throw new Error("EDF token refresh returned an empty access token.");
    }
    const expiresAtMs = jwtExpiryMs(token) ?? now.getTime() + 55 * 60_000;
    edfAccessTokenCache = { token, expiresAtMs };

    const nextRefresh = String(obtained.refreshToken || "").trim();
    if (nextRefresh) {
      persistEdfRefreshToken(nextRefresh);
    }
    return token;
  })();

  try {
    return await edfAccessTokenInFlight;
  } finally {
    edfAccessTokenInFlight = null;
  }
}

function latestAgreement(
  agreements: OctopusAgreement[] | undefined,
): OctopusAgreement {
  if (!agreements || agreements.length === 0) {
    throw new Error("No agreement found on meter point.");
  }
  const sorted = [...agreements].sort((a, b) => {
    const aTs = new Date(a.valid_from || "").getTime();
    const bTs = new Date(b.valid_from || "").getTime();
    return aTs - bTs;
  });
  return sorted[sorted.length - 1];
}

function productFromTariffCode(tariffCode: string): string {
  const parts = tariffCode.split("-").slice(0, -1).slice(2);
  if (parts.length === 0) {
    throw new Error(
      `Unable to derive product code from tariff code: ${tariffCode}`,
    );
  }
  return parts.join("-");
}

function isEco7TariffCode(tariffCode: string): boolean {
  return /^E-2R-/i.test(tariffCode) || /ECO.?7|ECONOMY.?7/i.test(tariffCode);
}

function meterRefs(
  points: OctopusMeterPoint[] | undefined,
  key: "mpan" | "mprn",
): Array<{ mpxn: string; serial: string }> {
  const refs: Array<{ mpxn: string; serial: string }> = [];
  for (const point of points || []) {
    const mpxn = String(point[key] || "").trim();
    if (!mpxn) continue;
    for (const meter of point.meters || []) {
      const serial = String(meter.serial_number || "").trim();
      if (!serial) continue;
      refs.push({ mpxn, serial });
    }
  }
  const seen = new Set<string>();
  return refs.filter((ref) => {
    const id = `${ref.mpxn}::${ref.serial}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export function deriveElectricityTariffs(
  account: OctopusAccountResponse,
  options: {
    baseUrl: string;
    token: string;
    offPeakStartHour?: number;
    offPeakEndHour?: number;
  },
): ElectricityTariffDerivation {
  const property = account.properties?.[0];
  if (!property) {
    throw new Error("No property found on electricity account.");
  }
  const ePoints = property.electricity_meter_points || [];
  const emPoint = ePoints[0];
  if (!emPoint) {
    throw new Error("Electricity meter point is required on EDF account.");
  }
  const electricityMeters = meterRefs(ePoints, "mpan").map((m) => ({
    mpan: m.mpxn,
    serial: m.serial,
  }));
  if (electricityMeters.length === 0) {
    throw new Error("Missing electricity meter serials on EDF account.");
  }
  const etariff = latestAgreement(emPoint.agreements);
  if (!etariff.tariff_code) {
    throw new Error("Missing electricity tariff_code on agreement.");
  }
  const eProduct = productFromTariffCode(etariff.tariff_code);
  const isEco7 = isEco7TariffCode(etariff.tariff_code);
  const rateMode: ElectricityRateMode = isEco7 ? "eco7" : "windowed";
  const base = options.baseUrl.replace(/\/$/, "");
  const dayPrices = isEco7
    ? `${base}/products/${eProduct}/electricity-tariffs/${etariff.tariff_code}/day-unit-rates/`
    : `${base}/products/${eProduct}/electricity-tariffs/${etariff.tariff_code}/standard-unit-rates/`;
  const nightPrices = isEco7
    ? `${base}/products/${eProduct}/electricity-tariffs/${etariff.tariff_code}/night-unit-rates/`
    : null;
  return {
    electricityMeters,
    etariff,
    etariffDayPrices: dayPrices,
    etariffNightPrices: nightPrices,
    etariffStanding: `${base}/products/${eProduct}/electricity-tariffs/${etariff.tariff_code}/standing-charges/`,
    isEco7,
    rateMode,
    offPeakStartHour: options.offPeakStartHour ?? DEFAULT_ECO7_OFF_PEAK_START_HOUR,
    offPeakEndHour: options.offPeakEndHour ?? DEFAULT_ECO7_OFF_PEAK_END_HOUR,
    electricityBaseUrl: base,
    electricityToken: options.token,
  };
}

/**
 * Split timed unit-rate windows into peak (highest pence) and off-peak (lowest pence)
 * for gas-style daily summaries. Mid-tiers are omitted from the labels but remain in
 * neither list — callers that need full billing should keep the unsplit list.
 */
export function splitPeakOffPeakFromRates(rates: OctopusRate[]): ElectricityDualRates {
  const priced = rates.filter(
    (rate) => rate.value_inc_vat != null && Number.isFinite(rate.value_inc_vat),
  );
  if (priced.length === 0) return { peak: [], offPeak: [] };
  const values = [...new Set(priced.map((rate) => rate.value_inc_vat as number))].sort(
    (a, b) => a - b,
  );
  if (values.length === 1) {
    return { peak: priced, offPeak: [] };
  }
  const min = values[0];
  const max = values[values.length - 1];
  return {
    peak: priced.filter((rate) => rate.value_inc_vat === max),
    offPeak: priced.filter((rate) => rate.value_inc_vat === min),
  };
}

export function deriveGasTariffs(
  account: OctopusAccountResponse,
  options: { baseUrl: string; token: string },
): GasTariffDerivation {
  const property = account.properties?.[0];
  if (!property) {
    throw new Error("No property found on gas account.");
  }
  const gPoints = property.gas_meter_points || [];
  const gmPoint = gPoints[0];
  if (!gmPoint) {
    throw new Error("Gas meter point is required on Octopus account.");
  }
  const gasMeters = meterRefs(gPoints, "mprn").map((m) => ({
    mprn: m.mpxn,
    serial: m.serial,
  }));
  if (gasMeters.length === 0) {
    throw new Error("Missing gas meter serials on Octopus account.");
  }
  const gtariff = latestAgreement(gmPoint.agreements);
  if (!gtariff.tariff_code) {
    throw new Error("Missing gas tariff_code on agreement.");
  }
  const gProduct = productFromTariffCode(gtariff.tariff_code);
  const base = options.baseUrl.replace(/\/$/, "");
  return {
    gasMeters,
    gtariff,
    gtariffPrices: `${base}/products/${gProduct}/gas-tariffs/${gtariff.tariff_code}/standard-unit-rates/`,
    gtariffStanding: `${base}/products/${gProduct}/gas-tariffs/${gtariff.tariff_code}/standing-charges/`,
    gasBaseUrl: base,
    gasToken: options.token,
  };
}

/** @deprecated Prefer deriveElectricityTariffs + deriveGasTariffs for dual-supplier setups. */
export function deriveTariffs(
  account: OctopusAccountResponse,
  options?: { baseUrl?: string; token?: string },
): TariffDerivation {
  const baseUrl = options?.baseUrl ?? OCTOPUS_BASE_URL;
  const token = options?.token ?? "";
  return {
    ...deriveElectricityTariffs(account, { baseUrl, token }),
    ...deriveGasTariffs(account, { baseUrl, token }),
  };
}

export async function loadDualSupplierTariffs(): Promise<TariffDerivation> {
  const octo = resolveOctoCredentials();
  const edf = resolveEdfCredentialConfig();
  const edfToken = await resolveEdfAccessToken();
  const [edfAccount, octoAccount] = await Promise.all([
    fetchKrakenJson<OctopusAccountResponse>(
      `${EDF_BASE_URL}/accounts/${edf.accountNumber}/`,
      edfToken,
    ),
    fetchKrakenJson<OctopusAccountResponse>(
      `${OCTOPUS_BASE_URL}/accounts/${octo.accountNumber}/`,
      octo.token,
    ),
  ]);
  return {
    ...deriveElectricityTariffs(edfAccount, {
      baseUrl: EDF_BASE_URL,
      token: edfToken,
      offPeakStartHour: edf.offPeakStartHour,
      offPeakEndHour: edf.offPeakEndHour,
    }),
    ...deriveGasTariffs(octoAccount, {
      baseUrl: OCTOPUS_BASE_URL,
      token: octo.token,
    }),
  };
}

function authorizationHeaders(token: string): Record<string, string> {
  const raw = token.trim();
  if (/^Basic\s+/i.test(raw) || /^Bearer\s+/i.test(raw) || /^JWT\s+/i.test(raw) || /^Token\s+/i.test(raw)) {
    return { Authorization: raw };
  }
  // Kraken JWTs / opaque session tokens are passed through as Authorization.
  if (raw.startsWith("eyJ")) {
    return { Authorization: raw };
  }
  // Match existing Octopus behaviour: Basic auth of the raw API key string.
  return {
    Authorization: `Basic ${Buffer.from(`${raw}`).toString("base64")}`,
  };
}

export async function fetchKrakenJson<T>(url: string, token: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      ...authorizationHeaders(token),
    },
  });
  if (response.ok) {
    return (await response.json()) as T;
  }
  throw new Error(`Energy API request failed (${response.status}) for ${url}`);
}

/** @deprecated Use fetchKrakenJson. */
export async function fetchOctopusJson<T>(url: string, token: string): Promise<T> {
  return fetchKrakenJson<T>(url, token);
}

type PagedResults<T> = {
  next?: string | null;
  results?: T[];
};

export async function fetchAllOctopusResults<T>(
  url: string,
  token: string,
): Promise<T[]> {
  const all: T[] = [];
  let nextUrl: string | null = url;
  let pageGuard = 0;

  while (nextUrl) {
    pageGuard += 1;
    if (pageGuard > 500) {
      throw new Error("Too many energy API pages while fetching results.");
    }
    const page = await fetchKrakenJson<PagedResults<T>>(nextUrl, token);
    all.push(...(page.results || []));
    nextUrl = page.next || null;
  }

  return all;
}

export function toIsoNoMs(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function ratesUrlWithWindow(baseUrl: string, from: Date, to: Date): string {
  const url = new URL(baseUrl);
  url.searchParams.set("period_from", toIsoNoMs(from));
  url.searchParams.set("period_to", toIsoNoMs(to));
  return url.toString();
}

function shouldUseColor(): boolean {
  return Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
}

function colorize(text: string, color: string): string {
  if (!shouldUseColor()) return text;
  return `${color}${text}${ANSI_RESET}`;
}

function formatWindow(rate: OctopusRate): string {
  const from = rate.valid_from ? new Date(rate.valid_from) : null;
  const to = rate.valid_to ? new Date(rate.valid_to) : null;
  if (
    !from ||
    Number.isNaN(from.getTime()) ||
    !to ||
    Number.isNaN(to.getTime())
  ) {
    return "unknown";
  }
  const dayLabel = from.toLocaleDateString("en-GB", {
    weekday: "short",
    timeZone: UK_TZ,
  });
  const day = from.toLocaleDateString("en-GB", {
    day: "numeric",
    timeZone: UK_TZ,
  });
  const month = from.toLocaleDateString("en-GB", {
    month: "numeric",
    timeZone: UK_TZ,
  });
  const startTime = from.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: UK_TZ,
  });
  const endTime = to.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: UK_TZ,
  });
  const capDay =
    dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1).toLowerCase();
  return `${capDay} ${day}/${month} ${startTime} -> ${endTime}`;
}

export function colorForRate(rateIncVat: number, fuel: FuelType): string {
  if (fuel === "electricity") {
    if (rateIncVat <= 5) return ANSI_GREEN;
    if (rateIncVat <= 12) return ANSI_YELLOW;
    if (rateIncVat < 20) return ANSI_ORANGE;
    return ANSI_RED;
  }

  if (rateIncVat < 4) return ANSI_GREEN;
  if (rateIncVat <= 5) return ANSI_YELLOW;
  if (rateIncVat < 6) return ANSI_ORANGE;
  return ANSI_RED;
}

export function formatRateLine(rate: OctopusRate, fuel: FuelType): string {
  const inc =
    rate.value_inc_vat == null ? "?" : `${rate.value_inc_vat.toFixed(4)}p`;
  if (rate.value_inc_vat == null) {
    return inc;
  }
  const colored = colorize(inc, colorForRate(rate.value_inc_vat, fuel));
  if (!rate.valid_from) {
    return colored;
  }
  const window = formatWindow(rate);
  if (window === "unknown") {
    return colored;
  }
  return `${window} | ${colored}`;
}

export function dayKeyUK(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: UK_TZ });
}

export function ukTomorrowYmd(now: Date = new Date()): string {
  const [year, month, day] = dayKeyUK(now).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + 1));
  return date.toISOString().slice(0, 10);
}

/** Rates overlapping the UK day — gas rates often span months with `valid_to: null`. */
export function gasRatesForDay(rates: OctopusRate[], dayYmd: string): OctopusRate[] {
  return rates
    .filter((rate) => {
      if (!rate.valid_from) return false;
      if (dayKeyUK(new Date(rate.valid_from)) > dayYmd) return false;
      if (!rate.valid_to) return true;
      return dayKeyUK(new Date(new Date(rate.valid_to).getTime() - 1)) >= dayYmd;
    })
    .sort((a, b) => new Date(a.valid_from || "").getTime() - new Date(b.valid_from || "").getTime());
}

function cacheEntryAgeDays(dayYmd: string, now: Date): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayYmd)) return null;
  const [tY, tM, tD] = dayKeyUK(now).split("-").map(Number);
  const [y, m, d] = dayYmd.split("-").map(Number);
  const todayUtc = Date.UTC(tY, tM - 1, tD);
  const entryUtc = Date.UTC(y, m - 1, d);
  if (Number.isNaN(entryUtc)) return null;
  return Math.floor((todayUtc - entryUtc) / DAY_MS);
}

function pruneStaleDateKeyedCache<T extends Record<string, unknown>>(
  cache: T,
  now: Date = new Date(),
): { cache: T; pruned: boolean } {
  let pruned = false;
  const next = { ...cache };
  for (const dayKey of Object.keys(next)) {
    const ageDays = cacheEntryAgeDays(dayKey, now);
    if (ageDays != null && ageDays > DAILY_PRICE_CACHE_MAX_AGE_DAYS) {
      delete next[dayKey];
      pruned = true;
    }
  }
  return { cache: next, pruned };
}

function normalizeCachedGasDay(value: unknown): OctopusRate[] | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return [{ value_inc_vat: value }];
  }
  if (!Array.isArray(value) || value.length === 0) return null;
  if (typeof value[0] === "number") {
    const prices = value.filter(
      (entry): entry is number => typeof entry === "number" && Number.isFinite(entry),
    );
    return prices.length > 0
      ? prices.map((price) => ({ value_inc_vat: price }))
      : null;
  }
  const rates: OctopusRate[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const price = record.value_inc_vat;
    if (typeof price !== "number" || !Number.isFinite(price)) continue;
    rates.push({
      valid_from: record.valid_from ? String(record.valid_from) : undefined,
      valid_to: record.valid_to ? String(record.valid_to) : undefined,
      value_inc_vat: price,
    });
  }
  return rates.length > 0 ? rates : null;
}

export function dayKeysBackInclusive(now: Date, days: number): string[] {
  const keys: string[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now.getTime() - i * DAY_MS);
    keys.push(dayKeyUK(d));
  }
  return keys;
}

function fetchWindowForDayKeys(dayKeys: string[], now: Date): { from: Date; to: Date } {
  if (dayKeys.length === 0) {
    const from = new Date(now);
    return { from, to: new Date(from.getTime() + 2 * DAY_MS) };
  }
  let minMs = Number.POSITIVE_INFINITY;
  let maxMs = Number.NEGATIVE_INFINITY;
  for (const key of dayKeys) {
    const [y, m, d] = key.split("-").map(Number);
    const ms = Date.UTC(y, m - 1, d);
    if (ms < minMs) minMs = ms;
    if (ms > maxMs) maxMs = ms;
  }
  // UK midnight is 23:00 UTC the previous day during BST.
  const from = new Date(minMs - 60 * 60 * 1000);
  const to = new Date(Math.max(maxMs + DAY_MS, now.getTime() + 2 * DAY_MS));
  return { from, to };
}

function loadGasPriceCacheRaw(now: Date = new Date()): GasPriceCache {
  const raw = readServiceCache("octo").gasPrices;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const cache: GasPriceCache = {};
  for (const [dayKey, value] of Object.entries(raw)) {
    const rates = normalizeCachedGasDay(value);
    if (rates) {
      cache[dayKey] = rates;
    }
  }
  const { cache: pruned, pruned: didPrune } = pruneStaleDateKeyedCache(cache, now);
  if (didPrune) {
    saveGasPriceCache(pruned);
  }
  return pruned;
}

export function readGasPriceCache(now: Date = new Date()): GasPriceCache {
  return loadGasPriceCacheRaw(now);
}

export function saveGasPriceCache(cache: GasPriceCache, now: Date = new Date()): void {
  const { cache: pruned } = pruneStaleDateKeyedCache(cache, now);
  updateServiceCache("octo", { gasPrices: pruned });
}

function hasCachedDay(cache: GasPriceCache, dayYmd: string): boolean {
  const rates = cache[dayYmd];
  return Array.isArray(rates) && rates.length > 0;
}

async function ensureGasPricesCached(dayKeys: string[], now: Date): Promise<GasPriceCache> {
  await ensureOctoCacheLoaded();
  const cache = readGasPriceCache(now);
  const missing = dayKeys.filter((dayKey) => !hasCachedDay(cache, dayKey));
  if (missing.length === 0) {
    return cache;
  }

  const { from, to } = fetchWindowForDayKeys(missing, now);
  const fetched = await fetchGasRates(from, to);
  let updated = false;
  for (const dayKey of missing) {
    const dayRates = gasRatesForDay(fetched, dayKey);
    if (dayRates.length > 0) {
      cache[dayKey] = dayRates;
      updated = true;
    }
  }
  if (updated) {
    saveGasPriceCache(cache);
  }
  return cache;
}

export async function loadGasRatesForDays(
  dayKeys: string[],
  now: Date = new Date(),
): Promise<OctopusRate[]> {
  const cache = await ensureGasPricesCached(dayKeys, now);
  const rates: OctopusRate[] = [];
  const seen = new Set<string>();
  for (const dayKey of dayKeys) {
    for (const rate of cache[dayKey] ?? []) {
      const id = `${rate.valid_from}|${rate.valid_to}|${rate.value_inc_vat}`;
      if (seen.has(id)) continue;
      seen.add(id);
      rates.push(rate);
    }
  }
  return rates;
}

export async function fetchGasRates(from: Date, to: Date): Promise<OctopusRate[]> {
  const { token, accountNumber } = resolveOctoCredentials();
  const accountUrl = `${OCTOPUS_BASE_URL}/accounts/${accountNumber}/`;
  const account = await fetchKrakenJson<OctopusAccountResponse>(accountUrl, token);
  const derived = deriveGasTariffs(account, { baseUrl: OCTOPUS_BASE_URL, token });
  const url = ratesUrlWithWindow(derived.gtariffPrices, from, to);
  const rates = await fetchAllOctopusResults<OctopusRate>(url, token);
  const directDebit = rates.filter((rate) => rate.payment_method === "DIRECT_DEBIT");
  return directDebit.length > 0 ? directDebit : rates;
}

export async function loadTodayTomorrowGasRates(now: Date = new Date()): Promise<{
  today: OctopusRate[];
  tomorrow: OctopusRate[];
}> {
  const todayYmd = dayKeyUK(now);
  const tomorrowYmd = ukTomorrowYmd(now);
  const cache = await ensureGasPricesCached([todayYmd, tomorrowYmd], now);
  return {
    today: cache[todayYmd] ?? [],
    tomorrow: cache[tomorrowYmd] ?? [],
  };
}

function formatGasPrice(rate: OctopusRate): string {
  const inc = rate.value_inc_vat;
  if (inc == null) return "?";
  const text = `${inc.toFixed(4)}p`;
  return colorize(text, colorForRate(inc, "gas"));
}

function formatGasPrices(rates: OctopusRate[]): string {
  if (rates.length === 0) return "-";
  return rates.map(formatGasPrice).join(", ");
}

export function formatDayGasLine(label: string, rates: OctopusRate[]): string {
  return `${label} gas unit: ${formatGasPrices(rates)}`;
}

export function formatTodayTomorrowGasLine(
  today: OctopusRate[],
  tomorrow: OctopusRate[],
): string {
  return `today gas unit: ${formatGasPrices(today)}, tomorrow gas unit: ${formatGasPrices(tomorrow)}`;
}

export function formatStandingChargePence(pence: number | null | undefined): string {
  if (pence == null || !Number.isFinite(pence)) return "-";
  return `${pence.toFixed(2)}p/day`;
}

export function formatContractEndLabel(validTo: string | null | undefined): string {
  if (!validTo) return "rolling (no fixed end)";
  const date = new Date(validTo);
  if (Number.isNaN(date.getTime())) return "rolling (no fixed end)";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: UK_TZ,
  });
}

export async function fetchActiveStandingChargePence(
  standingUrl: string,
  token: string,
  now: Date = new Date(),
): Promise<number | null> {
  const from = new Date(now.getTime() - DAY_MS);
  const to = new Date(now.getTime() + 2 * DAY_MS);
  const url = ratesUrlWithWindow(standingUrl, from, to);
  const rates = await fetchAllOctopusResults<OctopusRate>(url, token);
  const directDebit = rates.filter((rate) => rate.payment_method === "DIRECT_DEBIT");
  const preferred = directDebit.length > 0 ? directDebit : rates;
  const active = preferred.find((rate) => {
    if (rate.value_inc_vat == null) return false;
    const start = rate.valid_from ? new Date(rate.valid_from).getTime() : Number.NaN;
    const end = rate.valid_to ? new Date(rate.valid_to).getTime() : Number.POSITIVE_INFINITY;
    if (Number.isNaN(start)) return false;
    const ts = now.getTime();
    return ts >= start && ts < end;
  });
  if (active?.value_inc_vat != null) return active.value_inc_vat;
  const latest = [...preferred]
    .filter((rate) => rate.value_inc_vat != null)
    .sort(
      (a, b) =>
        new Date(b.valid_from || "").getTime() - new Date(a.valid_from || "").getTime(),
    )[0];
  return latest?.value_inc_vat ?? null;
}

function normalizeCachedRateList(value: unknown): OctopusRate[] {
  if (!Array.isArray(value)) return [];
  const rates: OctopusRate[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const price = record.value_inc_vat;
    if (typeof price !== "number" || !Number.isFinite(price)) continue;
    rates.push({
      valid_from: record.valid_from ? String(record.valid_from) : undefined,
      valid_to: record.valid_to ? String(record.valid_to) : undefined,
      value_inc_vat: price,
    });
  }
  return rates;
}

function normalizeCachedElectricityDay(value: unknown): ElectricityDualRates | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    // Legacy half-hourly arrays are dropped — Eco7 uses peak/off-peak summaries.
    return null;
  }
  const record = value as Record<string, unknown>;
  const peak = normalizeCachedRateList(record.peak);
  const offPeak = normalizeCachedRateList(record.offPeak);
  if (peak.length === 0 && offPeak.length === 0) return null;
  return { peak, offPeak };
}

function loadElectricityPriceCacheRaw(now: Date = new Date()): ElectricityPriceCache {
  const raw = readServiceCache("octo").electricityPrices;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const cache: ElectricityPriceCache = {};
  for (const [dayKey, value] of Object.entries(raw)) {
    if (!isPublishSensitiveElectricityDay(dayKey, now)) continue;
    const rates = normalizeCachedElectricityDay(value);
    if (rates) {
      cache[dayKey] = rates;
    }
  }
  const { cache: pruned, pruned: didPrune } = pruneElectricityPriceCache(cache, now);
  if (didPrune) {
    saveElectricityPriceCache(pruned);
  }
  return pruned;
}

export function readElectricityPriceCache(now: Date = new Date()): ElectricityPriceCache {
  return loadElectricityPriceCacheRaw(now);
}

export function saveElectricityPriceCache(cache: ElectricityPriceCache, now: Date = new Date()): void {
  const { cache: pruned } = pruneElectricityPriceCache(cache, now);
  updateServiceCache("octo", { electricityPrices: pruned });
}

function hasCachedElectricityDay(cache: ElectricityPriceCache, dayYmd: string): boolean {
  const rates = cache[dayYmd];
  return Boolean(rates && (rates.peak.length > 0 || rates.offPeak.length > 0));
}

export function isOffPeakUkHour(
  hour: number,
  startHour: number = DEFAULT_ECO7_OFF_PEAK_START_HOUR,
  endHour: number = DEFAULT_ECO7_OFF_PEAK_END_HOUR,
): boolean {
  if (startHour === endHour) return false;
  if (startHour < endHour) return hour >= startHour && hour < endHour;
  return hour >= startHour || hour < endHour;
}

/** Eco7 day/night rates are not publish-gated like Agile half-hours. */
function isElectricityDayFetchable(_dayKey: string, _now: Date): boolean {
  return true;
}

/** Half-hour slots are only cached for today and tomorrow (~36h ahead). */
function isPublishSensitiveElectricityDay(dayKey: string, now: Date): boolean {
  const todayYmd = dayKeyUK(now);
  const tomorrowYmd = ukTomorrowYmd(now);
  return dayKey === todayYmd || dayKey === tomorrowYmd;
}

function pruneElectricityPriceCache(
  cache: ElectricityPriceCache,
  now: Date = new Date(),
): { cache: ElectricityPriceCache; pruned: boolean } {
  const next: ElectricityPriceCache = {};
  let pruned = false;
  for (const [dayKey, rates] of Object.entries(cache)) {
    if (
      isPublishSensitiveElectricityDay(dayKey, now) &&
      (rates.peak.length > 0 || rates.offPeak.length > 0)
    ) {
      next[dayKey] = rates;
    } else {
      pruned = true;
    }
  }
  if (!pruned && Object.keys(next).length !== Object.keys(cache).length) {
    pruned = true;
  }
  return { cache: next, pruned };
}

function dualRatesForDay(
  peakRates: OctopusRate[],
  offPeakRates: OctopusRate[],
  dayYmd: string,
): ElectricityDualRates {
  return {
    peak: gasRatesForDay(peakRates, dayYmd),
    offPeak: gasRatesForDay(offPeakRates, dayYmd),
  };
}

export async function fetchElectricityDualRates(
  from: Date,
  to: Date,
): Promise<ElectricityDualRates> {
  const edf = resolveEdfCredentialConfig();
  const edfToken = await resolveEdfAccessToken();
  const account = await fetchKrakenJson<OctopusAccountResponse>(
    `${EDF_BASE_URL}/accounts/${edf.accountNumber}/`,
    edfToken,
  );
  const derived = deriveElectricityTariffs(account, {
    baseUrl: EDF_BASE_URL,
    token: edfToken,
    offPeakStartHour: edf.offPeakStartHour,
    offPeakEndHour: edf.offPeakEndHour,
  });
  const dayUrl = ratesUrlWithWindow(derived.etariffDayPrices, from, to);
  const primary = await fetchAllOctopusResults<OctopusRate>(dayUrl, edfToken);
  if (derived.rateMode === "windowed" || !derived.etariffNightPrices) {
    // GoElectric / similar: peak + off-peak are timed windows in standard-unit-rates.
    return splitPeakOffPeakFromRates(primary);
  }
  const nightUrl = ratesUrlWithWindow(derived.etariffNightPrices, from, to);
  const offPeak = await fetchAllOctopusResults<OctopusRate>(nightUrl, edfToken);
  return { peak: primary, offPeak };
}

/** Flatten dual rates for callers that still expect a single list (peak first). */
export async function fetchElectricityRates(from: Date, to: Date): Promise<OctopusRate[]> {
  const dual = await fetchElectricityDualRates(from, to);
  return [...dual.peak, ...dual.offPeak];
}

async function ensureElectricityPricesCached(dayKeys: string[], now: Date): Promise<ElectricityPriceCache> {
  await ensureOctoCacheLoaded();
  const cache = readElectricityPriceCache(now);
  const cacheableKeys = dayKeys.filter((dayKey) => isPublishSensitiveElectricityDay(dayKey, now));
  const missing = cacheableKeys.filter((dayKey) => !hasCachedElectricityDay(cache, dayKey));
  if (missing.length === 0) {
    return cache;
  }

  const toFetch = missing.filter((dayKey) => isElectricityDayFetchable(dayKey, now));
  if (toFetch.length === 0) {
    return cache;
  }

  const { from, to } = fetchWindowForDayKeys(toFetch, now);
  const fetched = await fetchElectricityDualRates(from, to);
  let updated = false;
  for (const dayKey of toFetch) {
    const dual = coerceElectricityDualRates(
      dualRatesForDay(fetched.peak, fetched.offPeak, dayKey),
    );
    if (dual.peak.length > 0 || dual.offPeak.length > 0) {
      cache[dayKey] = dual;
      updated = true;
    }
  }
  if (updated) {
    saveElectricityPriceCache(cache);
  }
  return cache;
}

export async function loadElectricityDualRatesForDays(
  dayKeys: string[],
  now: Date = new Date(),
): Promise<ElectricityDualRates> {
  const cacheKeys = dayKeys.filter((dayKey) => isPublishSensitiveElectricityDay(dayKey, now));
  const ephemeralKeys = dayKeys.filter((dayKey) => !isPublishSensitiveElectricityDay(dayKey, now));
  const peak: OctopusRate[] = [];
  const offPeak: OctopusRate[] = [];

  if (cacheKeys.length > 0) {
    const cache = await ensureElectricityPricesCached(cacheKeys, now);
    for (const dayKey of cacheKeys) {
      const cached = coerceElectricityDualRates(cache[dayKey]);
      peak.push(...cached.peak);
      offPeak.push(...cached.offPeak);
    }
  }

  if (ephemeralKeys.length > 0) {
    const { from, to } = fetchWindowForDayKeys(ephemeralKeys, now);
    const fetched = await fetchElectricityDualRates(from, to);
    // fetchElectricityDualRates already returns peak/off-peak split for windowed tariffs.
    for (const dayKey of ephemeralKeys) {
      const dual = coerceElectricityDualRates(dualRatesForDay(fetched.peak, fetched.offPeak, dayKey));
      peak.push(...dual.peak);
      offPeak.push(...dual.offPeak);
    }
  }

  return { peak, offPeak };
}

export async function loadElectricityRatesForDays(
  dayKeys: string[],
  now: Date = new Date(),
): Promise<OctopusRate[]> {
  const dual = await loadElectricityDualRatesForDays(dayKeys, now);
  return [...dual.peak, ...dual.offPeak];
}

function coerceElectricityDualRates(dual: ElectricityDualRates | undefined): ElectricityDualRates {
  if (!dual) return { peak: [], offPeak: [] };
  // Older cache entries stored all windows under `peak` only — split for display.
  if (dual.offPeak.length === 0 && dual.peak.length > 0) {
    return splitPeakOffPeakFromRates(dual.peak);
  }
  return dual;
}

export async function loadTodayTomorrowElectricityDualRates(now: Date = new Date()): Promise<{
  today: ElectricityDualRates;
  tomorrow: ElectricityDualRates;
}> {
  const todayYmd = dayKeyUK(now);
  const tomorrowYmd = ukTomorrowYmd(now);
  const cache = await ensureElectricityPricesCached([todayYmd, tomorrowYmd], now);
  return {
    today: coerceElectricityDualRates(cache[todayYmd]),
    tomorrow: coerceElectricityDualRates(cache[tomorrowYmd]),
  };
}

export async function loadTodayTomorrowElectricityRates(now: Date = new Date()): Promise<{
  today: OctopusRate[];
  tomorrow: OctopusRate[];
}> {
  const dual = await loadTodayTomorrowElectricityDualRates(now);
  return {
    today: [...dual.today.peak, ...dual.today.offPeak],
    tomorrow: [...dual.tomorrow.peak, ...dual.tomorrow.offPeak],
  };
}

function normalizeDailyDayTotals(value: unknown): DailyDayTotals | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const rec = value as Record<string, unknown>;
  const eCost = Number(rec.eCost);
  const gCost = Number(rec.gCost);
  const eKwh = Number(rec.eKwh);
  const gKwh = Number(rec.gKwh);
  if (
    !Number.isFinite(eCost) ||
    !Number.isFinite(gCost) ||
    !Number.isFinite(eKwh) ||
    !Number.isFinite(gKwh)
  ) {
    return null;
  }
  return { eCost, gCost, eKwh, gKwh };
}

export function isDailyTotalsCacheableDay(dayKey: string, now: Date = new Date()): boolean {
  const ageDays = cacheEntryAgeDays(dayKey, now);
  return ageDays != null && ageDays >= DAILY_TOTALS_SETTLE_DAYS;
}

/** UK local midnight for a `YYYY-MM-DD` key (Europe/London). */
export function ukDayStartFromKey(dayKey: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
  if (!match) {
    throw new Error(`Invalid UK day key: ${dayKey}`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const rough = Date.UTC(year, month - 1, day, 0, 0, 0);
  for (let offsetHours = -2; offsetHours <= 2; offsetHours += 1) {
    const candidate = new Date(rough + offsetHours * 3_600_000);
    if (dayKeyUK(candidate) !== dayKey) continue;
    const hour = Number(
      candidate.toLocaleTimeString("en-GB", {
        hour: "numeric",
        hour12: false,
        timeZone: UK_TZ,
      }),
    );
    if (hour === 0) return candidate;
  }
  return new Date(`${dayKey}T00:00:00.000Z`);
}

/** While consumption is still settling, keep the more complete daily snapshot. */
export function preferMoreCompleteDayTotals(
  cached: DailyDayTotals | undefined,
  fresh: DailyDayTotals,
): DailyDayTotals {
  if (!cached) return fresh;
  const cachedKwh = cached.eKwh + cached.gKwh;
  const freshKwh = fresh.eKwh + fresh.gKwh;
  if (freshKwh >= cachedKwh) return fresh;
  return cached;
}

function pruneDailyTotalsCache(
  cache: DailyTotalsCache,
  now: Date = new Date(),
): { cache: DailyTotalsCache; pruned: boolean } {
  let pruned = false;
  const next: DailyTotalsCache = {};
  for (const [dayKey, value] of Object.entries(cache)) {
    const ageDays = cacheEntryAgeDays(dayKey, now);
    if (ageDays != null && ageDays > DAILY_TOTALS_CACHE_MAX_AGE_DAYS) {
      pruned = true;
      continue;
    }
    next[dayKey] = value;
  }
  return { cache: next, pruned };
}

function loadDailyTotalsCacheRaw(now: Date = new Date()): DailyTotalsCache {
  const raw = readServiceCache("octo").dailyTotals;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const cache: DailyTotalsCache = {};
  for (const [dayKey, value] of Object.entries(raw)) {
    const totals = normalizeDailyDayTotals(value);
    if (totals) {
      cache[dayKey] = totals;
    }
  }
  const { cache: pruned, pruned: didPrune } = pruneDailyTotalsCache(cache, now);
  if (didPrune) {
    saveDailyTotalsCache(pruned);
  }
  return pruned;
}

export function readDailyTotalsCache(now: Date = new Date()): DailyTotalsCache {
  return loadDailyTotalsCacheRaw(now);
}

export function saveDailyTotalsCache(cache: DailyTotalsCache, now: Date = new Date()): void {
  const { cache: pruned } = pruneDailyTotalsCache(cache, now);
  updateServiceCache("octo", { dailyTotals: pruned });
}

export function dailyTotalsMapsFromCache(cache: DailyTotalsCache): {
  eCost: Record<string, number>;
  gCost: Record<string, number>;
  eKwh: Record<string, number>;
  gKwh: Record<string, number>;
} {
  const eCost: Record<string, number> = {};
  const gCost: Record<string, number> = {};
  const eKwh: Record<string, number> = {};
  const gKwh: Record<string, number> = {};
  for (const [dayKey, totals] of Object.entries(cache)) {
    eCost[dayKey] = totals.eCost;
    gCost[dayKey] = totals.gCost;
    eKwh[dayKey] = totals.eKwh;
    gKwh[dayKey] = totals.gKwh;
  }
  return { eCost, gCost, eKwh, gKwh };
}

export function ukHourFromIso(iso: string): number | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const hour = Number(date.toLocaleTimeString("en-GB", {
    hour: "numeric",
    hour12: false,
    timeZone: UK_TZ,
  }));
  return Number.isFinite(hour) ? hour : null;
}

function pickRepresentativeRate(rates: OctopusRate[]): number | null {
  for (const rate of rates) {
    if (rate.value_inc_vat != null && Number.isFinite(rate.value_inc_vat)) {
      return rate.value_inc_vat;
    }
  }
  return null;
}

function formatElectricityPrice(pence: number, narrow = false): string {
  const text = narrow ? `${Math.round(pence)}p` : `${pence.toFixed(2)}p`;
  return colorize(text, colorForRate(pence, "electricity"));
}

function formatDualRateSummary(dual: ElectricityDualRates, narrow = false): string {
  const peak = pickRepresentativeRate(dual.peak);
  const offPeak = pickRepresentativeRate(dual.offPeak);
  if (peak == null && offPeak == null) return "-";
  if (offPeak == null) {
    return peak == null ? "-" : formatElectricityPrice(peak, narrow);
  }
  if (peak == null) {
    return `off-peak ${formatElectricityPrice(offPeak, narrow)}`;
  }
  return `peak ${formatElectricityPrice(peak, narrow)} / off-peak ${formatElectricityPrice(offPeak, narrow)}`;
}

export function formatDayElectricityLine(
  label: string,
  dual: ElectricityDualRates,
  options?: { narrow?: boolean },
): string {
  return `${label} elec unit: ${formatDualRateSummary(dual, options?.narrow ?? false)}`;
}

export function formatTodayTomorrowElectricityLine(
  today: ElectricityDualRates,
  tomorrow: ElectricityDualRates,
  options?: { narrow?: boolean },
): string {
  const narrow = options?.narrow ?? false;
  return `today elec unit: ${formatDualRateSummary(today, narrow)}, tomorrow elec unit: ${formatDualRateSummary(tomorrow, narrow)}`;
}

export function formatElectricityTariffDetailLines(options: {
  tariffCode: string;
  rateMode: ElectricityRateMode;
  today: ElectricityDualRates;
  tomorrow: ElectricityDualRates;
  standingPence: number | null;
  contractEnd: string | null | undefined;
  narrow?: boolean;
}): string[] {
  const modeNote =
    options.rateMode === "eco7"
      ? "Eco7"
      : options.rateMode === "windowed"
        ? "peak/off-peak"
        : "standard";
  return [
    `Elec tariff: ${options.tariffCode} (${modeNote})`,
    `Elec unit today: ${formatDualRateSummary(options.today, options.narrow)}`,
    `Elec unit tomorrow: ${formatDualRateSummary(options.tomorrow, options.narrow)}`,
    `Elec standing: ${formatStandingChargePence(options.standingPence)}`,
    `Elec contract ends: ${formatContractEndLabel(options.contractEnd)}`,
  ];
}

export function formatGasTariffDetailLines(options: {
  tariffCode: string;
  today: OctopusRate[];
  tomorrow: OctopusRate[];
  standingPence: number | null;
  contractEnd: string | null | undefined;
}): string[] {
  return [
    `Gas tariff: ${options.tariffCode}`,
    `Gas unit today: ${formatGasPrices(options.today)}`,
    `Gas unit tomorrow: ${formatGasPrices(options.tomorrow)}`,
    `Gas standing: ${formatStandingChargePence(options.standingPence)}`,
    `Gas contract ends: ${formatContractEndLabel(options.contractEnd)}`,
  ];
}

/** @deprecated Use formatTodayTomorrowElectricityLine — half-hourly Agile table removed for Eco7. */
export function formatElectricityPeriodAvgTable(
  today: OctopusRate[] | ElectricityDualRates,
  tomorrow: OctopusRate[] | ElectricityDualRates,
  options?: { narrow?: boolean },
): string[] {
  const toDual = (value: OctopusRate[] | ElectricityDualRates): ElectricityDualRates => {
    if (Array.isArray(value)) return { peak: value, offPeak: [] };
    return value;
  };
  const line = formatTodayTomorrowElectricityLine(toDual(today), toDual(tomorrow), options);
  if (line.includes(": -") && line.endsWith(": -")) return [];
  // Keep returning lines so existing callers that join arrays still work.
  if (line.includes("today elec: -") && line.includes("tomorrow elec: -")) return [];
  return [line];
}

function padAsciiCell(value: string, width: number): string {
  const visible = value.replace(ANSI_REGEX, "").length;
  return value + " ".repeat(Math.max(0, width - visible));
}

function makeAsciiTable(headers: string[], rows: string[][]): string[] {
  const widths = headers.map((header, idx) =>
    Math.max(
      header.replace(ANSI_REGEX, "").length,
      ...rows.map((row) => (row[idx] || "").replace(ANSI_REGEX, "").length),
    ),
  );
  const border = `+-${widths.map((w) => "-".repeat(w)).join("-+-")}-+`;
  const headerLine = `| ${headers.map((h, i) => padAsciiCell(h, widths[i])).join(" | ")} |`;
  const body = rows.map(
    (row) =>
      `| ${row.map((v, i) => padAsciiCell(v || "", widths[i])).join(" | ")} |`,
  );
  return [border, headerLine, border, ...body, border];
}

type MonthlyAverageRecord = {
  eCost: number;
  gCost: number;
  eKwh: number;
  gKwh: number;
  days: number;
};

type MonthlyAverageCache = Record<string, MonthlyAverageRecord>;

function readMonthlyAverageCache(): MonthlyAverageCache {
  const raw = readServiceCache("octo").monthlyAverages;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const cache: MonthlyAverageCache = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!/^\d{4}-\d{2}$/.test(key)) continue;
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const rec = value as Record<string, unknown>;
    const eCost = Number(rec.eCost);
    const gCost = Number(rec.gCost);
    const eKwh = Number(rec.eKwh);
    const gKwh = Number(rec.gKwh);
    const days = Number(rec.days);
    if (
      !Number.isFinite(eCost) ||
      !Number.isFinite(gCost) ||
      !Number.isFinite(eKwh) ||
      !Number.isFinite(gKwh) ||
      !Number.isFinite(days) ||
      days <= 0
    ) {
      continue;
    }
    cache[key] = { eCost, gCost, eKwh, gKwh, days };
  }
  return cache;
}

function monthKeyFromDayKey(dayKey: string): string {
  return dayKey.slice(0, 7);
}

function monthlyAveragesFromDailyTotals(now: Date = new Date()): MonthlyAverageCache {
  const { eCost, gCost, eKwh, gKwh } = dailyTotalsMapsFromCache(readDailyTotalsCache(now));
  const dayKeys = new Set([
    ...Object.keys(eCost),
    ...Object.keys(gCost),
    ...Object.keys(eKwh),
    ...Object.keys(gKwh),
  ]);
  const sums: Record<
    string,
    { eCost: number; gCost: number; eKwh: number; gKwh: number; days: number }
  > = {};
  for (const dayKey of dayKeys) {
    const ageDays = cacheEntryAgeDays(dayKey, now);
    if (ageDays == null || ageDays < DAILY_TOTALS_SETTLE_DAYS) continue;
    const month = monthKeyFromDayKey(dayKey);
    sums[month] ||= { eCost: 0, gCost: 0, eKwh: 0, gKwh: 0, days: 0 };
    sums[month].eCost += eCost[dayKey] || 0;
    sums[month].gCost += gCost[dayKey] || 0;
    sums[month].eKwh += eKwh[dayKey] || 0;
    sums[month].gKwh += gKwh[dayKey] || 0;
    sums[month].days += 1;
  }
  const out: MonthlyAverageCache = {};
  for (const [month, sum] of Object.entries(sums)) {
    if (sum.days <= 0) continue;
    out[month] = {
      eCost: sum.eCost / sum.days,
      gCost: sum.gCost / sum.days,
      eKwh: sum.eKwh / sum.days,
      gKwh: sum.gKwh / sum.days,
      days: sum.days,
    };
  }
  return out;
}

function resolveMonthlyAverageRecord(
  monthKey: string,
  cached: MonthlyAverageCache,
  computed: MonthlyAverageCache,
): MonthlyAverageRecord | undefined {
  const cachedRec = cached[monthKey];
  const computedRec = computed[monthKey];
  if (!cachedRec) return computedRec;
  if (!computedRec) return cachedRec;
  if (computedRec.days > cachedRec.days) return computedRec;
  return cachedRec;
}

function currentMonthKey(now: Date): string {
  return now.toLocaleDateString("en-CA", { timeZone: UK_TZ }).slice(0, 7);
}

function priorCalendarMonthKey(monthKeyYm: string): string {
  const [ys, ms] = monthKeyYm.split("-");
  const y = Number(ys);
  const m = Number(ms);
  const d = new Date(Date.UTC(y, m - 1, 1));
  d.setUTCMonth(d.getUTCMonth() - 1);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function daysInMonthKey(monthKey: string): number {
  const [yRaw, mRaw] = monthKey.split("-");
  const y = Number(yRaw);
  const m = Number(mRaw);
  return new Date(y, m, 0).getDate();
}

function monthLabel(monthKey: string): string {
  const [yRaw, mRaw] = monthKey.split("-");
  const d = new Date(Date.UTC(Number(yRaw), Number(mRaw) - 1, 1));
  return d.toLocaleDateString("en-GB", {
    month: "short",
    year: "2-digit",
    timeZone: UK_TZ,
  });
}

function formatPoundsFromPence(valuePence: number): string {
  return `£${(valuePence / 100).toFixed(2)}`;
}

function formatAverageAndTotalCost(
  averagePence: number,
  totalPence: number,
  projectedPence?: number,
): string {
  const average = Math.round(averagePence);
  const totalPounds = Math.round(totalPence / 100);
  if (projectedPence === undefined) {
    return `${average}p (£${totalPounds})`;
  }
  const projectedPounds = Math.round(projectedPence / 100);
  return `${average}p (£${totalPounds} // £${projectedPounds})`;
}

export function formatMonthlyTotalCostSummaryLines(now: Date = new Date()): string[] {
  const cached = readMonthlyAverageCache();
  const computed = monthlyAveragesFromDailyTotals(now);
  const currentKey = currentMonthKey(now);
  const prevKey = priorCalendarMonthKey(currentKey);
  const rows = [currentKey, prevKey].map((key) => {
    const rec = resolveMonthlyAverageRecord(key, cached, computed);
    const label = monthLabel(key);
    if (!rec) return [label, "-", "-", "-"];
    const eTotal = rec.eCost * rec.days;
    const gTotal = rec.gCost * rec.days;
    const totalAverage = rec.eCost + rec.gCost;
    const totalCost = eTotal + gTotal;
    const projectedCost =
      key === currentKey ? totalAverage * daysInMonthKey(key) : undefined;
    return [
      label,
      formatPoundsFromPence(eTotal),
      formatPoundsFromPence(gTotal),
      formatAverageAndTotalCost(totalAverage, totalCost, projectedCost),
    ];
  });

  return [
    "Monthly total cost summary",
    ...makeAsciiTable(["Month", "⚡ total", "Gas total", "Total"], rows),
  ];
}
