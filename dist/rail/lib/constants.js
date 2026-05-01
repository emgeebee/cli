"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HUXLEY_HINT = exports.DEFAULT_RAIL_API_URL = exports.DEFAULT_LIMIT = exports.JSON_SCHEMA_VERSION = void 0;
const config_1 = require("../../config");
exports.JSON_SCHEMA_VERSION = '1';
exports.DEFAULT_LIMIT = 10;
exports.DEFAULT_RAIL_API_URL = 'https://huxley2.azurewebsites.net';
exports.HUXLEY_HINT = `Set RAIL_API_URL or r.railApiUrl / rail.railApiUrl in ${(0, config_1.getConfigPath)()} to a working Huxley instance if the public service is unavailable.`;
