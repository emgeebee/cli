"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadStationListsConfig = void 0;
const config_1 = require("../../config");
const commandUtils_1 = require("./commandUtils");
const errors_1 = require("./errors");
const loadStationListsConfig = async () => {
    const configPath = (0, config_1.getConfigPath)();
    const rootConfig = (0, config_1.readPhoneCliConfig)();
    const fuelConfig = rootConfig["fuel"];
    if (typeof fuelConfig !== "object" || fuelConfig === null || Array.isArray(fuelConfig)) {
        throw (0, errors_1.createAppError)("NOT_FOUND", `Missing "fuel" section in ${configPath}. Add fuel.lists with named station lists.`);
    }
    const listsConfig = fuelConfig["lists"];
    if (listsConfig === undefined) {
        throw (0, errors_1.createAppError)("NOT_FOUND", `Missing fuel.lists in ${configPath}. Add named station lists under fuel.lists.`);
    }
    return validateStationListsConfig(listsConfig, `${configPath} (fuel.lists)`);
};
exports.loadStationListsConfig = loadStationListsConfig;
const validateStationListsConfig = (parsed, configPath) => {
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        throw (0, errors_1.createAppError)("INVALID_INPUT", `${configPath} must be a JSON object with named station lists.`);
    }
    const entries = Object.entries(parsed);
    const lists = {};
    for (const [listName, listValue] of entries) {
        if (typeof listValue !== "object" || listValue === null || Array.isArray(listValue)) {
            throw (0, errors_1.createAppError)("INVALID_INPUT", `List "${listName}" must be an object with "fuel" and "stations" keys.`);
        }
        const listDefinition = listValue;
        const fuel = listDefinition["fuel"];
        const stations = listDefinition["stations"];
        if (typeof fuel !== "string" || fuel.trim().length === 0) {
            throw (0, errors_1.createAppError)("INVALID_INPUT", `List "${listName}" must include a non-empty string "fuel".`);
        }
        if (!Array.isArray(stations)) {
            throw (0, errors_1.createAppError)("INVALID_INPUT", `List "${listName}" must include a "stations" array of station entries with "searchText" and optional "display".`);
        }
        const normalizedEntries = stations.map((value, index) => normalizeStationListEntry(listName, value, index));
        lists[listName] = {
            fuel: (0, commandUtils_1.parseFuelType)(fuel),
            stations: normalizedEntries
        };
    }
    return lists;
};
const normalizeStationListEntry = (listName, value, index) => {
    if (typeof value === "string") {
        if (value.trim().length === 0) {
            throw (0, errors_1.createAppError)("INVALID_INPUT", `List "${listName}" contains an invalid entry at index ${index}.`);
        }
        return {
            searchText: value.trim()
        };
    }
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw (0, errors_1.createAppError)("INVALID_INPUT", `List "${listName}" entry ${index} must be a string or object.`);
    }
    const entry = value;
    const searchText = entry["searchText"];
    const display = entry["display"];
    const legacyDisplayText = entry["displayText"];
    const sortRaw = entry["sort"];
    if (typeof searchText !== "string" || searchText.trim().length === 0) {
        throw (0, errors_1.createAppError)("INVALID_INPUT", `List "${listName}" entry ${index} must include non-empty "searchText".`);
    }
    if (display !== undefined && (typeof display !== "string" || display.trim().length === 0)) {
        throw (0, errors_1.createAppError)("INVALID_INPUT", `List "${listName}" entry ${index} has invalid "display"; omit it or provide a non-empty string.`);
    }
    if (legacyDisplayText !== undefined && (typeof legacyDisplayText !== "string" || legacyDisplayText.trim().length === 0)) {
        throw (0, errors_1.createAppError)("INVALID_INPUT", `List "${listName}" entry ${index} has invalid legacy "displayText"; omit it or provide a non-empty string.`);
    }
    const normalizedDisplay = typeof display === "string" ? display.trim() : undefined;
    const normalizedLegacyDisplay = typeof legacyDisplayText === "string" ? legacyDisplayText.trim() : undefined;
    let sort;
    if (sortRaw !== undefined) {
        if (typeof sortRaw !== "number" || !Number.isFinite(sortRaw)) {
            throw (0, errors_1.createAppError)("INVALID_INPUT", `List "${listName}" entry ${index} "sort" must be a finite number.`);
        }
        sort = sortRaw;
    }
    return {
        ...(normalizedDisplay ? { display: normalizedDisplay } : normalizedLegacyDisplay ? { display: normalizedLegacyDisplay } : {}),
        ...(sort !== undefined ? { sort } : {}),
        searchText: searchText.trim()
    };
};
