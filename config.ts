import { readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export type CliConfig = Record<string, unknown>;

export type PhoneCliConfig = {
  octo?: CliConfig;
  cric?: CliConfig;
  ball?: CliConfig;
  bday?: CliConfig;
  money?: CliConfig;
  w?: CliConfig;
  cal?: CliConfig;
  [section: string]: CliConfig | undefined;
};

const CONFIG_FILE = ".phone_cli.json";

export function getConfigPath(): string {
  return join(homedir(), CONFIG_FILE);
}

export function readPhoneCliConfig(): PhoneCliConfig {
  const path = getConfigPath();
  try {
    const raw = readFileSync(path, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Top-level JSON must be an object.");
    }
    return parsed as PhoneCliConfig;
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error != null &&
      "code" in error &&
      (error as { code?: unknown }).code === "ENOENT"
    ) {
      return {};
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read config at ${path}: ${message}`);
  }
}

