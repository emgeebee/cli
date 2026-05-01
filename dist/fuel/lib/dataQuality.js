"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildStationQualitySummary = exports.buildNearQualitySummary = exports.getStationQualityPenalty = exports.getFreshnessPenalty = exports.hasStationQualityFlag = exports.getStationQualityFlags = void 0;
const constants_1 = require("./constants");
const LIKELY_TEST_NAME_TOKENS = new Set(["demo", "qa", "test"]);
const createFreshnessCounts = () => ({
    aging: 0,
    fresh: 0,
    stale: 0,
    unknown: 0
});
const createWarningAdvisory = (code, message) => ({
    code,
    message,
    severity: "warning"
});
const tokenizeStationName = (value) => value
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter((token) => token.length > 0);
const toStationNameTokens = (tradingName, brandName) => [...new Set([tradingName, brandName].flatMap((value) => tokenizeStationName(value)))];
const hasRecentPrice = (station) => station.prices.some((price) => price.freshnessBand === "fresh" || price.freshnessBand === "aging");
const countFreshnessBands = (stations) => stations.reduce((freshnessCounts, station) => ({
    ...freshnessCounts,
    [station.freshnessBand]: freshnessCounts[station.freshnessBand] + 1
}), createFreshnessCounts());
const getStationQualityFlags = (tradingName, brandName) => toStationNameTokens(tradingName, brandName).some((token) => LIKELY_TEST_NAME_TOKENS.has(token))
    ? ["likely_test_station"]
    : [];
exports.getStationQualityFlags = getStationQualityFlags;
const hasStationQualityFlag = (qualityFlags, expectedQualityFlag) => qualityFlags.includes(expectedQualityFlag);
exports.hasStationQualityFlag = hasStationQualityFlag;
const getFreshnessPenalty = (freshnessBand, freshnessMinutes) => {
    if (freshnessBand !== "stale" || freshnessMinutes === null) {
        return constants_1.FRESHNESS_PENALTIES[freshnessBand];
    }
    const staleHours = Math.max(0, (freshnessMinutes - constants_1.FRESHNESS_AGING_MAX_MINUTES) / 60);
    const additionalStalePenalty = Math.min(constants_1.MAX_STALE_FRESHNESS_PENALTY, staleHours * constants_1.STALE_FRESHNESS_PENALTY_PER_HOUR);
    return constants_1.FRESHNESS_PENALTIES.stale + additionalStalePenalty;
};
exports.getFreshnessPenalty = getFreshnessPenalty;
const getStationQualityPenalty = (qualityFlags) => (0, exports.hasStationQualityFlag)(qualityFlags, "likely_test_station") ? constants_1.LIKELY_TEST_STATION_PENALTY : 0;
exports.getStationQualityPenalty = getStationQualityPenalty;
const buildNearQualitySummary = (stations, excludedLikelyTestStations) => {
    const freshnessCounts = countFreshnessBands(stations);
    const staleOrUnknownResults = freshnessCounts.stale + freshnessCounts.unknown;
    const advisories = [
        ...(excludedLikelyTestStations > 0
            ? [
                createWarningAdvisory("LIKELY_TEST_STATIONS_EXCLUDED", `Excluded ${excludedLikelyTestStations} likely test/demo station${excludedLikelyTestStations === 1 ? "" : "s"} from nearby results.`)
            ]
            : []),
        ...(stations.length > 0 && staleOrUnknownResults === stations.length
            ? [
                createWarningAdvisory("ALL_RESULTS_STALE_OR_UNKNOWN", "All returned prices are stale or missing timestamps. Treat the ranking as approximate.")
            ]
            : []),
        ...(stations.length > 0 && staleOrUnknownResults < stations.length && staleOrUnknownResults * 2 > stations.length
            ? [
                createWarningAdvisory("MOST_RESULTS_STALE_OR_UNKNOWN", "Most returned prices are stale or missing timestamps. Prefer the freshest options when the price gap is small.")
            ]
            : [])
    ];
    return {
        advisories,
        excludedLikelyTestStations,
        freshnessCounts
    };
};
exports.buildNearQualitySummary = buildNearQualitySummary;
const buildStationQualitySummary = (station) => ({
    advisories: [
        ...((0, exports.hasStationQualityFlag)(station.qualityFlags, "likely_test_station")
            ? [createWarningAdvisory("LIKELY_TEST_STATION", "This station looks like a test/demo forecourt entry.")]
            : []),
        ...(station.prices.length > 0 && !hasRecentPrice(station)
            ? [
                createWarningAdvisory("ALL_PRICES_STALE_OR_UNKNOWN", "All listed prices are stale or missing timestamps. Treat them as low-confidence.")
            ]
            : [])
    ]
});
exports.buildStationQualitySummary = buildStationQualitySummary;
