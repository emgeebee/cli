"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatStationListText = exports.formatStationText = exports.formatNearText = void 0;
const colours_1 = require("./colours");
const constants_1 = require("./constants");
const dataQuality_1 = require("./dataQuality");
const freshness_1 = require("./freshness");
const formatDistance = (distanceMiles) => `${distanceMiles.toFixed(distanceMiles >= 10 ? 1 : 2)}mi`;
const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;
const formatRoundedUnitTowardZero = (value, unit) => {
    const truncatedToTenth = Math.trunc(value * 10) / 10;
    if (Math.abs(truncatedToTenth - Math.round(truncatedToTenth)) < 1e-9) {
        return `${Math.round(truncatedToTenth)}${unit}`;
    }
    return `${truncatedToTenth.toFixed(1)}${unit}`;
};
/** Renders elapsed time since last update using m, h, or d depending on scale. */
const formatAgeMinutes = (freshnessMinutes) => {
    if (freshnessMinutes < 90) {
        return `${freshnessMinutes}m`;
    }
    if (freshnessMinutes < MINUTES_PER_DAY) {
        return formatRoundedUnitTowardZero(freshnessMinutes / MINUTES_PER_HOUR, "h");
    }
    return formatRoundedUnitTowardZero(freshnessMinutes / MINUTES_PER_DAY, "d");
};
const formatFreshnessPlain = (freshnessBand, freshnessMinutes) => {
    if (freshnessBand === "unknown" || freshnessMinutes === null) {
        return "unknown";
    }
    const ageLabel = formatAgeMinutes(freshnessMinutes);
    if (freshnessBand === "fresh") {
        return ageLabel;
    }
    if (freshnessBand === "aging") {
        return `${ageLabel} aging`;
    }
    return `${ageLabel} stale`;
};
const STALE_SCORE_CAP_MINUTES = 7 * 24 * 60;
/** Cheapest 20% of rows (by rank) → green (1); most expensive 40% → red (10); middle band interpolates. */
const LIST_PRICE_GREEN_MAX_RANK_FRAC = 0.2;
const LIST_PRICE_RED_MIN_RANK_FRAC = 0.6;
const listPriceRankScoreByNodeId = (stations) => {
    const scoreByNodeId = new Map();
    const n = stations.length;
    if (n === 0) {
        return scoreByNodeId;
    }
    if (n === 1) {
        scoreByNodeId.set(stations[0]?.nodeId ?? "", 5.5);
        return scoreByNodeId;
    }
    const sorted = [...stations].sort((left, right) => {
        if (left.selectedPricePencePerLitre !== right.selectedPricePencePerLitre) {
            return left.selectedPricePencePerLitre - right.selectedPricePencePerLitre;
        }
        return left.nodeId.localeCompare(right.nodeId, "en-GB");
    });
    sorted.forEach((station, rank) => {
        const rankFrac = rank / (n - 1);
        let score;
        if (rankFrac <= LIST_PRICE_GREEN_MAX_RANK_FRAC) {
            score = 1;
        }
        else if (rankFrac >= LIST_PRICE_RED_MIN_RANK_FRAC) {
            score = 10;
        }
        else {
            score = 1 + ((rankFrac - LIST_PRICE_GREEN_MAX_RANK_FRAC) / (LIST_PRICE_RED_MIN_RANK_FRAC - LIST_PRICE_GREEN_MAX_RANK_FRAC)) * 9;
        }
        scoreByNodeId.set(station.nodeId, Math.min(10, Math.max(1, score)));
    });
    return scoreByNodeId;
};
const formatListPriceForDisplay = (pencePerLitre, score1to10, context) => {
    const label = `${pencePerLitre.toFixed(1)}p`;
    return (0, colours_1.wrapFreshnessScaleColour)(label, score1to10, context.colorEnabled);
};
const freshnessDisplayScore1To10 = (freshnessBand, freshnessMinutes) => {
    if (freshnessBand === "fresh") {
        const span = Math.max(1, constants_1.FRESHNESS_FRESH_MAX_MINUTES);
        const t = Math.min(1, freshnessMinutes / span);
        return Math.min(10, Math.max(1, 1 + t * 1.5));
    }
    if (freshnessBand === "aging") {
        const span = Math.max(1, constants_1.FRESHNESS_AGING_MAX_MINUTES - constants_1.FRESHNESS_FRESH_MAX_MINUTES);
        const t = Math.min(1, Math.max(0, (freshnessMinutes - constants_1.FRESHNESS_FRESH_MAX_MINUTES) / span));
        return Math.min(10, Math.max(1, 2.5 + t * 4.5));
    }
    const staleSpan = Math.max(1, STALE_SCORE_CAP_MINUTES - constants_1.FRESHNESS_AGING_MAX_MINUTES);
    const t = Math.min(1, Math.max(0, (freshnessMinutes - constants_1.FRESHNESS_AGING_MAX_MINUTES) / staleSpan));
    return Math.min(10, Math.max(1, 7 + t * 3));
};
const formatFreshnessForDisplay = (freshnessBand, freshnessMinutes, context) => {
    if (freshnessBand === "unknown" || freshnessMinutes === null) {
        return context.colorEnabled ? context.text.style.dim("unknown") : "unknown";
    }
    const plain = formatFreshnessPlain(freshnessBand, freshnessMinutes);
    const score = freshnessDisplayScore1To10(freshnessBand, freshnessMinutes);
    return (0, colours_1.wrapFreshnessScaleColour)(plain, score, context.colorEnabled);
};
const formatStationTradingDisplay = (tradingName, brandName) => `${tradingName}${brandName !== tradingName ? ` [${brandName}]` : ""}`;
const formatStationNameWithFreshnessScale = (namePlain, freshnessBand, freshnessMinutes, context) => {
    if (freshnessBand === "unknown" || freshnessMinutes === null) {
        return context.colorEnabled ? context.text.style.dim(namePlain) : namePlain;
    }
    return (0, colours_1.wrapFreshnessScaleColour)(namePlain, freshnessDisplayScore1To10(freshnessBand, freshnessMinutes), context.colorEnabled);
};
const formatAddress = (station) => [
    station.location.addressLine1,
    station.location.addressLine2,
    station.location.city,
    station.location.county,
    station.location.postcode
]
    .filter((value) => Boolean(value))
    .join(", ");
const formatOpeningLine = (label, open, close, is24Hours) => {
    if (is24Hours) {
        return `${label}: 24h`;
    }
    if (!open || !close) {
        return `${label}: unknown`;
    }
    return `${label}: ${open} - ${close}`;
};
const formatAdvisoryLines = (advisories, context) => advisories.map((advisory) => context.text.style.warning(`Warning: ${advisory.message}`));
const formatNearText = (data, context) => {
    const { style } = context.text;
    const bestStation = data.stations[0];
    if (!bestStation) {
        return "No stations found.";
    }
    const priceScoreByNodeId = listPriceRankScoreByNodeId(data.stations);
    const header = style.header(`Fuel near ${data.resolvedLocation.displayValue} (${data.input.fuelType}, ${data.input.radiusMiles}mi)`);
    const bestNamePlain = formatStationTradingDisplay(bestStation.tradingName, bestStation.brandName);
    const bestOverallLine = `Best overall: ${bestNamePlain} (${bestStation.postcode}) - ${formatListPriceForDisplay(bestStation.selectedPricePencePerLitre, priceScoreByNodeId.get(bestStation.nodeId) ?? 5.5, context)}, ${formatDistance(bestStation.distanceMiles)}, ${formatFreshnessPlain(bestStation.freshnessBand, bestStation.freshnessMinutes)}`;
    const advisoryLines = formatAdvisoryLines(data.quality.advisories, context);
    const rows = data.stations.map((station) => {
        const namePlain = formatStationTradingDisplay(station.tradingName, station.brandName);
        const left = `${namePlain} (${station.postcode})${(0, dataQuality_1.hasStationQualityFlag)(station.qualityFlags, "likely_test_station") ? ` ${style.warning("[likely test/demo]")}` : ""}`;
        const right = `${formatListPriceForDisplay(station.selectedPricePencePerLitre, priceScoreByNodeId.get(station.nodeId) ?? 5.5, context)}  ${formatDistance(station.distanceMiles)}  ${formatFreshnessPlain(station.freshnessBand, station.freshnessMinutes)}`;
        return context.text.joinAligned(left, right, context.terminalWidth);
    });
    return [header, bestOverallLine, ...(advisoryLines.length > 0 ? ["", ...advisoryLines] : []), "", ...rows].join("\n");
};
exports.formatNearText = formatNearText;
const formatStationText = (data, context) => {
    const { style } = context.text;
    const station = data.station;
    const advisoryLines = formatAdvisoryLines(data.quality.advisories, context);
    const priceLines = station.prices.map((price) => context.text.joinAligned(`${price.fuelType}  ${formatFreshnessForDisplay(price.freshnessBand, price.freshnessMinutes, context)}`, `${price.pencePerLitre.toFixed(1)}p`, context.terminalWidth));
    const openingLines = station.openingTimes
        ? [
            formatOpeningLine("Mon", station.openingTimes.usualDays.monday?.open ?? null, station.openingTimes.usualDays.monday?.close ?? null, station.openingTimes.usualDays.monday?.is24Hours ?? false),
            formatOpeningLine("Tue", station.openingTimes.usualDays.tuesday?.open ?? null, station.openingTimes.usualDays.tuesday?.close ?? null, station.openingTimes.usualDays.tuesday?.is24Hours ?? false),
            formatOpeningLine("Wed", station.openingTimes.usualDays.wednesday?.open ?? null, station.openingTimes.usualDays.wednesday?.close ?? null, station.openingTimes.usualDays.wednesday?.is24Hours ?? false),
            formatOpeningLine("Thu", station.openingTimes.usualDays.thursday?.open ?? null, station.openingTimes.usualDays.thursday?.close ?? null, station.openingTimes.usualDays.thursday?.is24Hours ?? false),
            formatOpeningLine("Fri", station.openingTimes.usualDays.friday?.open ?? null, station.openingTimes.usualDays.friday?.close ?? null, station.openingTimes.usualDays.friday?.is24Hours ?? false),
            formatOpeningLine("Sat", station.openingTimes.usualDays.saturday?.open ?? null, station.openingTimes.usualDays.saturday?.close ?? null, station.openingTimes.usualDays.saturday?.is24Hours ?? false),
            formatOpeningLine("Sun", station.openingTimes.usualDays.sunday?.open ?? null, station.openingTimes.usualDays.sunday?.close ?? null, station.openingTimes.usualDays.sunday?.is24Hours ?? false)
        ]
        : ["Opening times: unknown"];
    const titleFreshness = (0, freshness_1.computeFreshness)(station.lastUpdatedAt);
    const titleColored = formatStationNameWithFreshnessScale(station.tradingName, titleFreshness.freshnessBand, titleFreshness.freshnessMinutes, context);
    const details = [
        titleColored,
        station.brandName !== station.tradingName ? `Brand: ${station.brandName}` : undefined,
        `Node ID: ${station.nodeId}`,
        `Postcode: ${station.location.postcode}`,
        `Address: ${formatAddress(station)}`,
        station.publicPhoneNumber ? `Phone: ${station.publicPhoneNumber}` : undefined,
        `Fuel types: ${station.availableFuelTypes.join(", ")}`,
        `Amenities: ${station.amenities.length > 0 ? station.amenities.join(", ") : "none listed"}`,
        station.temporaryClosure ? style.warning("Temporarily closed") : undefined,
        station.permanentClosure ? style.danger("Permanently closed") : undefined,
        ...advisoryLines,
        "",
        style.bold("Prices"),
        ...priceLines,
        "",
        style.bold("Opening hours"),
        ...openingLines
    ].filter((value) => value !== undefined);
    return details.join("\n");
};
exports.formatStationText = formatStationText;
const formatStationListText = (data, context) => {
    const { style } = context.text;
    if (data.stations.length === 0) {
        return "No stations found.";
    }
    const priceScoreByNodeId = listPriceRankScoreByNodeId(data.stations);
    const header = style.header(`Fuel list ${data.input.list} (${data.input.fuelType})`);
    const rows = data.stations.map((station) => {
        const stationNamePlain = station.display ?? formatStationTradingDisplay(station.tradingName, station.brandName);
        const left = `${stationNamePlain} (${station.postcode})${(0, dataQuality_1.hasStationQualityFlag)(station.qualityFlags, "likely_test_station") ? ` ${style.warning("[likely test/demo]")}` : ""}`;
        const right = `${formatListPriceForDisplay(station.selectedPricePencePerLitre, priceScoreByNodeId.get(station.nodeId) ?? 5.5, context)}  ${formatFreshnessPlain(station.freshnessBand, station.freshnessMinutes)}`;
        return context.text.joinAligned(left, right, context.terminalWidth);
    });
    return [header, "", ...rows].join("\n");
};
exports.formatStationListText = formatStationListText;
