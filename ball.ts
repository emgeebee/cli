#!/usr/bin/env node

import { fetchBbcJson, toYmd } from "./bbc";

type JsonRecord = Record<string, unknown>;
type FixtureOptions = {
  includeDate?: boolean;
  showCompetitionTag?: boolean;
  emptyMessage?: string;
};
type ParseResult =
  | { help: true }
  | { day: string }
  | { teamQuery: string; teamInput: string; teamUrn: string };

type ScoreValue = string | number | null | undefined;

type ApiScoreContainer = {
  score?: ScoreValue;
  aggregate?: ScoreValue;
};

type ApiTeamName = {
  abbreviation?: string;
  shortName?: string;
  fullName?: string;
};

type ApiTeam = {
  id?: string;
  key?: string;
  urn?: string;
  shortName?: string;
  fullName?: string;
  name?: ApiTeamName;
  scores?: ApiScoreContainer;
  runningScores?: ApiScoreContainer;
  score?: ScoreValue;
};

type ApiParticipant = {
  alignment?: string;
  score?: ScoreValue;
  runningScore?: ScoreValue;
  aggregateScore?: ScoreValue;
  name?: ApiTeamName;
};

type ApiTournament = {
  id?: string;
  name?: string;
  disambiguatedName?: string;
  urn?: string;
};

type ApiStatusLabel = {
  value?: string;
  accessible?: string;
};

type ApiEvent = {
  home?: ApiTeam;
  away?: ApiTeam;
  homeTeam?: ApiTeam;
  awayTeam?: ApiTeam;
  startTime?: string;
  startDateTime?: string;
  status?: string;
  statusText?: string;
  eventStatusNote?: string;
  statusComment?: ApiStatusLabel;
  periodLabel?: ApiStatusLabel;
  participants?: ApiParticipant[];
  tournament?: ApiTournament;
  eventGroupingLabel?: string;
};

type ApiSecondaryGroup = {
  displayLabel?: string | null;
  events?: ApiEvent[];
};

type ApiEventGroup = {
  displayLabel?: string | null;
  secondaryGroups?: ApiSecondaryGroup[];
};

type ApiLegacyDateBucket = {
  events?: ApiEvent[];
};

type ApiLegacyTournament = {
  tournamentDatesWithEvents?: Record<string, ApiLegacyDateBucket[]>;
};

type ApiPayloadEntry = {
  body?: {
    matchData?: ApiLegacyTournament[];
  };
};

type ApiResponse = {
  payload?: ApiPayloadEntry[];
  eventGroups?: ApiEventGroup[];
};

type NormalizedTeam = ApiTeam & {
  key: string;
  urn: string;
  name: {
    abbreviation: string;
    shortName: string;
    fullName: string;
  };
};

type NormalizedEvent = ApiEvent & {
  startTime: string;
  eventStatusNote: string;
  homeTeam: NormalizedTeam;
  awayTeam: NormalizedTeam;
  participants: ApiParticipant[];
};

const DAY_MS = 24 * 60 * 60 * 1000;
const TEAM_QUERY_ALIASES: Record<string, string> = {
  avfc: "aston-villa",
};
const COMPETITION_ALLOWLIST = new Set([
  "premierleague",
  "championship",
  "leagueone",
  "facup",
  "leaguecup",
  "championsleague",
  "europaleague",
  "scottishpremiership",
  "englishpremierleague",
  "englishchampionship",
  "englishleagueone",
  "eflcup",
  "uefachampionsleague",
  "uefaeuropaleague",
]);
const COMPETITION_ORDER = [
  "Premier League",
  "FA Cup",
  "League Cup",
  "UEFA Champions League",
  "UEFA Europa League",
  "Championship",
  "League One",
  "Scottish Premiership",
];

const BBC_BASE_URL =
  "https://www.bbc.co.uk/wc-data/container/sport-data-scores-fixtures";
const ANSI_RESET = "\x1b[0m";
const ANSI_DARK_GREEN = "\x1b[32m";
const ANSI_DARK_RED = "\x1b[31m";
const ANSI_BRIGHT_GREEN = "\x1b[92m";
const ANSI_BRIGHT_RED = "\x1b[91m";

const urlForDaysGames = (today: string, end: string, start: string): string =>
  `${BBC_BASE_URL}?selectedEndDate=${end}&selectedStartDate=${start}&todayDate=${today}&urn=${encodeURIComponent("urn:bbc:sportsdata:football:tournament-collection:collated")}`;

const urlForTeamGames = (
  today: string,
  end: string,
  start: string,
  teamUrn: string,
): string =>
  `${BBC_BASE_URL}?selectedEndDate=${end}&selectedStartDate=${start}&todayDate=${today}&urn=${encodeURIComponent(teamUrn)}`;

function usage(): void {
  console.log("Usage:");
  console.log("  ball");
  console.log("  ball YYYY-MM-DD");
  console.log("  ball DD/MM");
  console.log("  ball today|tomorrow|mon|tues|wed|thurs|fri|sat|sun");
  console.log("  ball TEAM");
}

function parseYmd(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  return toYmd(d) === value ? d : null;
}

function parseDayMonthInput(value: string): Date | null {
  const m = /^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{4}))?$/.exec(String(value || ""));
  if (!m) {
    return null;
  }
  const day = Number.parseInt(m[1], 10);
  const month = Number.parseInt(m[2], 10);
  const year = m[3] ? Number.parseInt(m[3], 10) : null;
  if (day < 1 || day > 31 || month < 1 || month > 12) {
    return null;
  }

  const now = new Date();
  const nowY = now.getFullYear();
  const y = year || nowY;
  const candidate = new Date(Date.UTC(y, month - 1, day));
  if (
    candidate.getUTCFullYear() !== y ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    return null;
  }

  if (!year) {
    const startOfTodayUtc = new Date(Date.UTC(nowY, now.getMonth(), now.getDate()));
    if (candidate < startOfTodayUtc) {
      const nextYear = new Date(Date.UTC(nowY + 1, month - 1, day));
      if (nextYear.getUTCMonth() === month - 1 && nextYear.getUTCDate() === day) {
        return nextYear;
      }
    }
  }
  return candidate;
}

function parseRelativeDayInput(value: string): Date | null {
  const v = String(value || "").trim().toLowerCase();
  const now = new Date();
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

  if (v === "today") return today;
  if (v === "tomorrow") return new Date(today.getTime() + DAY_MS);

  const weekdayMap: Record<string, number> = {
    sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2,
    wed: 3, weds: 3, wednesday: 3, thu: 4, thur: 4, thurs: 4, thursday: 4,
    fri: 5, friday: 5, sat: 6, saturday: 6,
  };

  if (weekdayMap[v] == null) return null;

  const targetDow = weekdayMap[v];
  const currentDow = today.getUTCDay();
  let delta = (targetDow - currentDow + 7) % 7;
  if (delta === 0) delta = 7;
  return new Date(today.getTime() + delta * DAY_MS);
}

function formatFixtureDate(isoDateTime: string): string {
  const d = new Date(isoDateTime);
  if (Number.isNaN(d.getTime())) return "unknown-date";

  const weekday = d.toLocaleDateString("en-GB", {
    weekday: "short",
    timeZone: "Europe/London",
  });
  const day = d.toLocaleDateString("en-GB", { day: "2-digit", timeZone: "Europe/London" });
  const month = d.toLocaleDateString("en-GB", { month: "2-digit", timeZone: "Europe/London" });
  const dayName = weekday.charAt(0).toUpperCase() + weekday.slice(1).toLowerCase();
  return `${dayName} ${day}/${month}`;
}

function eventTime(event: ApiEvent): string {
  const dateValue = event.startTime || event.startDateTime;
  if (!dateValue) return "??:?? UK";
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return "??:?? UK";

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZoneName: "short",
  }).formatToParts(d);
  const hh = parts.find((p) => p.type === "hour")?.value || "??";
  const mm = parts.find((p) => p.type === "minute")?.value || "??";
  const tz = parts.find((p) => p.type === "timeZoneName")?.value || "UK";
  return `${hh}:${mm} ${tz}`;
}

function teamLabel(team: ApiTeam | undefined): string {
  return (
    team?.name?.shortName ||
    team?.shortName ||
    team?.name?.abbreviation ||
    team?.name?.fullName ||
    team?.fullName ||
    team?.key ||
    "unknown-team"
  );
}

function competitionLabel(event: ApiEvent): string {
  return (
    event?.tournament?.disambiguatedName ||
    event?.tournament?.name ||
    event?.eventGroupingLabel ||
    "Other"
  );
}

function competitionAllowed(event: ApiEvent): boolean {
  const candidates = [
    event?.tournament?.disambiguatedName,
    event?.tournament?.name,
    urnSlug(event?.tournament?.urn),
  ]
    .filter(Boolean)
    .map(normalizeText);

  return candidates.some((candidate) => COMPETITION_ALLOWLIST.has(candidate));
}

function teamScore(team: ApiTeam | undefined, event: NormalizedEvent): string | null {
  const direct = team?.scores?.score ?? team?.runningScores?.score ?? team?.score ?? null;
  if (direct != null) return String(direct);
  const participant = (event.participants || []).find((p) => {
    return p.alignment === (team === event.homeTeam ? "home" : "away");
  });
  const participantScore = participant?.score ?? participant?.runningScore ?? null;
  return participantScore != null ? String(participantScore) : null;
}

function isResultState(event: ApiEvent): boolean {
  const status = String(event.status || "").toLowerCase();
  return Boolean(status) && status !== "preevent";
}

function isFinishedState(event: ApiEvent): boolean {
  const status = String(event.status || "").toLowerCase();
  if (status === "postevent") return true;
  const note = String(event.eventStatusNote || "").toLowerCase();
  return (
    note === "ft" ||
    note.includes("full time") ||
    note.includes("final") ||
    note.includes("aet") ||
    note.includes("pens")
  );
}

function shouldUseColor(): boolean {
  return Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
}

function scoreNumber(score: string | null): number | null {
  if (score == null) return null;
  const parsed = Number.parseInt(String(score), 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function colorTeamName(name: string, role: "win" | "loss" | "draw", isLive: boolean): string {
  if (!shouldUseColor()) return name;
  if (role === "win") return `${isLive ? ANSI_BRIGHT_GREEN : ANSI_DARK_GREEN}${name}${ANSI_RESET}`;
  if (role === "loss") return `${isLive ? ANSI_BRIGHT_RED : ANSI_DARK_RED}${name}${ANSI_RESET}`;
  return name;
}

function fixtureLine(event: NormalizedEvent, options: FixtureOptions = {}): string {
  const home = teamLabel(event.homeTeam);
  const away = teamLabel(event.awayTeam);
  const statusLabel = event.eventStatusNote || event.statusText || "scheduled";
  const competitionTag = competitionLabel(event);
  const homeScore = teamScore(event.homeTeam, event);
  const awayScore = teamScore(event.awayTeam, event);
  const hasScore = homeScore != null && awayScore != null;
  const includeDate = options.includeDate === true;
  const showCompetitionTag = options.showCompetitionTag === true;
  const datePrefix = includeDate
    ? `${formatFixtureDate(event.startTime || event.startDateTime)} `
    : "";
  const suffix = showCompetitionTag ? `(${competitionTag})` : `(${statusLabel})`;

  if (isResultState(event) && hasScore) {
    const homeN = scoreNumber(homeScore);
    const awayN = scoreNumber(awayScore);
    const isLive = !isFinishedState(event);
    let homeDisplay = home;
    let awayDisplay = away;
    if (homeN != null && awayN != null && homeN !== awayN) {
      homeDisplay = colorTeamName(home, homeN > awayN ? "win" : "loss", isLive);
      awayDisplay = colorTeamName(away, awayN > homeN ? "win" : "loss", isLive);
    }
    return `${datePrefix}${eventTime(event)} ${homeDisplay} ${homeScore}-${awayScore} ${awayDisplay} ${suffix}`;
  }
  return `${datePrefix}${eventTime(event)} ${home} vs ${away} ${suffix}`;
}

function printGroupedFixtures(
  events: NormalizedEvent[],
  heading: string,
  options: FixtureOptions = {},
): void {
  console.log(heading);
  if (events.length === 0) {
    console.log(options.emptyMessage || "No fixtures.");
    return;
  }

  const groups = new Map<string, NormalizedEvent[]>();
  for (const event of events) {
    const key = competitionLabel(event);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(event);
  }

  const sortedGroups = [...groups.entries()].sort(([a], [b]) => {
    const ai = COMPETITION_ORDER.findIndex((name) => normalizeText(name) === normalizeText(a));
    const bi = COMPETITION_ORDER.findIndex((name) => normalizeText(name) === normalizeText(b));
    const aRank = ai === -1 ? Number.MAX_SAFE_INTEGER : ai;
    const bRank = bi === -1 ? Number.MAX_SAFE_INTEGER : bi;
    if (aRank !== bRank) return bRank - aRank;
    return b.localeCompare(a);
  });

  for (const [competition, list] of sortedGroups) {
    list.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    console.log("");
    console.log(`${competition}`);
    for (const event of list) {
      console.log(`- ${fixtureLine(event, options)}`);
    }
  }
}

function printFlatFixtures(
  events: NormalizedEvent[],
  heading: string,
  options: FixtureOptions = {},
): void {
  console.log(heading);
  if (events.length === 0) {
    console.log(options.emptyMessage || "No fixtures.");
    return;
  }
  const sorted = [...events].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
  );
  for (const event of sorted) {
    console.log(`- ${fixtureLine(event, options)}`);
  }
}

function normalizeText(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function slugifyTeam(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function teamUrnFromQuery(query: string): string {
  if (String(query || "").startsWith("urn:bbc:sportsdata:football:team:")) {
    return query;
  }
  const slug = slugifyTeam(query);
  return `urn:bbc:sportsdata:football:team:${slug}`;
}

function urnSlug(urn: unknown): string {
  if (!urn) return "";
  const parts = String(urn).split(":");
  return parts[parts.length - 1] || "";
}

function normalizeEvent(raw: ApiEvent): NormalizedEvent {
  const home = raw.homeTeam || raw.home;
  const away = raw.awayTeam || raw.away;
  return {
    ...raw,
    startTime: raw.startTime || raw.startDateTime || "",
    eventStatusNote:
      raw.eventStatusNote ||
      raw.statusComment?.value ||
      raw.periodLabel?.value ||
      raw.status ||
      raw.statusText ||
      "",
    homeTeam: {
      ...home,
      key: home?.key || home?.id || home?.urn || "",
      name: {
        abbreviation:
          home?.name?.abbreviation || home?.name?.shortName || home?.shortName || home?.fullName || "",
        shortName: home?.name?.shortName || home?.shortName || "",
        fullName: home?.name?.fullName || home?.fullName || "",
      },
      urn: home?.urn || "",
    },
    awayTeam: {
      ...away,
      key: away?.key || away?.id || away?.urn || "",
      name: {
        abbreviation: away?.name?.abbreviation || away?.name?.shortName || away?.shortName || away?.fullName,
        shortName: away?.name?.shortName || away?.shortName || "",
        fullName: away?.name?.fullName || away?.fullName || "",
      },
      urn: away?.urn || "",
    },
    participants: raw.participants || [],
  };
}

function flattenEvents(matchData: ApiLegacyTournament[]): NormalizedEvent[] {
  const events: NormalizedEvent[] = [];
  for (const tournament of matchData || []) {
    const dateMap = tournament.tournamentDatesWithEvents || {};
    for (const slotList of Object.values(dateMap)) {
      for (const slot of slotList || []) {
        for (const event of slot.events || []) {
          events.push(normalizeEvent(event));
        }
      }
    }
  }
  events.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  return events;
}

function flattenEventsFromContainer(root: unknown): NormalizedEvent[] {
  const events: NormalizedEvent[] = [];
  const stack: unknown[] = [root];
  while (stack.length > 0) {
    const node = stack.pop();
    if (Array.isArray(node)) {
      for (const item of node) stack.push(item);
      continue;
    }
    if (!node || typeof node !== "object") continue;
    const n = node as JsonRecord;

    if ((n.home || n.homeTeam) && (n.away || n.awayTeam) && (n.startTime || n.startDateTime)) {
      events.push(normalizeEvent(n as ApiEvent));
    }

    for (const value of Object.values(n)) {
      if (value && typeof value === "object") {
        stack.push(value);
      }
    }
  }
  events.sort(
    (a, b) =>
      new Date(a.startTime || a.startDateTime).getTime() -
      new Date(b.startTime || b.startDateTime).getTime(),
  );
  return events;
}

async function fetchMatchData(url: string, dayYmd?: string): Promise<NormalizedEvent[]> {
  const refDate = dayYmd || toYmd(new Date());
  const data = await fetchBbcJson<ApiResponse>(url, refDate, "football");
  const batchShape = data?.payload?.[0]?.body?.matchData;
  if (batchShape) return flattenEvents(batchShape);
  return flattenEventsFromContainer(data);
}

function parseArgs(argv: string[]): ParseResult {
  const args = argv.slice(2);
  if (args[0] === "--help" || args[0] === "-h") {
    return { help: true };
  }

  if (args.length === 0) {
    return { day: toYmd(new Date()) };
  }

  if (args.length > 1) {
    throw new Error("Pass either a date (YYYY-MM-DD) or a single team value.");
  }

  const input = args[0];
  const dayParsers: Array<(value: string) => Date | null> = [parseRelativeDayInput, parseYmd, parseDayMonthInput];
  for (const parser of dayParsers) {
    const parsed = parser(input);
    if (parsed) return { day: toYmd(parsed) };
  }

  const normalizedTeam = String(input || "").toLowerCase();
  const teamQueryBase = normalizedTeam;
  const teamQuery = TEAM_QUERY_ALIASES[teamQueryBase] || teamQueryBase;
  return { teamQuery, teamInput: input, teamUrn: teamUrnFromQuery(teamQuery) };
}

async function fixturesForDay(dayYmd: string): Promise<void> {
  const today = toYmd(new Date());
  const url = urlForDaysGames(today, dayYmd, dayYmd);
  const events = (await fetchMatchData(url, dayYmd)).filter(competitionAllowed);
  printGroupedFixtures(events, `Fixtures for ${dayYmd}`);
}

async function futureFixturesForTeam(teamQuery: string, teamInput: string, teamUrn: string): Promise<void> {
  const now = new Date();
  const twoWeeksAgo = new Date(now.getTime() - 14 * DAY_MS);
  const start = toYmd(twoWeeksAgo);
  const end = toYmd(new Date(now.getTime() + 30 * DAY_MS));
  const url = urlForTeamGames(start, end, start, teamUrn);
  const events = (await fetchMatchData(url, start)).filter((event) => {
    const dt = new Date(event.startTime || event.startDateTime);
    return dt.getTime() >= twoWeeksAgo.getTime();
  });

  printFlatFixtures(events, `Future fixtures for ${teamInput || teamQuery}`, {
    includeDate: true,
    showCompetitionTag: true,
    emptyMessage: "No fixtures in the last 14 days or next 30 days.",
  });
}

async function main(): Promise<void> {
  try {
    const parsed = parseArgs(process.argv);
    if ("help" in parsed && parsed.help) {
      usage();
      return;
    }
    if ("day" in parsed) {
      await fixturesForDay(parsed.day);
      return;
    }
    if ("teamQuery" in parsed) {
      await futureFixturesForTeam(parsed.teamQuery, parsed.teamInput, parsed.teamUrn);
      return;
    }
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
