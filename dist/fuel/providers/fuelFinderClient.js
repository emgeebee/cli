"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFuelFinderClient = void 0;
const constants_1 = require("../lib/constants");
const errors_1 = require("../lib/errors");
const schemas_1 = require("../lib/schemas");
const requestJson_1 = require("./requestJson");
const createFuelFinderClient = (config) => {
    let tokenCache = null;
    const requireCredentials = () => {
        if (!config.fuelFinderClientId || !config.fuelFinderClientSecret) {
            throw (0, errors_1.createAppError)("AUTH_ERROR", "Missing Fuel Finder credentials. Set FUEL_FINDER_CLIENT_ID and FUEL_FINDER_CLIENT_SECRET in your environment or .env file.");
        }
        return {
            clientId: config.fuelFinderClientId,
            clientSecret: config.fuelFinderClientSecret
        };
    };
    const getAccessToken = async () => {
        if (tokenCache && Date.now() < tokenCache.expiresAt) {
            return tokenCache.accessToken;
        }
        const credentials = requireCredentials();
        const url = new URL("/api/v1/oauth/generate_access_token", config.fuelFinderBaseUrl);
        const response = await (0, requestJson_1.requestJson)({
            body: JSON.stringify({
                client_id: credentials.clientId,
                client_secret: credentials.clientSecret
            }),
            headers: {
                "content-type": "application/json"
            },
            label: "Fuel Finder access token request",
            method: "POST",
            schema: schemas_1.FuelFinderAccessTokenResponseSchema,
            url
        });
        const accessToken = {
            accessToken: response.data.access_token,
            expiresInSeconds: response.data.expires_in,
            tokenType: response.data.token_type
        };
        tokenCache = {
            accessToken,
            expiresAt: Date.now() + Math.max(0, accessToken.expiresInSeconds - constants_1.TOKEN_EXPIRY_BUFFER_SECONDS) * 1_000
        };
        return accessToken;
    };
    const fetchAllPages = async (pathName, labelPrefix, schema) => {
        const accessToken = await getAccessToken();
        const items = [];
        let batchNumber = 1;
        while (true) {
            const url = new URL(pathName, config.fuelFinderBaseUrl);
            url.searchParams.set("batch-number", `${batchNumber}`);
            let response;
            try {
                response = await (0, requestJson_1.requestJson)({
                    headers: {
                        authorization: `${accessToken.tokenType} ${accessToken.accessToken}`
                    },
                    label: `${labelPrefix} batch ${batchNumber}`,
                    schema,
                    timeoutMs: constants_1.FUEL_FINDER_BATCH_TIMEOUT_MS,
                    url
                });
            }
            catch (error) {
                if ((0, errors_1.isAppError)(error) && error.code === "NOT_FOUND" && batchNumber > 1 && items.length > 0) {
                    break;
                }
                throw error;
            }
            const pageData = response.data;
            if (pageData.length === 0) {
                break;
            }
            items.push(...pageData);
            batchNumber += 1;
        }
        return items;
    };
    return {
        getAllFuelPrices: async () => fetchAllPages("/api/v1/pfs/fuel-prices", "Fuel Finder prices", schemas_1.FuelFinderPricePageSchema),
        getAllStations: async () => fetchAllPages("/api/v1/pfs", "Fuel Finder stations", schemas_1.FuelFinderStationPageSchema)
    };
};
exports.createFuelFinderClient = createFuelFinderClient;
