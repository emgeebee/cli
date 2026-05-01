"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFuelService = void 0;
const constants_1 = require("./constants");
const dataQuality_1 = require("./dataQuality");
const distance_1 = require("./distance");
const errors_1 = require("./errors");
const freshness_1 = require("./freshness");
const location_1 = require("./location");
const ranking_1 = require("./ranking");
const dedupeStationListQueries = (queries) => {
    const seenSearchKeys = new Set();
    const deduped = [];
    for (const entry of queries) {
        const key = entry.searchText.trim().toLowerCase();
        if (seenSearchKeys.has(key)) {
            continue;
        }
        seenSearchKeys.add(key);
        deduped.push(entry);
    }
    return deduped;
};
const createStationCandidate = (station) => ({
    addressLine1: station.location.addressLine1,
    brandName: station.brandName,
    nodeId: station.nodeId,
    postcode: station.location.postcode,
    tradingName: station.tradingName
});
const toStationDetail = (station) => {
    const prices = Object.values(station.prices)
        .filter((price) => price !== undefined)
        .sort((left, right) => left.pencePerLitre - right.pencePerLitre)
        .map((price) => {
        const freshness = (0, freshness_1.computeFreshness)(price.lastUpdatedAt);
        return {
            ...price,
            freshnessBand: freshness.freshnessBand,
            freshnessMinutes: freshness.freshnessMinutes
        };
    });
    const latestPriceTimestamp = prices
        .map((price) => price.lastUpdatedAt)
        .filter((timestamp) => Boolean(timestamp))
        .sort()
        .at(-1) ?? null;
    return {
        amenities: station.amenities,
        availableFuelTypes: station.availableFuelTypes,
        brandName: station.brandName,
        isMotorwayServiceStation: station.isMotorwayServiceStation,
        isSupermarketServiceStation: station.isSupermarketServiceStation,
        lastUpdatedAt: latestPriceTimestamp,
        location: station.location,
        nodeId: station.nodeId,
        openingTimes: station.openingTimes,
        permanentClosure: station.permanentClosure,
        permanentClosureDate: station.permanentClosureDate,
        prices,
        publicPhoneNumber: station.publicPhoneNumber,
        qualityFlags: station.qualityFlags,
        temporaryClosure: station.temporaryClosure,
        tradingName: station.tradingName
    };
};
const toNearStationResult = (station, fuelType, distanceMiles) => {
    const selectedPrice = station.prices[fuelType];
    if (!selectedPrice) {
        return undefined;
    }
    const freshness = (0, freshness_1.computeFreshness)(selectedPrice.lastUpdatedAt);
    return {
        addressLine1: station.location.addressLine1,
        addressLine2: station.location.addressLine2,
        amenities: station.amenities,
        availableFuelTypes: station.availableFuelTypes,
        brandName: station.brandName,
        city: station.location.city,
        country: station.location.country,
        county: station.location.county,
        distanceMiles: (0, distance_1.roundMiles)(distanceMiles),
        freshnessBand: freshness.freshnessBand,
        freshnessMinutes: freshness.freshnessMinutes,
        isMotorwayServiceStation: station.isMotorwayServiceStation,
        isSupermarketServiceStation: station.isSupermarketServiceStation,
        lastUpdatedAt: selectedPrice.lastUpdatedAt,
        nodeId: station.nodeId,
        postcode: station.location.postcode,
        qualityFlags: station.qualityFlags,
        selectedFuelType: selectedPrice.fuelType,
        selectedPricePencePerLitre: selectedPrice.pencePerLitre,
        tradingName: station.tradingName
    };
};
const isStationClosed = (station) => station.permanentClosure || station.temporaryClosure;
const isLikelyTestStation = (station) => (0, dataQuality_1.hasStationQualityFlag)(station.qualityFlags, "likely_test_station");
const resolveLocation = async (postcodesClient, locationInput) => {
    const parsedLocationInput = (0, location_1.parseLocationInput)(locationInput);
    if (parsedLocationInput.kind === "coordinates") {
        return {
            displayValue: `${parsedLocationInput.coordinates.latitude},${parsedLocationInput.coordinates.longitude}`,
            kind: "coordinates",
            latitude: parsedLocationInput.coordinates.latitude,
            longitude: parsedLocationInput.coordinates.longitude
        };
    }
    const postcodeLookup = await postcodesClient.lookupPostcode(parsedLocationInput.postcode);
    return {
        displayValue: postcodeLookup.postcode,
        kind: "postcode",
        latitude: postcodeLookup.latitude,
        longitude: postcodeLookup.longitude,
        postcode: postcodeLookup.postcode
    };
};
const getStationMatches = (stations, query) => {
    const normalizedQuery = query.trim().toLowerCase();
    const normalizedBracketNameQuery = normalizedQuery.replace(/\s+\[[^\]]+\]$/, "").trim();
    const exactIdMatch = stations.find((station) => station.nodeId.toLowerCase() === normalizedQuery);
    if (exactIdMatch) {
        return [exactIdMatch];
    }
    const exactFieldMatches = stations.filter((station) => [
        station.tradingName,
        station.brandName,
        station.location.postcode,
        station.location.addressLine1
    ]
        .map((value) => value.toLowerCase())
        .includes(normalizedQuery));
    if (exactFieldMatches.length > 0) {
        return exactFieldMatches;
    }
    const exactDisplayNameMatches = stations.filter((station) => {
        const displayName = `${station.tradingName}${station.brandName !== station.tradingName ? ` [${station.brandName}]` : ""}`;
        return displayName.toLowerCase() === normalizedQuery;
    });
    if (exactDisplayNameMatches.length > 0) {
        return exactDisplayNameMatches;
    }
    const normalizedTradingNameMatches = stations.filter((station) => station.tradingName.toLowerCase() === normalizedBracketNameQuery);
    if (normalizedTradingNameMatches.length > 0) {
        return normalizedTradingNameMatches;
    }
    return stations
        .filter((station) => station.searchText.includes(normalizedQuery) ||
        (normalizedBracketNameQuery.length > 0 && station.searchText.includes(normalizedBracketNameQuery)))
        .sort((left, right) => left.tradingName.localeCompare(right.tradingName, "en-GB"));
};
const createFuelService = (datasetStore, postcodesClient) => ({
    findStation: async (query, options) => {
        if (query.trim().length === 0) {
            throw (0, errors_1.createAppError)("INVALID_INPUT", "Expected station query to be a non-empty node ID or text search.");
        }
        const dataset = await datasetStore.getDataset({
            refresh: options.refresh
        });
        const matches = getStationMatches(dataset.stations, query);
        if (matches.length === 0) {
            throw (0, errors_1.createAppError)("NOT_FOUND", `No station matched "${query}".`);
        }
        if (matches.length > 1) {
            throw (0, errors_1.createAmbiguousQueryError)(query, matches.slice(0, constants_1.DEFAULT_LIMIT).map((station) => createStationCandidate(station)));
        }
        const matchedStation = matches[0];
        if (!matchedStation) {
            throw (0, errors_1.createAppError)("NOT_FOUND", `No station matched "${query}".`);
        }
        const station = toStationDetail(matchedStation);
        return {
            input: {
                query,
                refresh: options.refresh
            },
            quality: (0, dataQuality_1.buildStationQualitySummary)(station),
            station
        };
    },
    findStationList: async (listName, options) => {
        const preparedQueries = dedupeStationListQueries(options.queries);
        if (preparedQueries.length === 0) {
            throw (0, errors_1.createAppError)("INVALID_INPUT", `Configured list "${listName}" is empty.`);
        }
        const dataset = await datasetStore.getDataset({
            refresh: options.refresh
        });
        const matchedStations = preparedQueries.map((queryEntry) => {
            const matches = getStationMatches(dataset.stations, queryEntry.searchText);
            if (matches.length === 0) {
                throw (0, errors_1.createAppError)("NOT_FOUND", `No station matched "${queryEntry.searchText}" from list "${listName}".`);
            }
            if (matches.length > 1) {
                throw (0, errors_1.createAmbiguousQueryError)(queryEntry.searchText, matches.slice(0, constants_1.DEFAULT_LIMIT).map((station) => createStationCandidate(station)));
            }
            const matchedStation = matches[0];
            if (!matchedStation) {
                throw (0, errors_1.createAppError)("NOT_FOUND", `No station matched "${queryEntry.searchText}" from list "${listName}".`);
            }
            const stationDetail = toStationDetail(matchedStation);
            const selectedPrice = stationDetail.prices.find((price) => price.fuelType === options.fuelType);
            if (!selectedPrice) {
                throw (0, errors_1.createAppError)("NOT_FOUND", `Station "${stationDetail.tradingName}" from list "${listName}" has no ${options.fuelType} price.`);
            }
            const freshness = (0, freshness_1.computeFreshness)(selectedPrice.lastUpdatedAt);
            return {
                availableFuelTypes: stationDetail.availableFuelTypes,
                brandName: stationDetail.brandName,
                ...(queryEntry.display ? { display: queryEntry.display } : {}),
                freshnessBand: freshness.freshnessBand,
                freshnessMinutes: freshness.freshnessMinutes,
                lastUpdatedAt: selectedPrice.lastUpdatedAt,
                nodeId: stationDetail.nodeId,
                postcode: stationDetail.location.postcode,
                qualityFlags: stationDetail.qualityFlags,
                selectedFuelType: selectedPrice.fuelType,
                selectedPricePencePerLitre: selectedPrice.pencePerLitre,
                sortOrder: queryEntry.sort ?? Number.POSITIVE_INFINITY,
                tradingName: stationDetail.tradingName
            };
        });
        const sortedStations = [...matchedStations].sort((left, right) => {
            if (left.sortOrder !== right.sortOrder) {
                return left.sortOrder - right.sortOrder;
            }
            const nameLeft = left.display ?? left.tradingName;
            const nameRight = right.display ?? right.tradingName;
            return nameLeft.localeCompare(nameRight, "en-GB");
        });
        return {
            input: {
                fuelType: options.fuelType,
                list: listName,
                refresh: options.refresh
            },
            stations: sortedStations
        };
    },
    findStationsNear: async (location, options) => {
        const resolvedLocation = await resolveLocation(postcodesClient, location);
        const dataset = await datasetStore.getDataset({
            refresh: options.refresh
        });
        const stationsWithinRadius = dataset.stations
            .filter((station) => !isStationClosed(station))
            .map((station) => {
            const distanceMiles = (0, distance_1.kmToMiles)((0, distance_1.haversineDistanceKm)(resolvedLocation, {
                latitude: station.location.latitude,
                longitude: station.location.longitude
            }));
            return toNearStationResult(station, options.fuelType, distanceMiles);
        })
            .filter((station) => station !== undefined)
            .filter((station) => station.distanceMiles <= options.radiusMiles);
        const nonTestStations = stationsWithinRadius.filter((station) => !isLikelyTestStation(station));
        const includedStations = nonTestStations.length > 0 ? nonTestStations : stationsWithinRadius;
        const excludedLikelyTestStations = nonTestStations.length > 0 ? stationsWithinRadius.length - nonTestStations.length : 0;
        const sortedStations = (0, ranking_1.sortNearResults)(includedStations, options.sort).slice(0, options.limit);
        if (sortedStations.length === 0) {
            throw (0, errors_1.createAppError)("NOT_FOUND", `No ${options.fuelType} stations were found within ${options.radiusMiles} miles of ${resolvedLocation.displayValue}.`);
        }
        return {
            input: {
                fuelType: options.fuelType,
                limit: options.limit,
                location,
                radiusMiles: options.radiusMiles,
                refresh: options.refresh,
                sort: options.sort
            },
            quality: (0, dataQuality_1.buildNearQualitySummary)(sortedStations, excludedLikelyTestStations),
            resolvedLocation,
            stations: sortedStations
        };
    }
});
exports.createFuelService = createFuelService;
