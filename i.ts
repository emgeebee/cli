#!/usr/bin/env node

import { input, select } from "@inquirer/prompts";

import { LAUNCHER_COMMANDS, runLauncherCommand } from "./lib/commands";

const COMMANDS = [
  ...LAUNCHER_COMMANDS,
  { value: 15, cmd: "status", name: "status", description: "Clock, date, sunrise/sunset" },
];

function usage(): void {
  console.log("Usage:");
  console.log("  i");
  console.log("");
  console.log("Interactive picker for phone_cli scripts.");
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
  if (!selectedCommand) {
    throw new Error("Unknown command selection.");
  }

  const extraArgsRaw = selectedCommand.extraArgs ? selectedCommand.extraArgs : await input({
    message: "Extra arguments (optional)",
    default: "",
  });

  const extraArgs = extraArgsRaw.trim().length > 0 ? extraArgsRaw.trim().split(/\s+/) : [];

  process.exit(runLauncherCommand({
    ...selectedCommand,
    extraArgs: extraArgs.length > 0 ? extraArgs.join(" ") : selectedCommand.extraArgs,
  }));
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  console.error("");
  usage();
  process.exit(1);
});

export {};
