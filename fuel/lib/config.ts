import { config as loadDotEnv } from "dotenv";
import { homedir } from "node:os";
import { join } from "node:path";

import { readPhoneCliConfig } from "../../config";
import { parseFuelType } from "./commandUtils";
import type { AppConfig } from "./types";

const firstDefinedValue = (values: Array<string | undefined>): string | undefined =>
  values.map((value) => value?.trim()).find((value) => Boolean(value));

const getDefaultCacheDir = (): string => {
  const xdgCacheHome = process.env["XDG_CACHE_HOME"]?.trim();

  if (xdgCacheHome) {
    return join(xdgCacheHome, "fuel-cli");
  }

  if (process.platform === "darwin") {
    return join(homedir(), "Library", "Caches", "fuel-cli");
  }

  if (process.platform === "win32") {
    const localAppData = process.env["LOCALAPPDATA"]?.trim();
    return localAppData ? join(localAppData, "fuel-cli") : join(homedir(), "AppData", "Local", "fuel-cli");
  }

  return join(homedir(), ".cache", "fuel-cli");
};

export const loadConfig = (): AppConfig => {
  loadDotEnv({
    quiet: true
  });

  const rootConfig = readPhoneCliConfig() as Record<string, unknown>;
  const fuelConfig =
    typeof rootConfig["fuel"] === "object" && rootConfig["fuel"] !== null && !Array.isArray(rootConfig["fuel"])
      ? (rootConfig["fuel"] as Record<string, unknown>)
      : {};
  const fuelFinderBaseUrl =
    firstDefinedValue([
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
  const cacheDir =
    firstDefinedValue([
      typeof fuelConfig["cacheDir"] === "string" ? fuelConfig["cacheDir"] : undefined,
      process.env["FUEL_CACHE_DIR"]
    ]) ?? getDefaultCacheDir();
  const defaultFuelTypeRaw = firstDefinedValue([
    typeof fuelConfig["defaultFuelType"] === "string" ? fuelConfig["defaultFuelType"] : undefined,
    process.env["FUEL_DEFAULT_FUEL_TYPE"]
  ]);
  const defaultFuelType = defaultFuelTypeRaw ? parseFuelType(defaultFuelTypeRaw) : undefined;

  return {
    cacheDir,
    ...(defaultFuelType ? { defaultFuelType } : {}),
    fuelFinderBaseUrl,
    ...(fuelFinderClientId ? { fuelFinderClientId } : {}),
    ...(fuelFinderClientSecret ? { fuelFinderClientSecret } : {})
  };
};
