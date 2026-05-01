import { config as loadDotEnv } from 'dotenv';

import { readPhoneCliConfig } from '../../config';
import { DEFAULT_RAIL_API_URL } from './constants';

export type AppConfig = {
  darwinAccessToken: string | undefined;
  railApiUrl: string;
};

export const loadConfig = (): AppConfig => {
  loadDotEnv({
    quiet: true,
  });
  const rootConfig = readPhoneCliConfig() as Record<string, unknown>;
  const rConfig =
    typeof rootConfig['r'] === 'object' && rootConfig['r'] !== null && !Array.isArray(rootConfig['r'])
      ? (rootConfig['r'] as Record<string, unknown>)
      : {};
  const railConfig =
    typeof rootConfig['rail'] === 'object' && rootConfig['rail'] !== null && !Array.isArray(rootConfig['rail'])
      ? (rootConfig['rail'] as Record<string, unknown>)
      : {};

  const railApiUrl =
    firstDefinedValue([
      process.env['RAIL_API_URL'],
      typeof rConfig['railApiUrl'] === 'string' ? rConfig['railApiUrl'] : undefined,
      typeof railConfig['railApiUrl'] === 'string' ? railConfig['railApiUrl'] : undefined,
    ]) ?? DEFAULT_RAIL_API_URL;
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

const firstDefinedValue = (values: Array<string | undefined>): string | undefined =>
  values.map((value) => value?.trim()).find((value) => Boolean(value));
