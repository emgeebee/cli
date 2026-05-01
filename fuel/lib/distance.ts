import type { Coordinates } from "./types";

const EARTH_RADIUS_KM = 6_371;

const toRadians = (value: number): number => (value * Math.PI) / 180;

export const haversineDistanceKm = (from: Coordinates, to: Coordinates): number => {
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);
  const a =
    Math.sin(latitudeDelta / 2) * Math.sin(latitudeDelta / 2) +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) * Math.sin(longitudeDelta / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
};

export const kmToMiles = (kilometres: number): number => kilometres * 0.621371;

export const milesToKm = (miles: number): number => miles / 0.621371;

export const roundMiles = (miles: number): number => Math.round(miles * 100) / 100;
