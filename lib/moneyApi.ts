import { getConfigPath, readPhoneCliConfig } from "../config";

export const DEFAULT_BUDGET = 744;
export const DAILY_DEDUCTION = 24;

export function resolveBudget(): number {
  const config = readPhoneCliConfig();
  const moneyConfig = config.money || {};
  const raw = moneyConfig.budget;
  if (raw == null || raw === "") return DEFAULT_BUDGET;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid money.budget in ${getConfigPath()}. Expected a non-negative number.`);
  }
  return value;
}

export function moneyForToday(
  startAmount: number,
  now: Date = new Date(),
): { dayOfMonth: number; remaining: number } {
  const dayOfMonth = now.getDate();
  const remaining = startAmount - DAILY_DEDUCTION * dayOfMonth;
  return { dayOfMonth, remaining: Math.max(0, remaining) };
}

export function moneyRemaining(now: Date = new Date()): number | null {
  try {
    return moneyForToday(resolveBudget(), now).remaining;
  } catch {
    return null;
  }
}

export function datesSectionLabel(now: Date = new Date()): string {
  const remaining = moneyRemaining(now);
  if (remaining == null) return "dates (-)";
  return `dates (${remaining})`;
}

export function formatMoneyLine(now: Date = new Date()): string {
  try {
    const { dayOfMonth, remaining } = moneyForToday(resolveBudget(), now);
    return `money: Day ${dayOfMonth}: ${remaining}`;
  } catch {
    return "money: -";
  }
}
