import { fetchBbcJson, toYmd } from "../bbc";
import { readPhoneCliConfig } from "../config";
import { matchEventLines } from "./ballEvents";

type JsonRecord = Record<string, unknown>;
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

const DAY_MS = 24 * 60 * 60 * 1000;
const STATUS_FORWARD_DAYS = 59;

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

const BBC_BASE_URL =
  "https://www.bbc.co.uk/wc-data/container/sport-data-scores-fixtures";
const ANSI_RESET = "\x1b[0m";
const ANSI_DARK_GREEN = "\x1b[32m";
const ANSI_DARK_RED = "\x1b[31m";
const ANSI_DARK_YELLOW = "\x1b[33m";
const ANSI_PALE_YELLOW = "\x1b[38;5;227m";
const ANSI_BRIGHT_GREEN = "\x1b[92m";
const ANSI_BRIGHT_RED = "\x1b[91m";
const ANSI_BG_CLARET = "\x1b[48;5;88m";
const ANSI_VILLA_BLUE = "\x1b[38;5;39m";
const ANSI_PURPLE = "\x1b[35m";
const ANSI_BLUE = "\x1b[94m";

const urlForDaysGames = (today: string, end: string, start: string): string =>
  `${BBC_BASE_URL}?selectedEndDate=${end}&selectedStartDate=${start}&todayDate=${today}&urn=${encodeURIComponent("urn:bbc:sportsdata:football:tournament-collection:collated")}`;

function normalizeText(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function urnSlug(urn: unknown): string {
  if (!urn) return "";
  const parts = String(urn).split(":");
  return parts[parts.length - 1] || "";
}

function shouldUseColor(): boolean {
  return Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
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

function isVillaFixtureEvent(event: NormalizedEvent, now = new Date()): boolean {
  const startMs = new Date(event.startTime || event.startDateTime).getTime();
  if (!Number.isNaN(startMs) && startMs > now.getTime()) {
    return true;
  }
  return !isResultState(event);
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

function scoreNumber(score: string | null): number | null {
  if (score == null) return null;
  const parsed = Number.parseInt(String(score), 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function colorTeamName(name: string, role: "win" | "loss" | "draw", isLive: boolean): string {
  if (isAstonVillaName(name)) return highlightAstonVilla(name);
  if (isEnglandName(name)) return highlightEngland(name);
  if (!shouldUseColor()) return name;
  if (role === "win") return `${isLive ? ANSI_DARK_GREEN : ANSI_BRIGHT_GREEN}${name}${ANSI_RESET}`;
  if (role === "loss") return `${isLive ? ANSI_DARK_RED : ANSI_BRIGHT_RED}${name}${ANSI_RESET}`;
  return `${isLive ? ANSI_DARK_YELLOW : ANSI_PALE_YELLOW}${name}${ANSI_RESET}`;
}

function fixtureLine(event: NormalizedEvent): string {
  const home = teamLabel(event.homeTeam);
  const away = teamLabel(event.awayTeam);
  const statusLabel = event.eventStatusNote || event.statusText || "scheduled";
  const homeScore = teamScore(event.homeTeam, event);
  const awayScore = teamScore(event.awayTeam, event);
  const hasScore = homeScore != null && awayScore != null;
  const isLive = isResultState(event) && !isFinishedState(event);
  const time = eventTime(event);
  const isScheduled = normalizeText(statusLabel) === "scheduled";
  const liveStatusLabel = shouldUseColor() && isLive ? `${ANSI_BLUE}${statusLabel}${ANSI_RESET}` : statusLabel;
  const suffix = isScheduled ? "" : `(${liveStatusLabel})`;
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
    return `${time} ${homeDisplay} ${homeScore}-${awayScore} ${awayDisplay}${suffixWithSpace}`.trim();
  }
  return `${time} ${home} vs ${away}${suffixWithSpace}`.trim();
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

export async function fetchTodayFootballFixtures(ymd: string): Promise<NormalizedEvent[]> {
  const today = toYmd(new Date());
  const url = urlForDaysGames(today, ymd, ymd);
  return (await fetchMatchData(url, ymd)).filter(competitionAllowed);
}

function statusDayRows(todayYmd: string): { relative: string; ymd: string }[] {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(todayYmd);
  if (!m) return [{ relative: "today", ymd: todayYmd }];
  const y = Number.parseInt(m[1], 10);
  const mo = Number.parseInt(m[2], 10) - 1;
  const d = Number.parseInt(m[3], 10);
  const today = new Date(Date.UTC(y, mo, d));
  const rows: { relative: string; ymd: string }[] = [
    { relative: "yesterday", ymd: toYmd(new Date(today.getTime() - DAY_MS)) },
    { relative: "today", ymd: todayYmd },
    { relative: "tomorrow", ymd: toYmd(new Date(today.getTime() + DAY_MS)) },
  ];
  for (let offset = 2; offset <= STATUS_FORWARD_DAYS; offset += 1) {
    rows.push({
      relative: "",
      ymd: toYmd(new Date(today.getTime() + offset * DAY_MS)),
    });
  }
  return rows;
}

function isFootballDayHeading(line: string): boolean {
  return line.startsWith("== ") && line.endsWith(" ==");
}

function splitFootballDaySections(lines: string[]): string[][] {
  const sections: string[][] = [];
  let current: string[] = [];
  for (const line of lines) {
    if (isFootballDayHeading(line)) {
      if (current.length > 0) sections.push(current);
      current = [line];
      continue;
    }
    if (line === "" && current.length === 0) continue;
    current.push(line);
  }
  if (current.length > 0) sections.push(current);
  return sections;
}

export function fitFootballStatusLines(lines: string[], maxContentLines: number): string[] {
  if (maxContentLines <= 0) return [];
  if (lines.length <= maxContentLines) return lines;

  const sections = splitFootballDaySections(lines);
  const fitted: string[] = [];
  for (const section of sections) {
    const needed = section.length + (fitted.length > 0 ? 1 : 0);
    if (fitted.length + needed > maxContentLines) break;
    if (fitted.length > 0) fitted.push("");
    fitted.push(...section);
  }
  return fitted.length > 0 ? fitted : lines.slice(0, maxContentLines);
}

function formatStatusDayHeading(relative: string, ymd: string): string {
  if (relative === "yesterday") return "== Yesterday ==";
  if (relative === "today") return "== Today ==";
  if (relative === "tomorrow") return "== Tomorrow ==";
  return `== ${formatYmdLondonShort(ymd)} ==`;
}

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
  return `${weekday} ${String(d).padStart(2, "0")}/${String(mo + 1).padStart(2, "0")}`;
}

function eventLondonYmd(event: NormalizedEvent): string {
  const d = new Date(event.startTime || event.startDateTime);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-CA", { timeZone: "Europe/London" });
}

async function fetchFootballFixturesRange(startYmd: string, endYmd: string): Promise<NormalizedEvent[]> {
  const today = toYmd(new Date());
  const url = urlForDaysGames(today, endYmd, startYmd);
  return (await fetchMatchData(url, today)).filter(competitionAllowed);
}

function groupedFootballLines(events: NormalizedEvent[]): string[] {
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

  const lines: string[] = [];
  for (const [competition, list] of sortedGroups) {
    list.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    lines.push(competition);
    for (const event of list) {
      lines.push(`- ${fixtureLine(event)}`);
      if (isResultState(event)) {
        lines.push(...matchEventLines(event.homeTeam, event.awayTeam, "    "));
      }
    }
  }
  return lines;
}

export function footballStatusSectionLines(events: NormalizedEvent[]): string[] {
  if (events.length === 0) return ["none"];
  return groupedFootballLines(events);
}

function footballStatusLinesFromDays(
  days: { relative: string; ymd: string }[],
  eventsByDay: Map<string, NormalizedEvent[]>,
): string[] {
  const lines: string[] = [];
  let anyEvents = false;

  for (const { relative, ymd } of days) {
    const dayEvents = eventsByDay.get(ymd) || [];
    if (dayEvents.length === 0) continue;
    anyEvents = true;
    if (lines.length > 0) lines.push("");
    lines.push(formatStatusDayHeading(relative, ymd));
    lines.push(...groupedFootballLines(dayEvents));
  }

  return anyEvents ? lines : ["none"];
}

export async function loadFootballStatusLines(todayYmd: string): Promise<string[]> {
  const days = statusDayRows(todayYmd);
  const events = await fetchFootballFixturesRange(days[0].ymd, days[days.length - 1].ymd);

  const eventsByDay = new Map<string, NormalizedEvent[]>();
  for (const day of days) eventsByDay.set(day.ymd, []);

  for (const event of events) {
    const ymd = eventLondonYmd(event);
    const bucket = eventsByDay.get(ymd);
    if (bucket) bucket.push(event);
  }

  return footballStatusLinesFromDays(days, eventsByDay);
}

export const ASTON_VILLA_TEAM_URN = "urn:bbc:sportsdata:football:team:aston-villa";

const PL_STANDINGS_URL = "https://premier-league-standings1.p.rapidapi.com/";
const PL_RAPID_HOST = "premier-league-standings1.p.rapidapi.com";

const urlForTeamGames = (
  today: string,
  end: string,
  start: string,
  teamUrn: string,
): string =>
  `${BBC_BASE_URL}?selectedEndDate=${end}&selectedStartDate=${start}&todayDate=${today}&urn=${encodeURIComponent(teamUrn)}`;

function startOfMostRecentAugust(reference = new Date()): Date {
  const y = reference.getFullYear();
  const augustThisYear = new Date(Date.UTC(y, 7, 1));
  if (reference.getTime() >= augustThisYear.getTime()) return augustThisYear;
  return new Date(Date.UTC(y - 1, 7, 1));
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
      firstValue(rec, ["team.name", "team.shortName", "team.abbreviation"]) ??
      firstValue(rec, ["team", "teamName", "name", "club", "team.name", "team.shortName"]);
    const team = highlightAstonVilla(asString(teamRaw));
    if (!team) continue;

    const pos = asNumber(firstValue(rec, ["position", "rank", "pos", "place"])) ?? normalized.length + 1;
    const played =
      asNumber(firstValue(rec, ["played", "playedGames", "matches", "p", "mp", "stats.gamesPlayed"])) ?? 0;
    const won = asNumber(firstValue(rec, ["won", "wins", "w", "stats.wins"])) ?? 0;
    const draw =
      asNumber(firstValue(rec, ["drawn", "draw", "draws", "d", "ties", "stats.ties", "stats.draws"])) ?? 0;
    const lost =
      asNumber(firstValue(rec, ["lost", "losses", "l", "stats.losses", "stats.lost"])) ?? 0;
    const gd =
      asNumber(firstValue(rec, ["goalDifference", "gd", "goalsDiff", "stats.goalDifference"])) ?? 0;
    const points = asNumber(firstValue(rec, ["points", "pts", "stats.points"])) ?? 0;
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

function formatCompactPlRow(pos: string, team: string, gd: string, pts: string): string {
  const gdNum = Number(gd);
  const gdLabel = Number.isFinite(gdNum) && gdNum >= 0 ? `+${gd}` : gd;
  return `${pos.padStart(2)} ${team} ${pts} (${gdLabel})`;
}

function premierLeagueTableStatusLines(rows: string[][]): string[] {
  return rows.map(([pos, team, , , , , gd, pts]) => formatCompactPlRow(pos, team, gd, pts));
}

function formatFixtureDate(isoDateTime: string): string {
  const d = new Date(isoDateTime);
  if (Number.isNaN(d.getTime())) return "???";
  const weekday = d.toLocaleDateString("en-GB", { weekday: "short", timeZone: "Europe/London" });
  const day = d.toLocaleDateString("en-GB", { day: "2-digit", timeZone: "Europe/London" });
  const month = d.toLocaleDateString("en-GB", { month: "2-digit", timeZone: "Europe/London" });
  const dayName = weekday.charAt(0).toUpperCase() + weekday.slice(1).toLowerCase();
  return `${dayName} ${day}/${month}`;
}

function villaFixtureStatusLine(event: NormalizedEvent): string {
  const date = formatFixtureDate(event.startTime || event.startDateTime);
  const comp = competitionLabel(event);
  return `- ${date} ${fixtureLine(event)} (${comp})`;
}

export const VILLA_RESULTS_HEADING = "== Results ==";
export const VILLA_FIXTURES_HEADING = "== Fixtures ==";

export function splitVillaStatusSections(lines: string[]): { results: string[]; fixtures: string[] } {
  const results: string[] = [];
  const fixtures: string[] = [];
  let section: "results" | "fixtures" | null = null;
  for (const line of lines) {
    if (line === VILLA_RESULTS_HEADING) {
      section = "results";
      continue;
    }
    if (line === VILLA_FIXTURES_HEADING) {
      section = "fixtures";
      continue;
    }
    if (line === "" || line.startsWith("===")) continue;
    if (section === "results") results.push(line);
    else if (section === "fixtures") fixtures.push(line);
  }
  return { results, fixtures };
}

function allocateVillaSectionLines(
  results: string[],
  fixtures: string[],
  maxItemLines: number,
): { results: string[]; fixtures: string[] } {
  if (maxItemLines <= 0) return { results: [], fixtures: [] };
  if (results.length + fixtures.length <= maxItemLines) {
    return { results, fixtures };
  }

  let resultsBudget = Math.floor(maxItemLines / 2);
  let fixturesBudget = maxItemLines - resultsBudget;
  let fittedResults = results.slice(-resultsBudget);
  let fittedFixtures = fixtures.slice(0, fixturesBudget);

  const resultsShortfall = resultsBudget - fittedResults.length;
  if (resultsShortfall > 0) {
    fittedFixtures = fixtures.slice(0, fixturesBudget + resultsShortfall);
  }
  const fixturesShortfall = fixturesBudget - fittedFixtures.length;
  if (fixturesShortfall > 0) {
    fittedResults = results.slice(-(resultsBudget + fixturesShortfall));
  }

  return { results: fittedResults, fixtures: fittedFixtures };
}

export function fitVillaStatusLines(lines: string[], maxContentLines: number): string[] {
  if (maxContentLines <= 0) return [];
  if (lines.length <= maxContentLines) return lines;

  const { results, fixtures } = splitVillaStatusSections(lines);
  const hasResults = results.length > 0;
  const hasFixtures = fixtures.length > 0;
  if (!hasResults && !hasFixtures) {
    return lines.slice(0, maxContentLines);
  }
  if (!hasResults) {
    return fitPanelContentLines([VILLA_FIXTURES_HEADING, "", ...fixtures], maxContentLines);
  }
  if (!hasFixtures) {
    return fitPanelContentLines([VILLA_RESULTS_HEADING, "", ...results], maxContentLines);
  }

  const sectionOverhead = 5;
  const maxItemLines = maxContentLines - sectionOverhead;
  if (maxItemLines <= 0) {
    return [VILLA_RESULTS_HEADING, "", VILLA_FIXTURES_HEADING];
  }

  const fitted = allocateVillaSectionLines(results, fixtures, maxItemLines);
  const output = [VILLA_RESULTS_HEADING, "", ...fitted.results, "", VILLA_FIXTURES_HEADING, "", ...fitted.fixtures];
  if (output.length <= maxContentLines) return output;
  return output.slice(0, maxContentLines);
}

function readRapidApiKey(): string {
  const config = readPhoneCliConfig();
  const ballConfig = config.ball || {};
  return String(
    ballConfig.rapidApiKey ||
      ballConfig.rapidapiKey ||
      ballConfig.plRapidApiKey ||
      process.env.RAPIDAPI_KEY ||
      "",
  ).trim();
}

export function fitPanelContentLines(lines: string[], maxContentLines: number): string[] {
  if (maxContentLines <= 0) return [];
  if (lines.length <= maxContentLines) return lines;
  return lines.slice(0, maxContentLines);
}

export async function loadPremierLeagueTableStatusLines(): Promise<string[]> {
  const rapidApiKey = readRapidApiKey();
  if (!rapidApiKey) return ["-"];

  try {
    const response = await fetch(PL_STANDINGS_URL, {
      headers: {
        "Content-Type": "application/json",
        "x-rapidapi-host": PL_RAPID_HOST,
        "x-rapidapi-key": rapidApiKey,
      },
    });
    if (!response.ok) return ["-"];
    const payload = (await response.json()) as unknown;
    const rows = normalizePlRows(payload);
    if (rows.length === 0) return ["-"];
    return premierLeagueTableStatusLines(rows);
  } catch {
    return ["-"];
  }
}

export async function loadVillaFixturesStatusLines(): Promise<string[]> {
  try {
    const now = new Date();
    const seasonStart = startOfMostRecentAugust(now);
    const start = toYmd(seasonStart);
    const end = toYmd(new Date(now.getTime() + STATUS_FORWARD_DAYS * DAY_MS));
    const url = urlForTeamGames(start, end, start, ASTON_VILLA_TEAM_URN);
    const events = (await fetchMatchData(url, start)).filter((event) => {
      const dt = new Date(event.startTime || event.startDateTime);
      return dt.getTime() >= seasonStart.getTime();
    });
    if (events.length === 0) return ["none"];
    events.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    const results: NormalizedEvent[] = [];
    const fixtures: NormalizedEvent[] = [];
    for (const event of events) {
      if (isVillaFixtureEvent(event, now)) {
        fixtures.push(event);
      } else {
        results.push(event);
      }
    }
    const lines: string[] = [];
    if (results.length > 0) {
      lines.push(VILLA_RESULTS_HEADING, "");
      for (const event of results) {
        lines.push(villaFixtureStatusLine(event));
      }
    }
    if (fixtures.length > 0) {
      if (lines.length > 0) lines.push("");
      lines.push(VILLA_FIXTURES_HEADING, "");
      for (const event of fixtures) {
        lines.push(villaFixtureStatusLine(event));
      }
    }
    return lines.length > 0 ? lines : ["none"];
  } catch {
    return ["-"];
  }
}
