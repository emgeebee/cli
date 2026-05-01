"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadConfig = void 0;
const dotenv_1 = require("dotenv");
const node_os_1 = require("node:os");
const node_path_1 = require("node:path");
const config_1 = require("../../config");
const commandUtils_1 = require("./commandUtils");
const firstDefinedValue = (values) => values.map((value) => value?.trim()).find((value) => Boolean(value));
const getDefaultCacheDir = () => {
    const xdgCacheHome = process.env["XDG_CACHE_HOME"]?.trim();
    if (xdgCacheHome) {
        return (0, node_path_1.join)(xdgCacheHome, "fuel-cli");
    }
    if (process.platform === "darwin") {
        return (0, node_path_1.join)((0, node_os_1.homedir)(), "Library", "Caches", "fuel-cli");
    }
    if (process.platform === "win32") {
        const localAppData = process.env["LOCALAPPDATA"]?.trim();
        return localAppData ? (0, node_path_1.join)(localAppData, "fuel-cli") : (0, node_path_1.join)((0, node_os_1.homedir)(), "AppData", "Local", "fuel-cli");
    }
    return (0, node_path_1.join)((0, node_os_1.homedir)(), ".cache", "fuel-cli");
};
const loadConfig = () => {
    (0, dotenv_1.config)({
        quiet: true
    });
    const rootConfig = (0, config_1.readPhoneCliConfig)();
    const fuelConfig = typeof rootConfig["fuel"] === "object" && rootConfig["fuel"] !== null && !Array.isArray(rootConfig["fuel"])
        ? rootConfig["fuel"]
        : {};
    const fuelFinderBaseUrl = firstDefinedValue([
        typeof fuelConfig["fuelFinderBaseUrl"] === "string" ? fuelConfig["fuelFinderBaseUrl"] : undefined,
        process.env["FUEL_FINDER_BASE_URL"]
    ]) ?? "https://www.fuel-finder.service.gov.uk";
    const fuelFinderClientId = firstDefinedValue([
        typeof fuelConfig["fuelFinderClientId"] === "string" ? fuelConfig["fuelFinderClientId"] : undefined,
        process.env["FUEL_FINDER_CLIENT_ID"]
    ]);
    const fuelFinderClientSecret = firstDefinedValue([
        typeof fuelConfig["fuelFinderClientSecret"] === "string" ? fuelConfig["fuelFinderClientSecret"] : undefined,
        process.env["FUEL_FINDER_CLIENT_SECRET"]
    ]);
    const cacheDir = firstDefinedValue([
        typeof fuelConfig["cacheDir"] === "string" ? fuelConfig["cacheDir"] : undefined,
        process.env["FUEL_CACHE_DIR"]
    ]) ?? getDefaultCacheDir();
    const defaultFuelTypeRaw = firstDefinedValue([
        typeof fuelConfig["defaultFuelType"] === "string" ? fuelConfig["defaultFuelType"] : undefined,
        process.env["FUEL_DEFAULT_FUEL_TYPE"]
    ]);
    const defaultFuelType = defaultFuelTypeRaw ? (0, commandUtils_1.parseFuelType)(defaultFuelTypeRaw) : undefined;
    return {
        cacheDir,
        ...(defaultFuelType ? { defaultFuelType } : {}),
        fuelFinderBaseUrl,
        ...(fuelFinderClientId ? { fuelFinderClientId } : {}),
        ...(fuelFinderClientSecret ? { fuelFinderClientSecret } : {})
    };
};
exports.loadConfig = loadConfig;
