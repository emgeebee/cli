import { fetchBbcJson } from "../bbc";

type CricketInnings = {
  runs?: number;
  wickets?: number;
  overs?: string;
  isDeclared?: boolean;
  inningsNumber?: number;
  innings_number?: number;
  number?: number;
  startDateTime?: string;
  start_date_time?: string;
};

type CricketTeam = {
  name?: string;
  shortName?: string;
  innings?: CricketInnings | CricketInnings[] | null;
};

type CricketParticipants = {
  homeTeam?: CricketTeam;
  awayTeam?: CricketTeam;
};

type CricketEvent = {
  startDateTime?: string;
  startTime?: string;
  tournamentName?: string;
  eventGroupingLabel?: string;
  groundShortName?: string;
  matchDateSummary?: {
    startDate?: string;
    endDate?: string;
  };
  matchSummary?: {
    resultString?: string;
  };
  participants?: CricketParticipants;
};

type CricketSecondaryGroup = {
  displayLabel?: string | null;
  events?: CricketEvent[];
};

type CricketEventGroup = {
  secondaryGroups?: CricketSecondaryGroup[];
};

export type CricketResponse = {
  eventGroups?: CricketEventGroup[];
};

const CRICKET_BASE_URL =
  "https://web-cdn.api.bbci.co.uk/wc-poll-data/container/sport-data-scores-fixtures";
const CRICKET_URN = "urn:bbc:sportsdata:cricket:tournament-collection:collated";
const DAY_MS = 24 * 60 * 60 * 1000;

function teamLabel(team: CricketTeam | undefined): string {
  return team?.shortName || team?.name || "TBC";
}

function asInningsList(team: CricketTeam | undefined): CricketInnings[] {
  const innings = team?.innings;
  if (!innings) return [];
  return Array.isArray(innings) ? innings : [innings];
}

function inningsScore(innings: CricketInnings): string {
  if (innings.runs == null) return "";
  const wickets = innings.wickets == null ? "-" : String(innings.wickets);
  const overs = innings.overs ? ` (${innings.overs})` : "";
  const declared = innings.isDeclared ? "d" : "";
  return `${innings.runs}/${wickets}${declared}${overs}`;
}

function inningsLine(
  team: CricketTeam | undefined,
  innings: CricketInnings | undefined,
  index: number,
): string {
  const label = teamLabel(team);
  const suffix = index > 0 ? ` (Inns ${index + 1})` : "";
  if (!innings) return `${label}${suffix}: -`;
  const score = inningsScore(innings);
  return `${label}${suffix}: ${score || "-"}`;
}

type TeamInningsLine = {
  team: CricketTeam | undefined;
  innings: CricketInnings;
  localIndex: number;
};

function inningsOrder(innings: CricketInnings): number | null {
  const maybe =
    innings.inningsNumber ??
    innings.innings_number ??
    innings.number;
  if (maybe == null) return null;
  const parsed = Number(maybe);
  return Number.isNaN(parsed) ? null : parsed;
}

function inningsStartTime(innings: CricketInnings): number | null {
  const raw = innings.startDateTime || innings.start_date_time;
  if (!raw) return null;
  const ts = new Date(raw).getTime();
  return Number.isNaN(ts) ? null : ts;
}

function orderedInningsLines(
  homeTeam: CricketTeam | undefined,
  awayTeam: CricketTeam | undefined,
): string[] {
  const entries: TeamInningsLine[] = [
    ...asInningsList(homeTeam).map((innings, idx) => ({ team: homeTeam, innings, localIndex: idx })),
    ...asInningsList(awayTeam).map((innings, idx) => ({ team: awayTeam, innings, localIndex: idx })),
  ];

  if (entries.length === 0) {
    return ["  -"];
  }

  entries.sort((a, b) => {
    const orderA = inningsOrder(a.innings);
    const orderB = inningsOrder(b.innings);
    if (orderA != null && orderB != null && orderA !== orderB) return orderA - orderB;
    if (orderA != null && orderB == null) return -1;
    if (orderA == null && orderB != null) return 1;

    const startA = inningsStartTime(a.innings);
    const startB = inningsStartTime(b.innings);
    if (startA != null && startB != null && startA !== startB) return startA - startB;
    if (startA != null && startB == null) return -1;
    if (startA == null && startB != null) return 1;

    if (a.localIndex !== b.localIndex) return a.localIndex - b.localIndex;
    return teamLabel(a.team).localeCompare(teamLabel(b.team));
  });

  return entries.map((entry) => `  ${inningsLine(entry.team, entry.innings, entry.localIndex)}`);
}

function normalizeText(value: string | undefined): string {
  return String(value || "").toLowerCase();
}

function competitionLabel(secondary: CricketSecondaryGroup, event: CricketEvent): string {
  return (
    secondary.displayLabel ||
    event.tournamentName ||
    event.eventGroupingLabel ||
    "Other"
  );
}

function isAllowedCompetition(label: string): boolean {
  const text = normalizeText(label);
  if (!text) return false;
  if (text.includes("women")) return false;

  const isCountyChampionship = text.includes("county championship");
  const isEnglishLeagueOrCup =
    (text.includes("league") || text.includes("cup")) &&
    (
      text.includes("england") ||
      text.includes("english") ||
      text.includes("county") ||
      text.includes("vitality blast") ||
      text.includes("one-day cup") ||
      text.includes("one day cup") ||
      text.includes("the hundred")
    );
  const isTest = text.includes("test");
  const isMensInternational =
    text.includes("international") ||
    text.includes("odi") ||
    text.includes("t20i") ||
    text.includes("world cup") ||
    text.includes("champions trophy") ||
    text.includes("ashes");

  return isCountyChampionship || isEnglishLeagueOrCup || isTest || isMensInternational;
}

function multiDayLabel(event: CricketEvent, selectedYmd: string): string {
  const start = event.matchDateSummary?.startDate;
  const end = event.matchDateSummary?.endDate;
  if (!start || !end || start === end) return "";

  const startDate = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);
  const selectedDate = new Date(`${selectedYmd}T00:00:00Z`);
  if (
    Number.isNaN(startDate.getTime()) ||
    Number.isNaN(endDate.getTime()) ||
    Number.isNaN(selectedDate.getTime())
  ) {
    return "";
  }
  if (selectedDate < startDate || selectedDate > endDate) return "";

  const dayNumber = Math.floor((selectedDate.getTime() - startDate.getTime()) / DAY_MS) + 1;
  return `Day ${dayNumber}`;
}

function fixtureHeaderLine(event: CricketEvent, ymd: string): string {
  const homeTeam = event.participants?.homeTeam;
  const awayTeam = event.participants?.awayTeam;
  const dayLabel = multiDayLabel(event, ymd);
  return [
    event.startTime || "??:??",
    `${teamLabel(homeTeam)} vs ${teamLabel(awayTeam)}`,
    event.groundShortName || "-",
    dayLabel || "-",
    event.matchSummary?.resultString || "-",
  ].join(" | ");
}

export function cricketStatusSectionLines(data: CricketResponse, ymd: string): string[] {
  const lines: string[] = [];
  let matchCount = 0;

  for (const group of data.eventGroups || []) {
    for (const secondary of group.secondaryGroups || []) {
      const events = [...(secondary.events || [])].sort((a, b) => {
        const aTime = new Date(a.startDateTime || "").getTime();
        const bTime = new Date(b.startDateTime || "").getTime();
        return aTime - bTime;
      });
      const allowedEvents = events.filter((event) =>
        isAllowedCompetition(competitionLabel(secondary, event)),
      );
      if (allowedEvents.length === 0) continue;

      if (lines.length > 0) {
        lines.push("");
      }
      lines.push(secondary.displayLabel || "Other");

      for (const event of allowedEvents) {
        matchCount += 1;
        const homeTeam = event.participants?.homeTeam;
        const awayTeam = event.participants?.awayTeam;
        lines.push(fixtureHeaderLine(event, ymd));
        lines.push(...orderedInningsLines(homeTeam, awayTeam));
        lines.push("");
      }
    }
  }

  if (matchCount === 0) {
    return ["none today"];
  }

  if (lines[lines.length - 1] === "") {
    lines.pop();
  }
  return lines;
}

export function cricketFixtureLines(data: CricketResponse, ymd: string): string[] {
  const lines = cricketStatusSectionLines(data, ymd);
  if (lines.length === 1 && lines[0] === "none today") {
    return lines;
  }
  return [`Cricket fixtures for ${ymd}`, "", ...lines];
}

export async function fetchTodayCricket(ymd: string): Promise<CricketResponse> {
  const url =
    `${CRICKET_BASE_URL}?selectedEndDate=${ymd}` +
    `&selectedStartDate=${ymd}` +
    `&todayDate=${ymd}` +
    `&urn=${encodeURIComponent(CRICKET_URN)}`;
  return fetchBbcJson<CricketResponse>(url, ymd, "cricket");
}

export async function loadCricketStatusLines(ymd: string): Promise<string[]> {
  const data = await fetchTodayCricket(ymd);
  return cricketStatusSectionLines(data, ymd);
}
