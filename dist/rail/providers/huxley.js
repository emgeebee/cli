"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createHuxleyClient = void 0;
const constants_1 = require("../lib/constants");
const schemas_1 = require("../lib/schemas");
const requestJson_1 = require("./requestJson");
const createHuxleyClient = (config) => {
    const baseUrl = new URL(config.railApiUrl);
    const accessToken = config.darwinAccessToken;
    const buildUrl = (path, expand) => {
        const url = new URL(path.replace(/^\//, ''), ensureTrailingSlash(baseUrl));
        if (expand) {
            url.searchParams.set('expand', 'true');
        }
        if (accessToken) {
            url.searchParams.set('accessToken', accessToken);
        }
        return url;
    };
    return {
        getArrivals: async ({ crs, expand, filterCrs, limit }) => (0, requestJson_1.requestJson)({
            hint: constants_1.HUXLEY_HINT,
            label: `Rail arrivals lookup for "${crs}"`,
            schema: schemas_1.StationBoardResponseSchema,
            url: buildBoardUrl({
                accessToken,
                baseUrl: ensureTrailingSlash(baseUrl),
                board: 'arrivals',
                crs,
                expand,
                filterCrs,
                filterType: 'from',
                limit,
            }),
        }),
        getDepartures: async ({ crs, expand, filterCrs, limit }) => (0, requestJson_1.requestJson)({
            hint: constants_1.HUXLEY_HINT,
            label: `Rail departures lookup for "${crs}"`,
            schema: schemas_1.StationBoardResponseSchema,
            url: buildBoardUrl({
                accessToken: accessToken.toUpperCase(),
                baseUrl: ensureTrailingSlash(baseUrl),
                board: 'departures',
                crs,
                expand,
                filterCrs,
                filterType: 'to',
                limit,
            }),
        }),
        searchStations: async (query) => {
            const normalizedQuery = query.trim();
            if (normalizedQuery.length === 0) {
                return [];
            }
            const url = buildUrl(`crs/${encodeURIComponent(normalizedQuery)}`);
            const response = await (0, requestJson_1.requestJson)({
                hint: constants_1.HUXLEY_HINT,
                label: `Rail station search for "${normalizedQuery}"`,
                schema: schemas_1.StationSearchResponseSchema,
                url,
            });
            return response.map((result) => ({
                crs: result.crsCode.toUpperCase(),
                name: result.stationName,
            }));
        },
    };
};
exports.createHuxleyClient = createHuxleyClient;
const buildBoardUrl = ({ accessToken, baseUrl, board, crs, expand, filterCrs, filterType, limit, }) => {
    const encodedCrs = encodeURIComponent(crs);
    const encodedLimit = encodeURIComponent(String(limit));
    const path = filterCrs
        ? `${board}/${encodedCrs}/${filterType}/${encodeURIComponent(filterCrs)}/${encodedLimit}`
        : `${board}/${encodedCrs}/${encodedLimit}`;
    const url = new URL(path, baseUrl);
    if (expand) {
        url.searchParams.set('expand', 'true');
    }
    if (accessToken) {
        // url.searchParams.set('accessToken', accessToken);
    }
    return url;
};
const ensureTrailingSlash = (value) => {
    const normalizedUrl = new URL(value.toString());
    if (!normalizedUrl.pathname.endsWith('/')) {
        normalizedUrl.pathname = `${normalizedUrl.pathname}/`;
    }
    return normalizedUrl;
};
