import { MAX_LIMIT, SUPPORTED_FUEL_TYPES } from "./constants";
import { createAppError } from "./errors";

import type { FuelType, NearSort } from "./types";

const RADIUS_PATTERN = /^(?<value>\d+(?:\.\d+)?)(?<unit>mi|mile|miles|km)?$/i;

export const parseLimit = (value: string): number => {
  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0 || parsedValue > MAX_LIMIT) {
    throw createAppError("INVALID_INPUT", `Expected --limit to be a positive integer no greater than ${MAX_LIMIT}.`);
  }

  return parsedValue;
};

export const parseRadiusMiles = (value: string): number => {
  const trimmedValue = value.trim().toLowerCase();
  const match = trimmedValue.match(RADIUS_PATTERN);

  if (!match?.groups) {
    throw createAppError("INVALID_INPUT", 'Expected --radius like "5", "5mi", or "8km".');
  }

  const valuePart = match.groups["value"];

  if (!valuePart) {
    throw createAppError("INVALID_INPUT", 'Expected --radius like "5", "5mi", or "8km".');
  }

  const distanceValue = Number.parseFloat(valuePart);

  if (!Number.isFinite(distanceValue) || distanceValue <= 0) {
    throw createAppError("INVALID_INPUT", "Expected --radius to be a positive number.");
  }

  const unit = match.groups["unit"];

  if (!unit || unit === "mi" || unit === "mile" || unit === "miles") {
    return distanceValue;
  }

  return distanceValue * 0.621371;
};

export const parseFuelType = (value: string): FuelType => {
  const normalizedFuelType = value.trim().toUpperCase().replaceAll("-", "_");

  if (!SUPPORTED_FUEL_TYPES.includes(normalizedFuelType as FuelType)) {
    throw createAppError(
      "INVALID_INPUT",
      `Unsupported fuel type "${value}". Expected one of: ${SUPPORTED_FUEL_TYPES.join(", ")}.`
    );
  }

  return normalizedFuelType as FuelType;
};

export const parseNearSort = (value: string): NearSort => {
  const normalizedSort = value.trim().toLowerCase();

  if (normalizedSort === "best" || normalizedSort === "price" || normalizedSort === "distance" || normalizedSort === "freshest") {
    return normalizedSort;
  }

  throw createAppError('INVALID_INPUT', 'Expected --sort to be one of: best, price, distance, freshest.');
};
