#!/usr/bin/env node

import { getConfigPath, readPhoneCliConfig } from "./config";

const DEFAULT_START_AMOUNT = 744;
const DAILY_DEDUCTION = 24;

function usage(): void {
  console.log("Usage:");
  console.log("  money");
  console.log("");
  console.log(`Optional config: ${getConfigPath()} -> { "money": { "budget": 744 } }`);
}

function resolveBudget(): number {
  const config = readPhoneCliConfig();
  const moneyConfig = config.money || {};
  const raw = moneyConfig.budget;
  if (raw == null || raw === "") return DEFAULT_START_AMOUNT;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid money.budget in ${getConfigPath()}. Expected a non-negative number.`);
  }
  return value;
}

function moneyForToday(startAmount: number, now: Date = new Date()): { dayOfMonth: number; remaining: number } {
  const dayOfMonth = now.getDate();
  const remaining = startAmount - DAILY_DEDUCTION * dayOfMonth;
  
  return { dayOfMonth, remaining: Math.max(0, remaining) };
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

