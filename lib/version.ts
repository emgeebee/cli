import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export function readPackageVersion(): string {
  const candidatePaths = [
    join(__dirname, "..", "package.json"),
    join(__dirname, "..", "..", "package.json"),
  ];
  for (const path of candidatePaths) {
    if (!existsSync(path)) {
      continue;
    }
    const parsed = JSON.parse(readFileSync(path, "utf8")) as { version?: unknown };
    if (typeof parsed.version === "string" && parsed.version.trim().length > 0) {
      return parsed.version;
    }
  }
  return "0.0.0";
}
