import { z } from "zod";

export const TEMP_API_URL = "http://api.emgeebee.buzz:1880/api/get-house-temp";

/** API may send null temps as JSON null or the string "null". */
const nullableNumericField = z.preprocess((value) => {
  if (value == null || value === "" || value === "null" || value === "undefined") {
    return null;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return value;
}, z.number().nullable().optional());

const ReadingSchema = z.object({
  time: nullableNumericField,
  temp: nullableNumericField,
});

const TemperatureResponseSchema = z.record(z.string(), z.array(ReadingSchema));

type RawTemperatureReading = z.infer<typeof ReadingSchema>;

export type TemperatureReading = {
  time: number;
  temp: number;
};

export type TemperatureResponse = Record<string, TemperatureReading[]>;

export async function fetchTemperatureHistory(): Promise<TemperatureResponse> {
  const response = await fetch(TEMP_API_URL, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(`Temperature API request failed (${response.status})`);
  }
  const payload = TemperatureResponseSchema.parse(await response.json());
  const cleaned: TemperatureResponse = {};
  for (const [room, readings] of Object.entries(payload)) {
    cleaned[room] = (readings as RawTemperatureReading[])
      .filter((reading) => Number.isFinite(reading.time) && Number.isFinite(reading.temp))
      .map((reading) => ({
        time: reading.time as number,
        temp: reading.temp as number,
      }));
  }
  return cleaned;
}

export function latestRoomTemp(data: TemperatureResponse, room: string): number | null {
  const readings = data[room] || [];
  const latest = readings.at(-1);
  return latest?.temp ?? null;
}
