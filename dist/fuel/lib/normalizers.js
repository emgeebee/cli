"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildIndexedStations = void 0;
const constants_1 = require("./constants");
const dataQuality_1 = require("./dataQuality");
const normalizeBoolean = (value) => value === true;
const normalizeNullableString = (value) => {
    const normalizedValue = value?.trim();
    return normalizedValue ? normalizedValue : null;
};
const normalizeFuelType = (fuelType) => {
    const normalizedFuelType = fuelType.trim().toUpperCase().replaceAll("-", "_");
    if (normalizedFuelType === "B7_STANDARD" || normalizedFuelType === "B7_STANDARD_DIESEL") {
        return "B7_STANDARD";
    }
    if (normalizedFuelType === "B7_PREMIUM") {
        return "B7_PREMIUM";
    }
    if (constants_1.SUPPORTED_FUEL_TYPES.includes(normalizedFuelType)) {
        return normalizedFuelType;
    }
    return undefined;
};
const normalizePhoneNumber = (value) => value === null ? null : `${value}`.trim() || null;
const normalizeDayOpening = (value) => {
    if (!value) {
        return undefined;
    }
    return {
        close: normalizeNullableString(value.close),
        is24Hours: normalizeBoolean(value.is_24_hours),
        open: normalizeNullableString(value.open)
    };
};
const normalizeBankHolidayOpening = (value) => {
    if (!value) {
        return null;
    }
    return {
        closeTime: normalizeNullableString(value.close_time),
        is24Hours: normalizeBoolean(value.is_24_hours),
        openTime: normalizeNullableString(value.open_time),
        type: normalizeNullableString(value.type) ?? "standard"
    };
};
const normalizeOpeningTimes = (value) => {
    if (!value) {
        return null;
    }
    const normalizedUsualDays = Object.entries(value.usual_days).reduce((result, [day, opening]) => {
        const normalizedOpening = normalizeDayOpening(opening);
        if (!normalizedOpening) {
            return result;
        }
        return {
            ...result,
            [day]: normalizedOpening
        };
    }, {});
    return {
        bankHoliday: normalizeBankHolidayOpening(value.bank_holiday),
        usualDays: normalizedUsualDays
    };
};
const normalizeLocation = (rawStation) => {
    const addressLine1 = normalizeNullableString(rawStation.location.address_line_1);
    const city = normalizeNullableString(rawStation.location.city);
    const country = normalizeNullableString(rawStation.location.country);
    const postcode = normalizeNullableString(rawStation.location.postcode);
    const latitude = rawStation.location.latitude;
    const longitude = rawStation.location.longitude;
    if (!addressLine1 || !city || !country || !postcode || latitude === null || longitude === null) {
        return undefined;
    }
    return {
        addressLine1,
        addressLine2: normalizeNullableString(rawStation.location.address_line_2),
        city,
        country,
        county: normalizeNullableString(rawStation.location.county),
        latitude,
        longitude,
        postcode
    };
};
const normalizeFuelPrice = (rawPrice) => {
    const fuelType = normalizeFuelType(rawPrice.fuel_type);
    if (!fuelType || !Number.isFinite(rawPrice.price)) {
        return undefined;
    }
    return {
        effectiveAt: normalizeNullableString(rawPrice.price_change_effective_timestamp),
        fuelType,
        lastUpdatedAt: normalizeNullableString(rawPrice.price_last_updated),
        pencePerLitre: rawPrice.price
    };
};
const buildIndexedStations = (rawStations, rawPriceStations) => {
    const pricesByNodeId = rawPriceStations.reduce((result, station) => {
        const normalizedPrices = station.fuel_prices.reduce((priceResult, rawPrice) => {
            const normalizedPrice = normalizeFuelPrice(rawPrice);
            if (!normalizedPrice) {
                return priceResult;
            }
            return {
                ...priceResult,
                [normalizedPrice.fuelType]: normalizedPrice
            };
        }, {});
        result.set(station.node_id, normalizedPrices);
        return result;
    }, new Map());
    return rawStations.reduce((result, rawStation) => {
        const location = normalizeLocation(rawStation);
        if (!location) {
            return result;
        }
        const availableFuelTypes = new Set();
        rawStation.fuel_types
            .map((fuelType) => normalizeFuelType(fuelType))
            .filter((fuelType) => fuelType !== undefined)
            .forEach((fuelType) => {
            availableFuelTypes.add(fuelType);
        });
        const prices = pricesByNodeId.get(rawStation.node_id) ?? {};
        Object.keys(prices).forEach((fuelType) => {
            availableFuelTypes.add(fuelType);
        });
        const tradingName = normalizeNullableString(rawStation.trading_name) ?? rawStation.node_id;
        const brandName = normalizeNullableString(rawStation.brand_name) ?? tradingName;
        const qualityFlags = (0, dataQuality_1.getStationQualityFlags)(tradingName, brandName);
        const searchText = [
            tradingName,
            brandName,
            location.postcode,
            location.addressLine1,
            location.city
        ]
            .join(" ")
            .toLowerCase();
        return [
            ...result,
            {
                amenities: [...new Set(rawStation.amenities.map((amenity) => amenity.trim()).filter((amenity) => amenity.length > 0))],
                availableFuelTypes: [...availableFuelTypes],
                brandName,
                isMotorwayServiceStation: normalizeBoolean(rawStation.is_motorway_service_station),
                isSupermarketServiceStation: normalizeBoolean(rawStation.is_supermarket_service_station),
                location,
                nodeId: rawStation.node_id,
                openingTimes: normalizeOpeningTimes(rawStation.opening_times),
                permanentClosure: normalizeBoolean(rawStation.permanent_closure),
                permanentClosureDate: normalizeNullableString(rawStation.permanent_closure_date),
                prices,
                publicPhoneNumber: normalizePhoneNumber(rawStation.public_phone_number),
                qualityFlags,
                searchText,
                temporaryClosure: normalizeBoolean(rawStation.temporary_closure),
                tradingName
            }
        ];
    }, []);
};
exports.buildIndexedStations = buildIndexedStations;
