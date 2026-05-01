"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseNearSort = exports.parseFuelType = exports.parseRadiusMiles = exports.parseLimit = void 0;
const constants_1 = require("./constants");
const errors_1 = require("./errors");
const RADIUS_PATTERN = /^(?<value>\d+(?:\.\d+)?)(?<unit>mi|mile|miles|km)?$/i;
const parseLimit = (value) => {
    const parsedValue = Number.parseInt(value, 10);
    if (!Number.isInteger(parsedValue) || parsedValue <= 0 || parsedValue > constants_1.MAX_LIMIT) {
        throw (0, errors_1.createAppError)("INVALID_INPUT", `Expected --limit to be a positive integer no greater than ${constants_1.MAX_LIMIT}.`);
    }
    return parsedValue;
};
exports.parseLimit = parseLimit;
const parseRadiusMiles = (value) => {
    const trimmedValue = value.trim().toLowerCase();
    const match = trimmedValue.match(RADIUS_PATTERN);
    if (!match?.groups) {
        throw (0, errors_1.createAppError)("INVALID_INPUT", 'Expected --radius like "5", "5mi", or "8km".');
    }
    const valuePart = match.groups["value"];
    if (!valuePart) {
        throw (0, errors_1.createAppError)("INVALID_INPUT", 'Expected --radius like "5", "5mi", or "8km".');
    }
    const distanceValue = Number.parseFloat(valuePart);
    if (!Number.isFinite(distanceValue) || distanceValue <= 0) {
        throw (0, errors_1.createAppError)("INVALID_INPUT", "Expected --radius to be a positive number.");
    }
    const unit = match.groups["unit"];
    if (!unit || unit === "mi" || unit === "mile" || unit === "miles") {
        return distanceValue;
    }
    return distanceValue * 0.621371;
};
exports.parseRadiusMiles = parseRadiusMiles;
const parseFuelType = (value) => {
    const normalizedFuelType = value.trim().toUpperCase().replaceAll("-", "_");
    if (!constants_1.SUPPORTED_FUEL_TYPES.includes(normalizedFuelType)) {
        throw (0, errors_1.createAppError)("INVALID_INPUT", `Unsupported fuel type "${value}". Expected one of: ${constants_1.SUPPORTED_FUEL_TYPES.join(", ")}.`);
    }
    return normalizedFuelType;
};
exports.parseFuelType = parseFuelType;
const parseNearSort = (value) => {
    const normalizedSort = value.trim().toLowerCase();
    if (normalizedSort === "best" || normalizedSort === "price" || normalizedSort === "distance" || normalizedSort === "freshest") {
        return normalizedSort;
    }
    throw (0, errors_1.createAppError)('INVALID_INPUT', 'Expected --sort to be one of: best, price, distance, freshest.');
};
exports.parseNearSort = parseNearSort;
