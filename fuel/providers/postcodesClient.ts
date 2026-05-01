import { PostcodeLookupSchema } from "../lib/schemas";

import { requestJson } from "./requestJson";

import type { PostcodesClient } from "../lib/types";

export const createPostcodesClient = (): PostcodesClient => ({
  lookupPostcode: async (postcode) => {
    const url = new URL(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`);
    const response = await requestJson({
      label: `Postcode lookup for "${postcode}"`,
      schema: PostcodeLookupSchema,
      url
    });

    return response.result;
  }
});
