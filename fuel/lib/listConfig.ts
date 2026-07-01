import { parseFuelType } from "./commandUtils";
import { createAppError } from "./errors";
import type { FuelType } from "./types";

export const STATIONS_API_URL = "http://api.emgeebee.buzz:1880/api/stations";

export type StationListEntry = {
  display?: string;
  /** Lower values appear first in list output. Omitted entries sort after those with `sort`. */
  sort?: number;
  searchText: string;
};

export type StationListDefinition = {
  fuel: FuelType;
  stations: StationListEntry[];
};

export type StationListsConfig = Record<string, StationListDefinition>;

export const loadStationListsConfig = async (): Promise<StationListsConfig> => {
  let response: Response;

  try {
    response = await fetch(STATIONS_API_URL, {
      headers: {
        Accept: "application/json"
      }
    });
  } catch {
    throw createAppError("UPSTREAM_API_ERROR", `Failed to reach stations API at ${STATIONS_API_URL}.`);
  }

  if (!response.ok) {
    throw createAppError("UPSTREAM_API_ERROR", `Stations API request failed (${response.status}).`);
  }

  let parsed: unknown;

  try {
    parsed = await response.json();
  } catch {
    throw createAppError("UPSTREAM_API_ERROR", "Stations API returned invalid JSON.");
  }

  return validateStationListsConfig(parsed, STATIONS_API_URL);
};

const validateStationListsConfig = (parsed: unknown, configPath: string): StationListsConfig => {
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw createAppError("INVALID_INPUT", `${configPath} must be a JSON object with named station lists.`);
  }

  const entries = Object.entries(parsed as Record<string, unknown>);
  const lists: StationListsConfig = {};

  for (const [listName, listValue] of entries) {
    if (typeof listValue !== "object" || listValue === null || Array.isArray(listValue)) {
      throw createAppError("INVALID_INPUT", `List "${listName}" must be an object with "fuel" and "stations" keys.`);
    }
    const listDefinition = listValue as Record<string, unknown>;
    const fuel = listDefinition["fuel"];
    const stations = listDefinition["stations"];

    if (typeof fuel !== "string" || fuel.trim().length === 0) {
      throw createAppError("INVALID_INPUT", `List "${listName}" must include a non-empty string "fuel".`);
    }

    if (!Array.isArray(stations)) {
      throw createAppError(
        "INVALID_INPUT",
        `List "${listName}" must include a "stations" array of station entries with "searchText" and optional "display".`
      );
    }

    const normalizedEntries = stations.map((value, index) => normalizeStationListEntry(listName, value, index));

    lists[listName] = {
      fuel: parseFuelType(fuel),
      stations: normalizedEntries
    };
  }

  return lists;
};

const normalizeStationListEntry = (listName: string, value: unknown, index: number): StationListEntry => {
  if (typeof value === "string") {
    if (value.trim().length === 0) {
      throw createAppError("INVALID_INPUT", `List "${listName}" contains an invalid entry at index ${index}.`);
    }

    return {
      searchText: value.trim()
    };
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw createAppError("INVALID_INPUT", `List "${listName}" entry ${index} must be a string or object.`);
  }

  const entry = value as Record<string, unknown>;
  const searchText = entry["searchText"];
  const display = entry["display"];
  const legacyDisplayText = entry["displayText"];
  const sortRaw = entry["sort"];

  if (typeof searchText !== "string" || searchText.trim().length === 0) {
    throw createAppError("INVALID_INPUT", `List "${listName}" entry ${index} must include non-empty "searchText".`);
  }

  if (display !== undefined && (typeof display !== "string" || display.trim().length === 0)) {
    throw createAppError(
      "INVALID_INPUT",
      `List "${listName}" entry ${index} has invalid "display"; omit it or provide a non-empty string.`
    );
  }

  if (legacyDisplayText !== undefined && (typeof legacyDisplayText !== "string" || legacyDisplayText.trim().length === 0)) {
    throw createAppError(
      "INVALID_INPUT",
      `List "${listName}" entry ${index} has invalid legacy "displayText"; omit it or provide a non-empty string.`
    );
  }

  const normalizedDisplay = typeof display === "string" ? display.trim() : undefined;
  const normalizedLegacyDisplay = typeof legacyDisplayText === "string" ? legacyDisplayText.trim() : undefined;

  let sort: number | undefined;

  if (sortRaw !== undefined) {
    if (typeof sortRaw !== "number" || !Number.isFinite(sortRaw)) {
      throw createAppError("INVALID_INPUT", `List "${listName}" entry ${index} "sort" must be a finite number.`);
    }

    sort = sortRaw;
  }

  return {
    ...(normalizedDisplay ? { display: normalizedDisplay } : normalizedLegacyDisplay ? { display: normalizedLegacyDisplay } : {}),
    ...(sort !== undefined ? { sort } : {}),
    searchText: searchText.trim()
  };
};
