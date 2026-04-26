#!/usr/bin/env node

const START_AMOUNT = 744;
const DAILY_DEDUCTION = 24;
const MONTH_MODEL_DAYS = 31;

function usage(): void {
  console.log("Usage:");
  console.log("  money");
}

function moneyForToday(now: Date = new Date()): { dayOfMonth: number; remaining: number } {
  const dayOfMonth = now.getDate();
  const remaining = START_AMOUNT - DAILY_DEDUCTION * dayOfMonth;
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

    const { dayOfMonth, remaining } = moneyForToday();
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

