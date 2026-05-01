"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.roundMiles = exports.milesToKm = exports.kmToMiles = exports.haversineDistanceKm = void 0;
const EARTH_RADIUS_KM = 6_371;
const toRadians = (value) => (value * Math.PI) / 180;
const haversineDistanceKm = (from, to) => {
    const latitudeDelta = toRadians(to.latitude - from.latitude);
    const longitudeDelta = toRadians(to.longitude - from.longitude);
    const fromLatitude = toRadians(from.latitude);
    const toLatitude = toRadians(to.latitude);
    const a = Math.sin(latitudeDelta / 2) * Math.sin(latitudeDelta / 2) +
        Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) * Math.sin(longitudeDelta / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return EARTH_RADIUS_KM * c;
};
exports.haversineDistanceKm = haversineDistanceKm;
const kmToMiles = (kilometres) => kilometres * 0.621371;
exports.kmToMiles = kmToMiles;
const milesToKm = (miles) => miles / 0.621371;
exports.milesToKm = milesToKm;
const roundMiles = (miles) => Math.round(miles * 100) / 100;
exports.roundMiles = roundMiles;
