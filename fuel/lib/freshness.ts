import {
  FRESHNESS_AGING_MAX_MINUTES,
  FRESHNESS_FRESH_MAX_MINUTES
} from "./constants";

import type { FreshnessBand } from "./types";

export const computeFreshness = (
  lastUpdatedAt: string | null,
  referenceTime = new Date()
): {
  freshnessBand: FreshnessBand;
  freshnessMinutes: number | null;
} => {
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

  if (freshnessMinutes <= FRESHNESS_FRESH_MAX_MINUTES) {
    return {
      freshnessBand: "fresh",
      freshnessMinutes
    };
  }

  if (freshnessMinutes <= FRESHNESS_AGING_MAX_MINUTES) {
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
