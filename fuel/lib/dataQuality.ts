import {
  FRESHNESS_AGING_MAX_MINUTES,
  FRESHNESS_PENALTIES,
  LIKELY_TEST_STATION_PENALTY,
  MAX_STALE_FRESHNESS_PENALTY,
  STALE_FRESHNESS_PENALTY_PER_HOUR
} from "./constants";

import type {
  Advisory,
  FreshnessBand,
  FreshnessCounts,
  NearQualitySummary,
  NearStationResult,
  StationDetail,
  StationQualityFlag,
  StationQualitySummary
} from "./types";

const LIKELY_TEST_NAME_TOKENS = new Set(["demo", "qa", "test"]);

const createFreshnessCounts = (): FreshnessCounts => ({
  aging: 0,
  fresh: 0,
  stale: 0,
  unknown: 0
});

const createWarningAdvisory = (code: Advisory["code"], message: string): Advisory => ({
  code,
  message,
  severity: "warning"
});

const tokenizeStationName = (value: string): string[] =>
  value
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter((token) => token.length > 0);

const toStationNameTokens = (tradingName: string, brandName: string): string[] =>
  [...new Set([tradingName, brandName].flatMap((value) => tokenizeStationName(value)))];

const hasRecentPrice = (station: StationDetail): boolean =>
  station.prices.some((price) => price.freshnessBand === "fresh" || price.freshnessBand === "aging");

const countFreshnessBands = (
  stations: Pick<NearStationResult, "freshnessBand">[]
): FreshnessCounts =>
  stations.reduce<FreshnessCounts>(
    (freshnessCounts, station) => ({
      ...freshnessCounts,
      [station.freshnessBand]: freshnessCounts[station.freshnessBand] + 1
    }),
    createFreshnessCounts()
  );

export const getStationQualityFlags = (tradingName: string, brandName: string): StationQualityFlag[] =>
  toStationNameTokens(tradingName, brandName).some((token) => LIKELY_TEST_NAME_TOKENS.has(token))
    ? ["likely_test_station"]
    : [];

export const hasStationQualityFlag = (
  qualityFlags: StationQualityFlag[],
  expectedQualityFlag: StationQualityFlag
): boolean => qualityFlags.includes(expectedQualityFlag);

export const getFreshnessPenalty = (
  freshnessBand: FreshnessBand,
  freshnessMinutes: number | null
): number => {
  if (freshnessBand !== "stale" || freshnessMinutes === null) {
    return FRESHNESS_PENALTIES[freshnessBand];
  }

  const staleHours = Math.max(0, (freshnessMinutes - FRESHNESS_AGING_MAX_MINUTES) / 60);
  const additionalStalePenalty = Math.min(MAX_STALE_FRESHNESS_PENALTY, staleHours * STALE_FRESHNESS_PENALTY_PER_HOUR);

  return FRESHNESS_PENALTIES.stale + additionalStalePenalty;
};

export const getStationQualityPenalty = (qualityFlags: StationQualityFlag[]): number =>
  hasStationQualityFlag(qualityFlags, "likely_test_station") ? LIKELY_TEST_STATION_PENALTY : 0;

export const buildNearQualitySummary = (
  stations: NearStationResult[],
  excludedLikelyTestStations: number
): NearQualitySummary => {
  const freshnessCounts = countFreshnessBands(stations);
  const staleOrUnknownResults = freshnessCounts.stale + freshnessCounts.unknown;
  const advisories = [
    ...(excludedLikelyTestStations > 0
      ? [
          createWarningAdvisory(
            "LIKELY_TEST_STATIONS_EXCLUDED",
            `Excluded ${excludedLikelyTestStations} likely test/demo station${excludedLikelyTestStations === 1 ? "" : "s"} from nearby results.`
          )
        ]
      : []),
    ...(stations.length > 0 && staleOrUnknownResults === stations.length
      ? [
          createWarningAdvisory(
            "ALL_RESULTS_STALE_OR_UNKNOWN",
            "All returned prices are stale or missing timestamps. Treat the ranking as approximate."
          )
        ]
      : []),
    ...(stations.length > 0 && staleOrUnknownResults < stations.length && staleOrUnknownResults * 2 > stations.length
      ? [
          createWarningAdvisory(
            "MOST_RESULTS_STALE_OR_UNKNOWN",
            "Most returned prices are stale or missing timestamps. Prefer the freshest options when the price gap is small."
          )
        ]
      : [])
  ];

  return {
    advisories,
    excludedLikelyTestStations,
    freshnessCounts
  };
};

export const buildStationQualitySummary = (station: StationDetail): StationQualitySummary => ({
  advisories: [
    ...(hasStationQualityFlag(station.qualityFlags, "likely_test_station")
      ? [createWarningAdvisory("LIKELY_TEST_STATION", "This station looks like a test/demo forecourt entry.")]
      : []),
    ...(station.prices.length > 0 && !hasRecentPrice(station)
      ? [
          createWarningAdvisory(
            "ALL_PRICES_STALE_OR_UNKNOWN",
            "All listed prices are stale or missing timestamps. Treat them as low-confidence."
          )
        ]
      : [])
  ]
});
