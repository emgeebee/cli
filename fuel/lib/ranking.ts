import { getFreshnessPenalty, getStationQualityPenalty } from "./dataQuality";

import type { FreshnessBand, NearSort, NearStationResult } from "./types";

const toFreshnessRank = (band: FreshnessBand): number => {
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

const compareStrings = (left: string, right: string): number => left.localeCompare(right, "en-GB");

const compareNearResults = (left: NearStationResult, right: NearStationResult): number => {
  if (left.distanceMiles !== right.distanceMiles) {
    return left.distanceMiles - right.distanceMiles;
  }

  if (left.freshnessBand !== right.freshnessBand) {
    return toFreshnessRank(left.freshnessBand) - toFreshnessRank(right.freshnessBand);
  }

  const qualityPenaltyDifference = getStationQualityPenalty(left.qualityFlags) - getStationQualityPenalty(right.qualityFlags);

  if (qualityPenaltyDifference !== 0) {
    return qualityPenaltyDifference;
  }

  return compareStrings(left.tradingName, right.tradingName);
};

export const getBestScore = (station: NearStationResult): number =>
  station.selectedPricePencePerLitre +
  station.distanceMiles * 1.5 +
  getFreshnessPenalty(station.freshnessBand, station.freshnessMinutes) +
  getStationQualityPenalty(station.qualityFlags);

export const sortNearResults = (stations: NearStationResult[], sort: NearSort): NearStationResult[] =>
  [...stations].sort((left, right) => {
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

    const bestScoreDifference = getBestScore(left) - getBestScore(right);

    if (bestScoreDifference !== 0) {
      return bestScoreDifference;
    }

    if (left.selectedPricePencePerLitre !== right.selectedPricePencePerLitre) {
      return left.selectedPricePencePerLitre - right.selectedPricePencePerLitre;
    }

    return compareNearResults(left, right);
  });
