import { formatDayLengthSeconds, resolveWeatherLocationCoords } from "./dayLengthExtremes";

const OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

export type SunshineDurationDay = {
  date: string;
  sunshineSeconds: number;
};

type OpenMeteoSunshineResponse = {
  daily?: {
    time?: string[];
    sunshine_duration?: number[];
  };
};

export async function fetchSunshineDurationForecast(
  location: string,
  forecastDays = 2,
): Promise<SunshineDurationDay[]> {
  const coords = await resolveWeatherLocationCoords(location);
  if (!coords) return [];

  const url = new URL(OPEN_METEO_FORECAST_URL);
  url.searchParams.set("latitude", String(coords.latitude));
  url.searchParams.set("longitude", String(coords.longitude));
  url.searchParams.set("daily", "sunshine_duration");
  url.searchParams.set("timezone", "Europe/London");
  url.searchParams.set("forecast_days", String(Math.max(1, Math.min(16, forecastDays))));

  try {
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) return [];
    const payload = (await response.json()) as OpenMeteoSunshineResponse;
    const dates = payload.daily?.time || [];
    const durations = payload.daily?.sunshine_duration || [];
    const rows: SunshineDurationDay[] = [];
    for (let i = 0; i < dates.length; i += 1) {
      const date = dates[i];
      const sunshineSeconds = Number(durations[i]);
      if (!date || !Number.isFinite(sunshineSeconds)) continue;
      rows.push({ date, sunshineSeconds });
    }
    return rows;
  } catch {
    return [];
  }
}

function formatSunshineDayLabel(
  date: string,
  todayYmd: string,
  tomorrowYmd: string,
): string {
  const short = new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/London",
  });
  if (date === todayYmd) return `today ${short}`;
  if (date === tomorrowYmd) return `tomorrow ${short}`;
  return short;
}

/** Sentence-case sunshine lines for today/tomorrow outlook. */
export function formatSunshineOutlookLines(
  days: SunshineDurationDay[],
  todayYmd: string,
  tomorrowYmd: string,
): string[] {
  const wanted = [todayYmd, tomorrowYmd].filter(Boolean);
  return wanted.flatMap((date) => {
    const row = days.find((day) => day.date === date);
    if (!row) return [];
    const label = formatSunshineDayLabel(date, todayYmd, tomorrowYmd);
    return [
      `Sunshine ${label}: ${formatDayLengthSeconds(row.sunshineSeconds)}`,
    ];
  });
}
