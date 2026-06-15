import { fetchBbcJson, toYmd } from "../bbc";

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
const ANSI_BRIGHT_GREEN = "\x1b[92m";
const ANSI_BRIGHT_RED = "\x1b[91m";
const ANSI_BG_CLARET = "\x1b[48;5;88m";
const ANSI_VILLA_BLUE = "\x1b[38;5;39m";
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
  return highlightAstonVilla(base);
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
  if (!shouldUseColor()) return name;
  if (role === "win") return `${isLive ? ANSI_BRIGHT_GREEN : ANSI_DARK_GREEN}${name}${ANSI_RESET}`;
  if (role === "loss") return `${isLive ? ANSI_BRIGHT_RED : ANSI_DARK_RED}${name}${ANSI_RESET}`;
  return name;
}

function fixtureLine(event: NormalizedEvent): string {
  const home = teamLabel(event.homeTeam);
  const away = teamLabel(event.awayTeam);
  const statusLabel = event.eventStatusNote || event.statusText || "scheduled";
  const competitionTag = competitionLabel(event);
  const homeScore = teamScore(event.homeTeam, event);
  const awayScore = teamScore(event.awayTeam, event);
  const hasScore = homeScore != null && awayScore != null;
  const isLive = isResultState(event) && !isFinishedState(event);
  const time = eventTime(event);
  const isScheduled = normalizeText(statusLabel) === "scheduled";
  const liveStatusLabel = shouldUseColor() && isLive ? `${ANSI_BLUE}${statusLabel}${ANSI_RESET}` : statusLabel;
  const suffix = `(${competitionTag}) ${isScheduled ? "" : `(${liveStatusLabel})`}`.trim();

  if (isResultState(event) && hasScore) {
    const homeN = scoreNumber(homeScore);
    const awayN = scoreNumber(awayScore);
    let homeDisplay = home;
    let awayDisplay = away;
    if (homeN != null && awayN != null && homeN !== awayN) {
      homeDisplay = colorTeamName(home, homeN > awayN ? "win" : "loss", isLive);
      awayDisplay = colorTeamName(away, awayN > homeN ? "win" : "loss", isLive);
    }
    return `${time} ${homeDisplay} ${homeScore}-${awayScore} ${awayDisplay} ${suffix}`.trim();
  }
  return `${time} ${home} vs ${away} ${suffix}`.trim();
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

export function footballStatusSectionLines(events: NormalizedEvent[]): string[] {
  if (events.length === 0) return ["none today"];
  return [...events]
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    .map((event) => fixtureLine(event));
}

export async function loadFootballStatusLines(ymd: string): Promise<string[]> {
  const events = await fetchTodayFootballFixtures(ymd);
  return footballStatusSectionLines(events);
}
