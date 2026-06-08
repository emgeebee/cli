import { readPhoneCliConfig } from "../config";

const DAY_MS = 24 * 60 * 60 * 1000;
const UK_TZ = "Europe/London";

export type BdayPersonConfig = {
  bd?: string;
  type?: number;
};

export type BdayConfig = Record<string, BdayPersonConfig>;

export type UpcomingBirthday = {
  name: string;
  bdYmd: string;
  nextYmd: string;
  daysUntil: number;
  age: number;
};

export function readBdayConfig(): BdayConfig | null {
  const config = readPhoneCliConfig();
  const bday = config.bday;
  if (!bday || typeof bday !== "object" || Array.isArray(bday)) {
    return null;
  }
  return bday as BdayConfig;
}

function ukTodayYmd(now: Date = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: UK_TZ });
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function birthdayYmdInYear(month: number, day: number, year: number): string {
  if (month === 2 && day === 29 && !isLeapYear(year)) {
    return `${year}-02-28`;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function ymdToUtcMs(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function nextBirthdayYmd(bdYmd: string, now: Date = new Date()): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(bdYmd)) return null;
  const [, month, day] = bdYmd.split("-").map(Number);
  const todayYmd = ukTodayYmd(now);
  const year = Number(todayYmd.slice(0, 4));
  let candidate = birthdayYmdInYear(month, day, year);
  if (candidate < todayYmd) {
    candidate = birthdayYmdInYear(month, day, year + 1);
  }
  return candidate;
}

export function nextUpcomingBirthdays(
  config: BdayConfig | null,
  now: Date = new Date(),
  limit = 3,
): UpcomingBirthday[] {
  if (!config) return [];

  const todayYmd = ukTodayYmd(now);
  const upcoming: UpcomingBirthday[] = [];

  for (const [name, person] of Object.entries(config)) {
    const bdYmd = String(person?.bd || "").trim();
    if (!bdYmd) continue;
    const nextYmd = nextBirthdayYmd(bdYmd, now);
    if (!nextYmd) continue;
    const daysUntil = Math.floor((ymdToUtcMs(nextYmd) - ymdToUtcMs(todayYmd)) / DAY_MS);
    const birthYear = Number(bdYmd.slice(0, 4));
    const nextYear = Number(nextYmd.slice(0, 4));
    upcoming.push({
      name,
      bdYmd,
      nextYmd,
      daysUntil,
      age: nextYear - birthYear,
    });
  }

  return upcoming
    .sort((a, b) => a.daysUntil - b.daysUntil || a.name.localeCompare(b.name))
    .slice(0, limit);
}

function formatBdayDate(ymd: string): string {
  const date = new Date(`${ymd}T12:00:00Z`);
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: UK_TZ,
  });
}

function formatDaysUntil(daysUntil: number): string {
  if (daysUntil === 0) return "today";
  if (daysUntil === 1) return "in 1 day";
  return `in ${daysUntil} days`;
}

export function formatUpcomingBdayLine(entry: UpcomingBirthday): string {
  if (entry.daysUntil === 0) {
    return `${entry.name}: today (turns ${entry.age})`;
  }
  return `${entry.name}: ${formatBdayDate(entry.nextYmd)} (${formatDaysUntil(entry.daysUntil)}, turns ${entry.age})`;
}

export function upcomingBdaySectionLines(
  config: BdayConfig | null,
  now: Date,
  sectionDivider: (name: string) => string,
  limit = 3,
): string[] {
  const lines = nextUpcomingBirthdays(config, now, limit).map(formatUpcomingBdayLine);
  if (lines.length === 0) return [];
  return [sectionDivider("bday"), ...lines];
}
