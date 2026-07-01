#!/usr/bin/env node

import { fetchBbcJson, toYmd } from "./bbc";
import { getConfigPath, readPhoneCliConfig } from "./config";
import { matchEventLines } from "./lib/ballEvents";

type JsonRecord = Record<string, unknown>;
type FixtureOptions = {
  includeDate?: boolean;
  showCompetitionTag?: boolean;
  emptyMessage?: string;
  teamUrn?: string;
};
type TeamVenueRecord = {
  comp: string;
  venue: "H" | "A";
  wins: number;
  draws: number;
  losses: number;
};
type ParseResult =
  | { help: true }
  | { keyword: "pl" }
  | { defaultThreeDays: true }
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

type ApiActionDetail = {
  type?: string;
  timeLabel?: { value?: string };
};

type ApiPlayerAction = {
  playerName?: string;
  actionType?: string;
  actions?: ApiActionDetail[];
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
  actions?: ApiPlayerAction[];
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
  "worldcup",
  "fifaworldcup",
]);
const COMPETITION_ORDER = [
  "FIFA World Cup",
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
const PL_STANDINGS_URL = "https://premier-league-standings1.p.rapidapi.com/";
const PL_RAPID_HOST = "premier-league-standings1.p.rapidapi.com";
const ANSI_RESET = "\x1b[0m";
const ANSI_DARK_GREEN = "\x1b[32m";
const ANSI_DARK_RED = "\x1b[31m";
const ANSI_DARK_YELLOW = "\x1b[33m";
const ANSI_PALE_YELLOW = "\x1b[38;5;227m";
const ANSI_BRIGHT_GREEN = "\x1b[92m";
const ANSI_BRIGHT_RED = "\x1b[91m";
const ANSI_CLARET = "\x1b[38;5;88m";
const ANSI_BG_CLARET = "\x1b[48;5;88m";
const ANSI_VILLA_BLUE = "\x1b[38;5;39m";
const ANSI_PURPLE = "\x1b[35m";
const ANSI_ORANGE = "\x1b[38;5;208m";
const ANSI_BLUE = "\x1b[94m";
const ANSI_REGEX = /\x1b\[[0-9;]*m/g;

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
  console.log("  ball   (yesterday, then tomorrow, then today)");
  console.log("  ball pl");
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

/** 1 August of the current season window (Aug–Jul), in Europe/London. */
function startOfMostRecentAugust(reference = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "numeric",
  }).formatToParts(reference);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const augustYear = month >= 8 ? year : year - 1;
  return parseYmd(`${augustYear}-08-01`) ?? new Date(`${augustYear}-08-01T00:00:00Z`);
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

/** Same calendar “today” as `parseRelativeDayInput`; order: yesterday, tomorrow, today. */
function defaultThreeDayRows(): readonly { relative: "yesterday" | "tomorrow" | "today"; ymd: string }[] {
  const now = new Date();
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const yesterday = new Date(today.getTime() - DAY_MS);
  const tomorrow = new Date(today.getTime() + DAY_MS);
  return [
    { relative: "yesterday", ymd: toYmd(yesterday) },
    { relative: "tomorrow", ymd: toYmd(tomorrow) },
    { relative: "today", ymd: toYmd(today) },
  ];
}

/** en-GB “short” weekday plus DD/MM for a YYYY-MM-DD in Europe/London. */
const WEEKDAY_HEADING_SPELLING: Partial<Record<string, string>> = {
  Tue: "Tues",
  Thu: "Thurs",
};

function formatYmdLondonShort(dayYmd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayYmd);
  if (!m) return dayYmd;
  const y = Number.parseInt(m[1], 10);
  const mo = Number.parseInt(m[2], 10) - 1;
  const d = Number.parseInt(m[3], 10);
  const date = new Date(Date.UTC(y, mo, d, 12, 0, 0));
  const weekday = date.toLocaleDateString("en-GB", {
    weekday: "short",
    timeZone: "Europe/London",
  });
  const dayNum = date.toLocaleDateString("en-GB", { day: "2-digit", timeZone: "Europe/London" });
  const monthNum = date.toLocaleDateString("en-GB", { month: "2-digit", timeZone: "Europe/London" });
  const cap = weekday.charAt(0).toUpperCase() + weekday.slice(1).toLowerCase();
  const wday = WEEKDAY_HEADING_SPELLING[cap] ?? cap;
  return `${wday} ${dayNum}/${monthNum}`;
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

function formatPrintedAtTimestamp(date: Date = new Date()): string {
  const weekday = date.toLocaleDateString("en-GB", {
    weekday: "short",
    timeZone: "Europe/London",
  });
  const day = date.toLocaleDateString("en-GB", { day: "2-digit", timeZone: "Europe/London" });
  const month = date.toLocaleDateString("en-GB", { month: "2-digit", timeZone: "Europe/London" });
  const time = date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/London",
  });
  const dayName = weekday.charAt(0).toUpperCase() + weekday.slice(1).toLowerCase();
  return `${dayName} ${day}/${month} ${time}`;
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
  const base = (
    team?.name?.shortName ||
    team?.shortName ||
    team?.name?.abbreviation ||
    team?.name?.fullName ||
    team?.fullName ||
    team?.key ||
    "unknown-team"
  );
  return highlightEngland(highlightAstonVilla(base));
}

function isAstonVillaName(name: string): boolean {
  const n = normalizeText(name);
  return n === "astonvilla" || n === "avfc" || n === "avl";
}

function highlightAstonVilla(name: string): string {
  if (!shouldUseColor() || !isAstonVillaName(name)) return name;
  return `${ANSI_BG_CLARET}${ANSI_VILLA_BLUE}AVFC${ANSI_RESET}`;
}

function isEnglandName(name: string): boolean {
  const n = normalizeText(name);
  return n === "england" || n === "eng";
}

function highlightEngland(name: string): string {
  if (!shouldUseColor() || !isEnglandName(name)) return name;
  return `${ANSI_PURPLE}${name}${ANSI_RESET}`;
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
  if (isAstonVillaName(name)) return highlightAstonVilla(name);
  if (isEnglandName(name)) return highlightEngland(name);
  if (!shouldUseColor()) return name;
  if (role === "win") return `${isLive ?  ANSI_DARK_GREEN : ANSI_BRIGHT_GREEN}${name}${ANSI_RESET}`;
  if (role === "loss") return `${isLive ? ANSI_DARK_RED : ANSI_BRIGHT_RED}${name}${ANSI_RESET}`;
  return `${isLive ?  ANSI_DARK_YELLOW : ANSI_PALE_YELLOW}${name}${ANSI_RESET}`;
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
  const isLive = isResultState(event) && !isFinishedState(event);
  const time = eventTime(event);
  const timeDisplay = time;
  const isScheduled = normalizeText(statusLabel) === "scheduled";
  const liveStatusLabel = shouldUseColor() && isLive ? `${ANSI_BLUE}${statusLabel}${ANSI_RESET}` : statusLabel;
  const suffix = showCompetitionTag ? `(${competitionTag})` : isScheduled ? "" : `(${liveStatusLabel})`;
  const suffixWithSpace = suffix ? ` ${suffix}` : "";

  if (isResultState(event) && hasScore) {
    const homeN = scoreNumber(homeScore);
    const awayN = scoreNumber(awayScore);
    let homeDisplay = home;
    let awayDisplay = away;
    if (homeN != null && awayN != null) {
      if (homeN === awayN && (isLive || isFinishedState(event))) {
        homeDisplay = colorTeamName(home, "draw", isLive);
        awayDisplay = colorTeamName(away, "draw", isLive);
      } else if (homeN !== awayN) {
        homeDisplay = colorTeamName(home, homeN > awayN ? "win" : "loss", isLive);
        awayDisplay = colorTeamName(away, awayN > homeN ? "win" : "loss", isLive);
      }
    }
    return `${datePrefix}${timeDisplay} ${homeDisplay} ${homeScore}-${awayScore} ${awayDisplay}${suffixWithSpace}`;
  }
  return `${datePrefix}${timeDisplay} ${home} vs ${away}${suffixWithSpace}`;
}

function eventTeamSide(event: NormalizedEvent, teamUrn: string): "home" | "away" | null {
  const homeUrn = String(event.homeTeam?.urn || "");
  const awayUrn = String(event.awayTeam?.urn || "");
  if (homeUrn === teamUrn) return "home";
  if (awayUrn === teamUrn) return "away";
  const targetSlug = urnSlug(teamUrn);
  if (!targetSlug) return null;
  if (urnSlug(homeUrn) === targetSlug) return "home";
  if (urnSlug(awayUrn) === targetSlug) return "away";
  return null;
}

function teamResultOutcome(
  event: NormalizedEvent,
  side: "home" | "away",
): "win" | "draw" | "loss" | null {
  if (!isResultState(event) || !isFinishedState(event)) return null;
  const homeN = scoreNumber(teamScore(event.homeTeam, event));
  const awayN = scoreNumber(teamScore(event.awayTeam, event));
  if (homeN == null || awayN == null) return null;
  const ours = side === "home" ? homeN : awayN;
  const theirs = side === "home" ? awayN : homeN;
  if (ours > theirs) return "win";
  if (ours < theirs) return "loss";
  return "draw";
}

function buildTeamCompetitionRecords(events: NormalizedEvent[], teamUrn: string): TeamVenueRecord[] {
  const stats = new Map<string, TeamVenueRecord>();
  for (const event of events) {
    const side = eventTeamSide(event, teamUrn);
    if (!side) continue;
    const outcome = teamResultOutcome(event, side);
    if (!outcome) continue;

    const comp = competitionLabel(event);
    const venue: "H" | "A" = side === "home" ? "H" : "A";
    const key = `${comp}\0${venue}`;
    let row = stats.get(key);
    if (!row) {
      row = { comp, venue, wins: 0, draws: 0, losses: 0 };
      stats.set(key, row);
    }
    if (outcome === "win") row.wins += 1;
    else if (outcome === "draw") row.draws += 1;
    else row.losses += 1;
  }

  return [...stats.values()].sort((a, b) => {
    const aRank = COMPETITION_ORDER.findIndex((name) => normalizeText(name) === normalizeText(a.comp));
    const bRank = COMPETITION_ORDER.findIndex((name) => normalizeText(name) === normalizeText(b.comp));
    const aOrder = aRank === -1 ? Number.MAX_SAFE_INTEGER : aRank;
    const bOrder = bRank === -1 ? Number.MAX_SAFE_INTEGER : bRank;
    if (aOrder !== bOrder) return aOrder - bOrder;
    if (a.venue !== b.venue) return a.venue === "H" ? -1 : 1;
    return a.comp.localeCompare(b.comp);
  });
}

function printTeamCompetitionSummary(events: NormalizedEvent[], teamUrn: string): void {
  const records = buildTeamCompetitionRecords(events, teamUrn);
  if (records.length === 0) return;

  const rows = records.map((row) => [
    `${row.comp} (${row.venue})`,
    String(row.wins),
    String(row.draws),
    String(row.losses),
  ]);

  console.log("");
  console.log("Record by competition (finished matches)");
  for (const line of makeAsciiTable(["Comp", "W", "D", "L"], rows)) {
    console.log(line);
  }
}

function printFixtureEvents(event: NormalizedEvent): void {
  if (!isResultState(event)) return;
  for (const line of matchEventLines(event.homeTeam, event.awayTeam)) {
    console.log(line);
  }
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
      printFixtureEvents(event);
    }
  }
}

function printFlatFixtures(
  events: NormalizedEvent[],
  heading: string,
  options: FixtureOptions = {},
): void {
  console.log(heading);
  if (options.teamUrn) {
    printTeamCompetitionSummary(events, options.teamUrn);
  }
  if (events.length === 0) {
    console.log(options.emptyMessage || "No fixtures.");
    return;
  }
  const sorted = [...events].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
  );
  for (const event of sorted) {
    console.log(`- ${fixtureLine(event, options)}`);
    printFixtureEvents(event);
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

function padCell(value: string, width: number): string {
  const visible = value.replace(ANSI_REGEX, "").length;
  return value + " ".repeat(Math.max(0, width - visible));
}

function makeAsciiTable(headers: string[], rows: string[][]): string[] {
  const widths = headers.map((header, idx) =>
    Math.max(
      header.replace(ANSI_REGEX, "").length,
      ...rows.map((row) => (row[idx] || "").replace(ANSI_REGEX, "").length),
    ),
  );
  const border = `+-${widths.map((w) => "-".repeat(w)).join("-+-")}-+`;
  const headerLine = `| ${headers.map((h, i) => padCell(h, widths[i])).join(" | ")} |`;
  const body = rows.map((row) => `| ${row.map((v, i) => padCell(v || "", widths[i])).join(" | ")} |`);
  return [border, headerLine, border, ...body, border];
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function valueByPath(record: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let cursor: unknown = record;
  for (const part of parts) {
    const rec = toRecord(cursor);
    if (!rec) return undefined;
    cursor = rec[part];
  }
  return cursor;
}

function firstValue(record: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    const v = key.includes(".") ? valueByPath(record, key) : record[key];
    if (v != null && v !== "") return v;
  }
  return undefined;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function asString(value: unknown): string {
  if (value == null) return "";
  return String(value);
}

function normalizePlRows(payload: unknown): string[][] {
  const rowsSource: unknown[] = Array.isArray(payload)
    ? payload
    : (() => {
        const rec = toRecord(payload);
        if (!rec) return [];
        const candidates = [
          rec.standings,
          rec.table,
          rec.data,
          rec.results,
          valueByPath(rec, "response.standings"),
          valueByPath(rec, "response.table"),
          valueByPath(rec, "response.data"),
        ];
        for (const c of candidates) {
          if (Array.isArray(c)) return c;
        }
        return [];
      })();

  const normalized: Array<{
    pos: number;
    team: string;
    played: number;
    won: number;
    draw: number;
    lost: number;
    gd: number;
    points: number;
  }> = [];

  for (const row of rowsSource) {
    const rec = toRecord(row);
    if (!rec) continue;
    const teamRaw =
      firstValue(rec, [
        "team.name",
        "team.shortName",
        "team.abbreviation",
      ]) ??
      firstValue(rec, [
        "team",
        "teamName",
        "name",
        "club",
        "team.name",
        "team.shortName",
      ]);
    const team = highlightAstonVilla(asString(teamRaw));
    if (!team) continue;

    const pos = asNumber(firstValue(rec, ["position", "rank", "pos", "place"])) ?? normalized.length + 1;
    const played = asNumber(firstValue(rec, [
      "played",
      "playedGames",
      "matches",
      "p",
      "mp",
      "stats.gamesPlayed",
    ])) ?? 0;
    const won = asNumber(firstValue(rec, [
      "won",
      "wins",
      "w",
      "stats.wins",
    ])) ?? 0;
    const draw = asNumber(firstValue(rec, [
      "drawn",
      "draw",
      "draws",
      "d",
      "ties",
      "stats.ties",
      "stats.draws",
    ])) ?? 0;
    const lost = asNumber(firstValue(rec, [
      "lost",
      "losses",
      "l",
      "stats.losses",
      "stats.lost",
    ])) ?? 0;
    const gd = asNumber(firstValue(rec, [
      "goalDifference",
      "gd",
      "goalsDiff",
      "stats.goalDifference",
    ])) ?? 0;
    const points = asNumber(firstValue(rec, [
      "points",
      "pts",
      "stats.points",
    ])) ?? 0;
    const rankFromStats = asNumber(firstValue(rec, ["stats.rank"]));
    const finalPos = rankFromStats ?? pos;

    normalized.push({ pos: finalPos, team, played, won, draw, lost, gd, points });
  }

  normalized.sort((a, b) => a.pos - b.pos);
  return normalized.map((r) => [
    String(r.pos),
    r.team,
    String(r.played),
    String(r.won),
    String(r.draw),
    String(r.lost),
    String(r.gd),
    String(r.points),
  ]);
}

async function printPremierLeagueTable(): Promise<void> {
  const config = readPhoneCliConfig();
  const ballConfig = config.ball || {};
  const rapidApiKey = String(
    ballConfig.rapidApiKey ||
      ballConfig.rapidapiKey ||
      ballConfig.plRapidApiKey ||
      process.env.RAPIDAPI_KEY ||
      "",
  ).trim();

  if (!rapidApiKey) {
    throw new Error(
      `Missing RapidAPI key. Set ball.rapidApiKey in ${getConfigPath()} or RAPIDAPI_KEY env var.`,
    );
  }

  const response = await fetch(PL_STANDINGS_URL, {
    headers: {
      "Content-Type": "application/json",
      "x-rapidapi-host": PL_RAPID_HOST,
      "x-rapidapi-key": rapidApiKey,
    },
  });
  if (!response.ok) {
    throw new Error(`Premier League table request failed (${response.status})`);
  }

  const payload = (await response.json()) as unknown;
  const rows = normalizePlRows(payload);
  if (rows.length === 0) {
    throw new Error("Premier League table response returned no rows.");
  }

  const heading = `Premier League Table (at ${formatPrintedAtTimestamp()})`;
  console.log(heading);
  for (const line of makeAsciiTable(["#", "Team", "P", "W", "D", "L", "GD", "Pts"], rows)) {
    console.log(line);
  }
}

function parseArgs(argv: string[]): ParseResult {
  const args = argv.slice(2);
  if (args[0] === "--help" || args[0] === "-h") {
    return { help: true };
  }

  if (args.length === 0) {
    return { defaultThreeDays: true };
  }

  if (args.length > 1) {
    throw new Error("Pass either a date (YYYY-MM-DD) or a single team value.");
  }

  const input = args[0];
  if (String(input).trim().toLowerCase() === "pl") {
    return { keyword: "pl" };
  }

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

async function fixturesForDay(
  dayYmd: string,
  relativeHeading?: "yesterday" | "tomorrow" | "today",
): Promise<void> {
  const today = toYmd(new Date());
  const url = urlForDaysGames(today, dayYmd, dayYmd);
  const events = (await fetchMatchData(url, dayYmd)).filter(competitionAllowed);
  const heading =
    relativeHeading !== undefined
      ? `${ANSI_ORANGE}=== Fixtures for ${relativeHeading} (${formatYmdLondonShort(dayYmd)}) ===${ANSI_RESET}`
      : `Fixtures for ${dayYmd} (at ${formatPrintedAtTimestamp()})`;
  if (relativeHeading !== undefined) {
    console.log("");
    console.log("");
  }
  printGroupedFixtures(events, heading);
}

async function futureFixturesForTeam(teamQuery: string, teamInput: string, teamUrn: string): Promise<void> {
  const now = new Date();
  const seasonStart = startOfMostRecentAugust(now);
  const start = toYmd(seasonStart);
  const end = toYmd(new Date(now.getTime() + 59 * DAY_MS));
  const url = urlForTeamGames(start, end, start, teamUrn);
  const events = (await fetchMatchData(url, start)).filter((event) => {
    const dt = new Date(event.startTime || event.startDateTime);
    return dt.getTime() >= seasonStart.getTime();
  });

  printFlatFixtures(events, `Future fixtures for ${teamInput || teamQuery} (at ${formatPrintedAtTimestamp()})`, {
    includeDate: true,
    showCompetitionTag: true,
    teamUrn,
    emptyMessage: `No fixtures since ${formatYmdLondonShort(start)} or in the next 30 days.`,
  });
}

async function main(): Promise<void> {
  try {
    const parsed = parseArgs(process.argv);
    if ("help" in parsed && parsed.help) {
      usage();
      return;
    }
    if ("defaultThreeDays" in parsed && parsed.defaultThreeDays) {
      for (const row of defaultThreeDayRows()) {
        await fixturesForDay(row.ymd, row.relative);
      }
      return;
    }
    if ("day" in parsed) {
      await fixturesForDay(parsed.day);
      return;
    }
    if ("keyword" in parsed && parsed.keyword === "pl") {
      await printPremierLeagueTable();
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
