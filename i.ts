#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { input, select } from "@inquirer/prompts";

type CommandChoice = {
  cmd: string;
  name: string;
  value: number;
  description: string;
  extraArgs?: string;
};

const COMMANDS: CommandChoice[] = [
  { value: 1, cmd: "ball", name: "Football fixtures", description: "Football fixtures / PL table" },
  { value: 2, cmd: "ball", name: "PL table", description: "Football fixtures / PL table", extraArgs: 'pl' },
  { value: 3, cmd: "ball", name: "Villa Fixtures", description: "Football fixtures / Aston Villa", extraArgs: 'avfc' },
  { value: 4, cmd: "cal", name: "cal", description: "Calendar", extraArgs: '' },
  { value: 5, cmd: "w", name: "w", description: "Weather" },
  { value: 6, cmd: "cric", name: "cric", description: "Cricket fixtures" },
  { value: 7, cmd: "octo", name: "octo", description: "Octopus energy", extraArgs: '' },
  { value: 8, cmd: "bday", name: "bday", description: "Birthday age table", extraArgs: '' },
  { value: 9, cmd: "money", name: "money", description: "Monthly countdown value" },
  { value: 10, cmd: "cmd", name: "cmd", description: "Home automation shortcuts" },
  { value: 11, cmd: "fuel", name: "fuel", description: "UK fuel prices (near, station, list)" },
  { value: 12, cmd: "r", name: "CHM", description: "UK rail boards (departures, arrivals, search)", extraArgs: 'CHM' },
  { value: 13, cmd: "temp", name: "temp", description: "House temperature history", extraArgs: '' },
  { value: 14, cmd: "solar", name: "solar", description: "Solar yield and power history", extraArgs: '' },
];

function usage(): void {
  console.log("Usage:");
  console.log("  i");
  console.log("");
  console.log("Interactive picker for phone_cli scripts.");
}

function runSubcommand(command: string, args: string[]): never {
  const scriptPath = join(__dirname, `${command}.js`);
  const result = spawnSync(process.execPath, [scriptPath, ...args], { stdio: "inherit" });
  process.exit(result.status ?? 1);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args[0] === "--help" || args[0] === "-h") {
    usage();
    return;
  }
  if (args.length > 0) {
    throw new Error("i does not take arguments. Run a script directly, e.g. ball or solar.");
  }
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("Interactive picker requires a TTY.");
  }

  const command = await select({
    message: "Run which script?",
    choices: COMMANDS.map((cmd) => ({
      name: `${cmd.name} — ${cmd.description}`,
      value: cmd.value,
    })),
  });

  const selectedCommand = COMMANDS.find((cmd) => cmd.value === command);

  const extraArgsRaw = selectedCommand.extraArgs ? selectedCommand.extraArgs : await input({
    message: "Extra arguments (optional)",
    default: "",
  }) 

  const extraArgs = extraArgsRaw.trim().length > 0 ? extraArgsRaw.trim().split(/\s+/) : [];

  runSubcommand(selectedCommand.cmd, extraArgs);
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  console.error("");
  usage();
  process.exit(1);
});

export {};
