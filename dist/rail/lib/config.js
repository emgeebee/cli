"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadConfig = void 0;
const dotenv_1 = require("dotenv");
const config_1 = require("../../config");
const constants_1 = require("./constants");
const loadConfig = () => {
    (0, dotenv_1.config)({
        quiet: true,
    });
    const rootConfig = (0, config_1.readPhoneCliConfig)();
    const rConfig = typeof rootConfig['r'] === 'object' && rootConfig['r'] !== null && !Array.isArray(rootConfig['r'])
        ? rootConfig['r']
        : {};
    const railConfig = typeof rootConfig['rail'] === 'object' && rootConfig['rail'] !== null && !Array.isArray(rootConfig['rail'])
        ? rootConfig['rail']
        : {};
    const railApiUrl = firstDefinedValue([
        process.env['RAIL_API_URL'],
        typeof rConfig['railApiUrl'] === 'string' ? rConfig['railApiUrl'] : undefined,
        typeof railConfig['railApiUrl'] === 'string' ? railConfig['railApiUrl'] : undefined,
    ]) ?? constants_1.DEFAULT_RAIL_API_URL;
    const darwinAccessToken = firstDefinedValue([
        typeof rConfig['darwinAccessToken'] === 'string' ? rConfig['darwinAccessToken'] : undefined,
        typeof railConfig['darwinAccessToken'] === 'string' ? railConfig['darwinAccessToken'] : undefined,
        process.env['DARWIN_ACCESS_TOKEN'],
    ]);
    return {
        darwinAccessToken,
        railApiUrl,
    };
};
exports.loadConfig = loadConfig;
const firstDefinedValue = (values) => values.map((value) => value?.trim()).find((value) => Boolean(value));
