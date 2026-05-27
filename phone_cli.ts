#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { join } from "node:path";

const COMMANDS = new Set(["ball", "cal", "w", "cric", "octo", "bday", "money", "cmd", "fuel", "r", "temp", "solar"]);

function printUsage(): void {
  console.log("phone_cli commands:");
  console.log("  ball   Football fixtures / PL table");
  console.log("  cal    Calendar");
  console.log("  w      Weather");
  console.log("  cric   Cricket fixtures");
  console.log("  octo   Octopus energy");
  console.log("  bday   Birthday age table");
  console.log("  money  Monthly countdown value");
  console.log("  cmd    Home automation shortcuts");
  console.log("         slon, slof, smon, smof, shon, shof, blon, blof");
  console.log("  fuel   UK fuel prices (near, station, list)");
  console.log("  r      UK rail boards (departures, arrivals, search)");
  console.log("  temp   House temperature history (last 24h)");
  console.log("  solar  Solar yield and power history");
  console.log("");
  console.log("Usage:");
  console.log("  npx @emgeebee/phone_cli <command> [args]");
  console.log("");
  console.log("Examples:");
  console.log("  npx @emgeebee/phone_cli ball");
  console.log("  npx @emgeebee/phone_cli ball pl");
  console.log("  npx @emgeebee/phone_cli money");
  console.log("  npx @emgeebee/phone_cli cmd");
  console.log("  npx @emgeebee/phone_cli cmd slon");
  console.log('  npx @emgeebee/phone_cli fuel near "SE1 9SG" --fuel E10');
  console.log('  npx @emgeebee/phone_cli r departures KGX');
  console.log("  npx @emgeebee/phone_cli temp");
  console.log("  npx @emgeebee/phone_cli solar");
}

function runSubcommand(command: string, args: string[]): never {
  const scriptPath = join(__dirname, `${command}.js`);
  const result = spawnSync(process.execPath, [scriptPath, ...args], { stdio: "inherit" });
  process.exit(result.status ?? 1);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const cmd = args[0];

  if (!cmd || cmd === "--help" || cmd === "-h") {
    printUsage();
    return;
  }

  if (!COMMANDS.has(cmd)) {
    console.error(`Unknown command: ${cmd}`);
    console.error("");
    printUsage();
    process.exit(1);
  }

  runSubcommand(cmd, args.slice(1));
}

void main();

export {};

