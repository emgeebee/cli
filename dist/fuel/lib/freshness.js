"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeFreshness = void 0;
const constants_1 = require("./constants");
const computeFreshness = (lastUpdatedAt, referenceTime = new Date()) => {
    if (!lastUpdatedAt) {
        return {
            freshnessBand: "unknown",
            freshnessMinutes: null
        };
    }
    const lastUpdatedDate = new Date(lastUpdatedAt);
    if (Number.isNaN(lastUpdatedDate.valueOf())) {
        return {
            freshnessBand: "unknown",
            freshnessMinutes: null
        };
    }
    const freshnessMinutes = Math.max(0, Math.round((referenceTime.valueOf() - lastUpdatedDate.valueOf()) / 60_000));
    if (freshnessMinutes <= constants_1.FRESHNESS_FRESH_MAX_MINUTES) {
        return {
            freshnessBand: "fresh",
            freshnessMinutes
        };
    }
    if (freshnessMinutes <= constants_1.FRESHNESS_AGING_MAX_MINUTES) {
        return {
            freshnessBand: "aging",
            freshnessMinutes
        };
    }
    return {
        freshnessBand: "stale",
        freshnessMinutes
    };
};
exports.computeFreshness = computeFreshness;
