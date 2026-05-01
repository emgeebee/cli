"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sortNearResults = exports.getBestScore = void 0;
const dataQuality_1 = require("./dataQuality");
const toFreshnessRank = (band) => {
    if (band === "fresh") {
        return 0;
    }
    if (band === "aging") {
        return 1;
    }
    if (band === "stale") {
        return 2;
    }
    return 3;
};
const compareStrings = (left, right) => left.localeCompare(right, "en-GB");
const compareNearResults = (left, right) => {
    if (left.distanceMiles !== right.distanceMiles) {
        return left.distanceMiles - right.distanceMiles;
    }
    if (left.freshnessBand !== right.freshnessBand) {
        return toFreshnessRank(left.freshnessBand) - toFreshnessRank(right.freshnessBand);
    }
    const qualityPenaltyDifference = (0, dataQuality_1.getStationQualityPenalty)(left.qualityFlags) - (0, dataQuality_1.getStationQualityPenalty)(right.qualityFlags);
    if (qualityPenaltyDifference !== 0) {
        return qualityPenaltyDifference;
    }
    return compareStrings(left.tradingName, right.tradingName);
};
const getBestScore = (station) => station.selectedPricePencePerLitre +
    station.distanceMiles * 1.5 +
    (0, dataQuality_1.getFreshnessPenalty)(station.freshnessBand, station.freshnessMinutes) +
    (0, dataQuality_1.getStationQualityPenalty)(station.qualityFlags);
exports.getBestScore = getBestScore;
const sortNearResults = (stations, sort) => [...stations].sort((left, right) => {
    if (sort === "price") {
        if (left.selectedPricePencePerLitre !== right.selectedPricePencePerLitre) {
            return left.selectedPricePencePerLitre - right.selectedPricePencePerLitre;
        }
        return compareNearResults(left, right);
    }
    if (sort === "distance") {
        if (left.distanceMiles !== right.distanceMiles) {
            return left.distanceMiles - right.distanceMiles;
        }
        if (left.selectedPricePencePerLitre !== right.selectedPricePencePerLitre) {
            return left.selectedPricePencePerLitre - right.selectedPricePencePerLitre;
        }
        return compareNearResults(left, right);
    }
    if (sort === "freshest") {
        const freshnessDifference = toFreshnessRank(left.freshnessBand) - toFreshnessRank(right.freshnessBand);
        if (freshnessDifference !== 0) {
            return freshnessDifference;
        }
        if (left.freshnessMinutes !== null && right.freshnessMinutes !== null && left.freshnessMinutes !== right.freshnessMinutes) {
            return left.freshnessMinutes - right.freshnessMinutes;
        }
        if (left.selectedPricePencePerLitre !== right.selectedPricePencePerLitre) {
            return left.selectedPricePencePerLitre - right.selectedPricePencePerLitre;
        }
        return compareNearResults(left, right);
    }
    const bestScoreDifference = (0, exports.getBestScore)(left) - (0, exports.getBestScore)(right);
    if (bestScoreDifference !== 0) {
        return bestScoreDifference;
    }
    if (left.selectedPricePencePerLitre !== right.selectedPricePencePerLitre) {
        return left.selectedPricePencePerLitre - right.selectedPricePencePerLitre;
    }
    return compareNearResults(left, right);
});
exports.sortNearResults = sortNearResults;
