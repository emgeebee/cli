#!/usr/bin/env node

import {
  legacyCmdTarget,
  triggerCmdTarget,
  triggerWfhToggle,
} from "./lib/cmdApi";

function usage(): void {
  console.log("Usage:");
  console.log("  cmd <command>");
  console.log("");
  console.log("Commands:");
  console.log("  slon  shed lights on");
  console.log("  slof  shed lights off");
  console.log("  smon  shed music on");
  console.log("  smof  shed music off");
  console.log("  shon  shed heater on");
  console.log("  shof  shed heater off");
  console.log("  blon  bedroom lights on");
  console.log("  blof  bedroom lights off");
  console.log("  wfh   toggle work-from-home status");
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args[0] === "--help" || args[0] === "-h" || args.length === 0) {
    usage();
    return;
  }
  if (args.length !== 1) {
    console.error("Expected exactly one command.");
    console.error("");
    usage();
    process.exit(1);
  }

  const code = args[0].toLowerCase();
  if (code === "wfh") {
    const { message } = await triggerWfhToggle();
    console.log(message);
    return;
  }

  const target = legacyCmdTarget(code);
  if (!target) {
    console.error(`Unknown command: ${args[0]}`);
    console.error("");
    usage();
    process.exit(1);
  }

  console.log(await triggerCmdTarget(target));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`cmd failed: ${message}`);
  process.exit(1);
});

export {};
