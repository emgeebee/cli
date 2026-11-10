import {
  ensureWeatherCacheLoaded,
  readServiceCache,
  updateServiceCache,
} from "./cache";

const DAY_MS = 24 * 60 * 60 * 1000;
const SUNRISE_SUNSET_API = "https://api.sunrise-sunset.org/v2";
const POSTCODES_IO_BASE = "https://api.postcodes.io";
/** Reuse cached values unless all events are in the past or the snapshot is old. */
const CACHE_MAX_AGE_DAYS = 60;

export type DayLengthExtreme = {
  date: string;
  dayLengthSeconds: number;
};

type SeasonEventKey = "spring" | "longest" | "autumn" | "shortest";

const SEASON_EVENTS: ReadonlyArray<{
  key: SeasonEventKey;
  label: string;
  month: number;
  day: number;
}> = [
  { key: "spring", label: "Spring equinox", month: 3, day: 20 },
  { key: "longest", label: "Longest day", month: 6, day: 21 },
  { key: "autumn", label: "Autumn equinox", month: 9, day: 22 },
  { key: "shortest", label: "Shortest day", month: 12, day: 21 },
];

export type DayLengthExtremes = {
  locationKey: string;
  latitude: number;
  longitude: number;
  spring: DayLengthExtreme;
  longest: DayLengthExtreme;
  autumn: DayLengthExtreme;
  shortest: DayLengthExtreme;
  /** UK calendar day used when resolving which year's events to fetch. */
  fetchedForDate: string;
  fetchedAt: string;
};

export type DayLengthExtremesCache = Record<string, DayLengthExtremes>;

type SunriseSunsetDayResponse = {
  date?: string;
  day_length?: number;
  days?: Array<{ date?: string; day_length?: number }>;
};

type PostcodesIoResult = {
  status?: number;
  result?: {
    latitude?: number;
    longitude?: number;
  };
};

function parseYmdUtc(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function ymdForYear(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function calendarDaysBetween(fromYmd: string, toYmd: string): number {
  return Math.round((parseYmdUtc(toYmd).getTime() - parseYmdUtc(fromYmd).getTime()) / DAY_MS);
}

/** Pick the occurrence of month/day nearest to today (search year-1..year+1). */
export function nearestEventDate(todayYmd: string, month: number, day: number): string {
  const year = Number(todayYmd.slice(0, 4));
  const candidates = [year - 1, year, year + 1].map((y) => ymdForYear(y, month, day));
  let best = candidates[0]!;
  let bestAbs = Math.abs(calendarDaysBetween(todayYmd, best));
  for (const candidate of candidates.slice(1)) {
    const abs = Math.abs(calendarDaysBetween(todayYmd, candidate));
    if (abs < bestAbs) {
      best = candidate;
      bestAbs = abs;
    }
  }
  return best;
}

export function formatDayLengthSeconds(seconds: number): string {
  const totalMinutes = Math.max(0, Math.round(seconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${hours}h ${String(mins).padStart(2, "0")}m`;
}

export function formatRelativeDayOffset(fromYmd: string, eventYmd: string): string {
  const days = calendarDaysBetween(fromYmd, eventYmd);
  if (days === 0) return "today";
  if (days > 0) return `in ${days}d`;
  return `${Math.abs(days)}d ago`;
}

export function formatDayLengthExtremeLines(
  extremes: DayLengthExtremes,
  todayYmd: string,
): string[] {
  return SEASON_EVENTS.map(({ key, label }) => {
    const event = extremes[key];
    return `${label} (${formatRelativeDayOffset(todayYmd, event.date)}): ${formatDayLengthSeconds(event.dayLengthSeconds)}`;
  });
}

function normalizeExtreme(value: unknown): DayLengthExtreme | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const rec = value as Record<string, unknown>;
  const date = String(rec.date || "");
  const dayLengthSeconds = Number(rec.dayLengthSeconds);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(dayLengthSeconds)) return null;
  return { date, dayLengthSeconds };
}

function normalizeCachedExtremes(value: unknown, locationKey: string): DayLengthExtremes | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const rec = value as Record<string, unknown>;
  const spring = normalizeExtreme(rec.spring);
  const longest = normalizeExtreme(rec.longest);
  const autumn = normalizeExtreme(rec.autumn);
  const shortest = normalizeExtreme(rec.shortest);
  const latitude = Number(rec.latitude);
  const longitude = Number(rec.longitude);
  if (
    !spring ||
    !longest ||
    !autumn ||
    !shortest ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return null;
  }
  return {
    locationKey,
    latitude,
    longitude,
    spring,
    longest,
    autumn,
    shortest,
    fetchedForDate: String(rec.fetchedForDate || longest.date),
    fetchedAt: String(rec.fetchedAt || ""),
  };
}

export function readDayLengthExtremesCache(): DayLengthExtremesCache {
  const raw = readServiceCache("weather").dayLengthExtremes;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};

  const cache: DayLengthExtremesCache = {};
  for (const [locationKey, value] of Object.entries(raw)) {
    const normalized = normalizeCachedExtremes(value, locationKey);
    if (normalized) cache[locationKey] = normalized;
  }
  return cache;
}

export function saveDayLengthExtremesCache(cache: DayLengthExtremesCache): void {
  updateServiceCache("weather", { dayLengthExtremes: cache });
}

function cacheIsFresh(cache: DayLengthExtremes, todayYmd: string): boolean {
  const allPast = SEASON_EVENTS.every(({ key }) => cache[key].date < todayYmd);
  if (allPast) return false;
  const ageDays = Math.abs(
    calendarDaysBetween(cache.fetchedForDate || cache.longest.date, todayYmd),
  );
  return ageDays <= CACHE_MAX_AGE_DAYS;
}

async function lookupLatLng(
  locationKey: string,
): Promise<{ latitude: number; longitude: number } | null> {
  const candidates = [
    `${POSTCODES_IO_BASE}/postcodes/${encodeURIComponent(locationKey)}`,
    `${POSTCODES_IO_BASE}/outcodes/${encodeURIComponent(locationKey)}`,
  ];
  for (const url of candidates) {
    try {
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      if (!response.ok) continue;
      const payload = (await response.json()) as PostcodesIoResult;
      const latitude = payload.result?.latitude;
      const longitude = payload.result?.longitude;
      if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        return { latitude: latitude!, longitude: longitude! };
      }
    } catch {
      // try next candidate
    }
  }
  return null;
}

function normalizeLocationKey(location: string): string {
  return String(location || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

/** Resolve lat/lng for a UK postcode/outcode, preferring cached weather coords. */
export async function resolveWeatherLocationCoords(
  location: string,
): Promise<{ locationKey: string; latitude: number; longitude: number } | null> {
  const locationKey = normalizeLocationKey(location);
  if (!locationKey) return null;

  await ensureWeatherCacheLoaded();
  const cached = readDayLengthExtremesCache()[locationKey];
  if (cached && Number.isFinite(cached.latitude) && Number.isFinite(cached.longitude)) {
    return {
      locationKey,
      latitude: cached.latitude,
      longitude: cached.longitude,
    };
  }

  const coords = await lookupLatLng(locationKey);
  if (!coords) return null;
  return { locationKey, ...coords };
}

async function fetchDayLengthForDate(
  latitude: number,
  longitude: number,
  date: string,
): Promise<DayLengthExtreme | null> {
  const url = new URL(SUNRISE_SUNSET_API);
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lng", String(longitude));
  url.searchParams.set("date", date);

  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) return null;
  const payload = (await response.json()) as SunriseSunsetDayResponse;
  const day = payload.days?.[0] ?? payload;
  const dayLengthSeconds = Number(day.day_length);
  const resolvedDate =
    typeof day.date === "string" && /^\d{4}-\d{2}-\d{2}/.test(day.date)
      ? day.date.slice(0, 10)
      : date;
  if (!Number.isFinite(dayLengthSeconds)) return null;
  return { date: resolvedDate, dayLengthSeconds };
}

async function fetchSeasonEventsForCoords(
  locationKey: string,
  latitude: number,
  longitude: number,
  todayYmd: string,
): Promise<DayLengthExtremes | null> {
  const dates = SEASON_EVENTS.map((event) => ({
    key: event.key,
    date: nearestEventDate(todayYmd, event.month, event.day),
  }));

  const results = await Promise.all(
    dates.map(async ({ key, date }) => {
      const extreme = await fetchDayLengthForDate(latitude, longitude, date);
      return extreme ? ([key, extreme] as const) : null;
    }),
  );

  const byKey = {} as Record<SeasonEventKey, DayLengthExtreme>;
  for (const entry of results) {
    if (!entry) return null;
    byKey[entry[0]] = entry[1];
  }

  return {
    locationKey,
    latitude,
    longitude,
    spring: byKey.spring,
    longest: byKey.longest,
    autumn: byKey.autumn,
    shortest: byKey.shortest,
    fetchedForDate: todayYmd,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Day length on solstices/equinoxes for a UK postcode/outcode.
 * Fetches only those four dates and caches via the weather service cache.
 */
export async function getDayLengthExtremesForLocation(
  location: string,
  todayYmd: string,
): Promise<DayLengthExtremes | null> {
  const locationKey = normalizeLocationKey(location);
  if (!locationKey || !/^\d{4}-\d{2}-\d{2}$/.test(todayYmd)) return null;

  await ensureWeatherCacheLoaded();
  const cache = readDayLengthExtremesCache();
  const cached = cache[locationKey] ?? null;
  if (cached && cacheIsFresh(cached, todayYmd)) {
    return cached;
  }

  try {
    const coords =
      cached && Number.isFinite(cached.latitude) && Number.isFinite(cached.longitude)
        ? { latitude: cached.latitude, longitude: cached.longitude }
        : await lookupLatLng(locationKey);
    if (!coords) return cached;

    const fresh = await fetchSeasonEventsForCoords(
      locationKey,
      coords.latitude,
      coords.longitude,
      todayYmd,
    );
    if (!fresh) return cached;
    saveDayLengthExtremesCache({ ...cache, [locationKey]: fresh });
    return fresh;
  } catch {
    return cached;
  }
}
