import { FUEL_FINDER_BATCH_TIMEOUT_MS, TOKEN_EXPIRY_BUFFER_SECONDS } from "../lib/constants";
import { createAppError, isAppError } from "../lib/errors";
import {
  FuelFinderAccessTokenResponseSchema,
  FuelFinderPricePageSchema,
  FuelFinderStationPageSchema
} from "../lib/schemas";

import { requestJson } from "./requestJson";

import type { AppConfig, FuelFinderAccessToken, FuelFinderClient, RawFuelFinderPriceStation, RawFuelFinderStation } from "../lib/types";

type TokenCache = {
  accessToken: FuelFinderAccessToken;
  expiresAt: number;
} | null;

export const createFuelFinderClient = (config: AppConfig): FuelFinderClient => {
  let tokenCache: TokenCache = null;

  const requireCredentials = (): { clientId: string; clientSecret: string } => {
    if (!config.fuelFinderClientId || !config.fuelFinderClientSecret) {
      throw createAppError(
        "AUTH_ERROR",
        "Missing Fuel Finder credentials. Set FUEL_FINDER_CLIENT_ID and FUEL_FINDER_CLIENT_SECRET in your environment or .env file."
      );
    }

    return {
      clientId: config.fuelFinderClientId,
      clientSecret: config.fuelFinderClientSecret
    };
  };

  const getAccessToken = async (): Promise<FuelFinderAccessToken> => {
    if (tokenCache && Date.now() < tokenCache.expiresAt) {
      return tokenCache.accessToken;
    }

    const credentials = requireCredentials();
    const url = new URL("/api/v1/oauth/generate_access_token", config.fuelFinderBaseUrl);
    const response = await requestJson({
      body: JSON.stringify({
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret
      }),
      headers: {
        "content-type": "application/json"
      },
      label: "Fuel Finder access token request",
      method: "POST",
      schema: FuelFinderAccessTokenResponseSchema,
      url
    });
    const accessToken: FuelFinderAccessToken = {
      accessToken: response.data.access_token,
      expiresInSeconds: response.data.expires_in,
      tokenType: response.data.token_type
    };

    tokenCache = {
      accessToken,
      expiresAt: Date.now() + Math.max(0, accessToken.expiresInSeconds - TOKEN_EXPIRY_BUFFER_SECONDS) * 1_000
    };

    return accessToken;
  };

  const fetchAllPages = async <TData>(
    pathName: string,
    labelPrefix: string,
    schema: {
      parse: (input: unknown) => { data: TData[] };
    }
  ): Promise<TData[]> => {
    const accessToken = await getAccessToken();
    const items: TData[] = [];
    let batchNumber = 1;

    while (true) {
      const url = new URL(pathName, config.fuelFinderBaseUrl);
      url.searchParams.set("batch-number", `${batchNumber}`);

      let response: { data: TData[] };

      try {
        response = await requestJson({
          headers: {
            authorization: `${accessToken.tokenType} ${accessToken.accessToken}`
          },
          label: `${labelPrefix} batch ${batchNumber}`,
          schema,
          timeoutMs: FUEL_FINDER_BATCH_TIMEOUT_MS,
          url
        });
      } catch (error) {
        if (isAppError(error) && error.code === "NOT_FOUND" && batchNumber > 1 && items.length > 0) {
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
    getAllFuelPrices: async (): Promise<RawFuelFinderPriceStation[]> =>
      fetchAllPages<RawFuelFinderPriceStation>(
        "/api/v1/pfs/fuel-prices",
        "Fuel Finder prices",
        FuelFinderPricePageSchema as {
          parse: (input: unknown) => { data: RawFuelFinderPriceStation[] };
        }
      ),
    getAllStations: async (): Promise<RawFuelFinderStation[]> =>
      fetchAllPages<RawFuelFinderStation>(
        "/api/v1/pfs",
        "Fuel Finder stations",
        FuelFinderStationPageSchema as {
          parse: (input: unknown) => { data: RawFuelFinderStation[] };
        }
      )
  };
};
