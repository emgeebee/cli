import { createAppError } from "./errors";

import type { Coordinates } from "./types";

const COORDINATE_PATTERN =
  /^\s*(?<latitude>-?(?:\d+(?:\.\d+)?))\s*,\s*(?<longitude>-?(?:\d+(?:\.\d+)?))\s*$/;
const POSTCODE_PATTERN =
  /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;

export type ParsedLocationInput =
  | {
      kind: "coordinates";
      coordinates: Coordinates;
    }
  | {
      kind: "postcode";
      postcode: string;
    };

export const parseLocationInput = (input: string): ParsedLocationInput => {
  const trimmedInput = input.trim();
  const coordinateMatch = trimmedInput.match(COORDINATE_PATTERN);

  if (coordinateMatch?.groups) {
    const latitudeValue = coordinateMatch.groups["latitude"];
    const longitudeValue = coordinateMatch.groups["longitude"];

    if (!latitudeValue || !longitudeValue) {
      throw createAppError(
        "INVALID_INPUT",
        'Expected a UK postcode like "SE1 9SG" or coordinates like "51.501,-0.141".'
      );
    }

    const latitude = Number.parseFloat(latitudeValue);
    const longitude = Number.parseFloat(longitudeValue);

    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      throw createAppError("INVALID_INPUT", `Latitude "${latitudeValue}" is out of range.`);
    }

    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      throw createAppError("INVALID_INPUT", `Longitude "${longitudeValue}" is out of range.`);
    }

    return {
      coordinates: {
        latitude,
        longitude
      },
      kind: "coordinates"
    };
  }

  if (POSTCODE_PATTERN.test(trimmedInput)) {
    return {
      kind: "postcode",
      postcode: normalizePostcode(trimmedInput)
    };
  }

  throw createAppError(
    "INVALID_INPUT",
    'Expected a UK postcode like "SE1 9SG" or coordinates like "51.501,-0.141".'
  );
};

export const normalizePostcode = (postcode: string): string => {
  const compactPostcode = postcode.trim().replaceAll(/\s+/g, "").toUpperCase();

  if (compactPostcode.length <= 3) {
    return compactPostcode;
  }

  return `${compactPostcode.slice(0, -3)} ${compactPostcode.slice(-3)}`;
};
