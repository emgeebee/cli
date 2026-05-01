"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPostcodesClient = void 0;
const schemas_1 = require("../lib/schemas");
const requestJson_1 = require("./requestJson");
const createPostcodesClient = () => ({
    lookupPostcode: async (postcode) => {
        const url = new URL(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`);
        const response = await (0, requestJson_1.requestJson)({
            label: `Postcode lookup for "${postcode}"`,
            schema: schemas_1.PostcodeLookupSchema,
            url
        });
        return response.result;
    }
});
exports.createPostcodesClient = createPostcodesClient;
