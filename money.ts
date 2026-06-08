#!/usr/bin/env node

import { getConfigPath } from "./config";
import { moneyForToday, resolveBudget } from "./lib/moneyApi";

function usage(): void {
  console.log("Usage:");
  console.log("  money");
  console.log("");
  console.log(`Optional config: ${getConfigPath()} -> { "money": { "budget": 744 } }`);
}

async function main(): Promise<void> {
  try {
    const args = process.argv.slice(2);
    if (args[0] === "--help" || args[0] === "-h") {
      usage();
      return;
    }
    if (args.length > 0) {
      throw new Error("This command takes no arguments.");
    }

    const startAmount = resolveBudget();
    const { dayOfMonth, remaining } = moneyForToday(startAmount);
    console.log(`Day ${dayOfMonth}: ${remaining}`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    console.error("");
    usage();
    process.exit(1);
  }
}

void main();

export {};

