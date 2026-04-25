#!/usr/bin/env node

const TEAM_KEY_TO_SHORT = {
  TFBB1: "manu",
  TFBB2: "lee",
  TFBB3: "ars",
  TFBB4: "newc",
  TFBB5: "bburn",
  TFBB6: "tott",
  TFBB7: "avfc",
  TFBB8: "che",
  TFBB11: "eve",
  TFBB13: "lei",
  TFBB14: "liv",
  TFBB17: "nott",
  TFBB19: "shew",
  TFBB20: "sou",
  TFBB21: "whu",
  TFBB24: "der",
  TFBB25: "mbor",
  TFBB31: "cryp",
  TFBB33: "char",
  TFBB35: "wba",
  TFBB36: "bri",
  TFBB37: "barn",
  TFBB39: "wol",
  TFBB41: "bham",
  TFBB43: "manc",
  TFBB45: "norw",
  TFBB49: "shu",
  TFBB52: "qpr",
  TFBB54: "ful",
  TFBB57: "wat",
  TFBB80: "swan",
  TFBB88: "null",
  TFBB90: "burn",
  TFBB91: "bour",
  TFBB94: "bren",
  TFBB97: "card",
  TFBB102: "lut",
  TFBB103: "mill",
  TFBB107: "pres",
  TFBB108: "read",
  TFBB110: "sto",
  TFBB111: "wig",
  TFBB113: "bric",
};

const SHORT_TO_TEAM_KEY = Object.entries(TEAM_KEY_TO_SHORT).reduce(
  (acc, [k, v]) => {
    acc[v] = k;
    return acc;
  },
  {},
);

const DAY_MS = 24 * 60 * 60 * 1000;
const TEAM_QUERY_ALIASES = {
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
  // Common BBC naming/slugs.
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

const urlForDaysGames = (today, end, start) =>
  `${BBC_BASE_URL}?selectedEndDate=${end}&selectedStartDate=${start}&todayDate=${today}&urn=${encodeURIComponent("urn:bbc:sportsdata:football:tournament-collection:collated")}`;

const urlForTeamGames = (today, end, start, teamUrn) =>
  `${BBC_BASE_URL}?selectedEndDate=${end}&selectedStartDate=${start}&todayDate=${today}&urn=${encodeURIComponent(teamUrn)}`;

function usage() {
  console.log("Usage:");
  console.log("  ball --day YYYY-MM-DD");
  console.log("  ball --team TEAM");
  console.log("");
  console.log("Examples:");
  console.log("  ball --day 2026-04-25");
  console.log("  ball --team liv");
  console.log("  ball --team TFBB14");
}

function toYmd(date) {
  return date.toISOString().slice(0, 10);
}

function parseYmd(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  return toYmd(d) === value ? d : null;
}

function formatFixtureDate(isoDateTime) {
  const d = new Date(isoDateTime);
  if (Number.isNaN(d.getTime())) {
    return "unknown-date";
  }
  const weekday = d.toLocaleDateString("en-GB", {
    weekday: "short",
    timeZone: "Europe/London",
  });
  const day = d.toLocaleDateString("en-GB", {
    day: "2-digit",
    timeZone: "Europe/London",
  });
  const month = d.toLocaleDateString("en-GB", {
    month: "2-digit",
    timeZone: "Europe/London",
  });
  return `${weekday.toLowerCase()} ${day}/${month}`;
}

function eventTime(event) {
  const dateValue = event.startTime || event.startDateTime;
  if (!dateValue) {
    return "??:?? UK";
  }
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) {
    return "??:?? UK";
  }
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

function teamLabel(team) {
  return (
    TEAM_KEY_TO_SHORT[team.key] ||
    team.name?.abbreviation ||
    team.name?.shortName ||
    team.shortName ||
    team.name?.fullName ||
    team.fullName ||
    team.key
  );
}

function competitionLabel(event) {
  return (
    event.tournament?.disambiguatedName ||
    event.tournament?.name ||
    event.eventGroupingLabel ||
    "Other"
  );
}

function competitionAllowed(event) {
  const candidates = [
    event.tournament?.disambiguatedName,
    event.tournament?.name,
    urnSlug(event.tournament?.urn),
  ]
    .filter(Boolean)
    .map(normalizeText);

  return candidates.some((candidate) => COMPETITION_ALLOWLIST.has(candidate));
}

function teamScore(team, event) {
  const direct =
    team?.scores?.score ?? team?.runningScores?.score ?? team?.score ?? null;
  if (direct != null) {
    return String(direct);
  }
  const participant = (event.participants || []).find((p) => {
    return p.alignment === (team === event.homeTeam ? "home" : "away");
  });
  const participantScore =
    participant?.score ?? participant?.runningScore ?? null;
  return participantScore != null ? String(participantScore) : null;
}

function isResultState(event) {
  const status = String(event.status || "").toLowerCase();
  if (!status) {
    return false;
  }
  return status !== "preevent";
}

function isFinishedState(event) {
  const status = String(event.status || "").toLowerCase();
  if (status === "postevent") {
    return true;
  }
  const note = String(event.eventStatusNote || "").toLowerCase();
  return (
    note === "ft" ||
    note.includes("full time") ||
    note.includes("final") ||
    note.includes("aet") ||
    note.includes("pens")
  );
}

function shouldUseColor() {
  return process.stdout.isTTY && !process.env.NO_COLOR;
}

function scoreNumber(score) {
  if (score == null) {
    return null;
  }
  const parsed = Number.parseInt(String(score), 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function colorTeamName(name, role, isLive) {
  if (!shouldUseColor()) {
    return name;
  }
  if (role === "win") {
    return `${isLive ? ANSI_BRIGHT_GREEN : ANSI_DARK_GREEN}${name}${ANSI_RESET}`;
  }
  if (role === "loss") {
    return `${isLive ? ANSI_BRIGHT_RED : ANSI_DARK_RED}${name}${ANSI_RESET}`;
  }
  return name;
}

function fixtureLine(event, options = {}) {
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
  const suffix = showCompetitionTag
    ? `(${competitionTag})`
    : `(${statusLabel})`;

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

function printGroupedFixtures(events, heading, options = {}) {
  console.log(heading);
  if (events.length === 0) {
    console.log(options.emptyMessage || "No fixtures.");
    return;
  }

  const groups = new Map();
  for (const event of events) {
    const key = competitionLabel(event);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(event);
  }

  const sortedGroups = [...groups.entries()].sort(([a], [b]) => {
    const ai = COMPETITION_ORDER.findIndex(
      (name) => normalizeText(name) === normalizeText(a),
    );
    const bi = COMPETITION_ORDER.findIndex(
      (name) => normalizeText(name) === normalizeText(b),
    );
    const aRank = ai === -1 ? Number.MAX_SAFE_INTEGER : ai;
    const bRank = bi === -1 ? Number.MAX_SAFE_INTEGER : bi;
    if (aRank !== bRank) {
      return aRank - bRank;
    }
    return a.localeCompare(b);
  });

  for (const [competition, list] of sortedGroups) {
    list.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
    console.log("");
    console.log(`${competition}`);
    for (const event of list) {
      console.log(`- ${fixtureLine(event, options)}`);
    }
  }
}

function printFlatFixtures(events, heading, options = {}) {
  console.log(heading);
  if (events.length === 0) {
    console.log(options.emptyMessage || "No fixtures.");
    return;
  }
  const sorted = [...events].sort(
    (a, b) => new Date(a.startTime) - new Date(b.startTime),
  );
  for (const event of sorted) {
    console.log(`- ${fixtureLine(event, options)}`);
  }
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function slugifyTeam(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function teamUrnFromQuery(query) {
  if (String(query || "").startsWith("urn:bbc:sportsdata:football:team:")) {
    return query;
  }
  const slug = slugifyTeam(query);
  return `urn:bbc:sportsdata:football:team:${slug}`;
}

function urnSlug(urn) {
  if (!urn) {
    return "";
  }
  const parts = String(urn).split(":");
  return parts[parts.length - 1] || "";
}

function normalizeEvent(raw) {
  const home = raw.homeTeam || raw.home;
  const away = raw.awayTeam || raw.away;
  return {
    ...raw,
    startTime: raw.startTime || raw.startDateTime,
    eventStatusNote:
      raw.eventStatusNote ||
      raw.statusComment?.value ||
      raw.periodLabel?.value ||
      raw.status ||
      raw.statusText,
    homeTeam: {
      ...home,
      key: home?.key || home?.id || home?.urn || "",
      name: {
        abbreviation:
          home?.name?.abbreviation ||
          home?.name?.shortName ||
          home?.shortName ||
          home?.fullName,
        shortName: home?.name?.shortName || home?.shortName || "",
        fullName: home?.name?.fullName || home?.fullName || "",
      },
      urn: home?.urn || "",
    },
    awayTeam: {
      ...away,
      key: away?.key || away?.id || away?.urn || "",
      name: {
        abbreviation:
          away?.name?.abbreviation ||
          away?.name?.shortName ||
          away?.shortName ||
          away?.fullName,
        shortName: away?.name?.shortName || away?.shortName || "",
        fullName: away?.name?.fullName || away?.fullName || "",
      },
      urn: away?.urn || "",
    },
  };
}

function flattenEvents(matchData) {
  const events = [];
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
  events.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
  return events;
}

function flattenEventsFromContainer(root) {
  const events = [];
  const stack = [root];
  while (stack.length > 0) {
    const node = stack.pop();
    if (Array.isArray(node)) {
      for (const item of node) {
        stack.push(item);
      }
      continue;
    }
    if (!node || typeof node !== "object") {
      continue;
    }

    // Handle event objects directly in the wc-data payload.
    if (
      (node.home || node.homeTeam) &&
      (node.away || node.awayTeam) &&
      (node.startTime || node.startDateTime)
    ) {
      events.push(normalizeEvent(node));
    }

    for (const value of Object.values(node)) {
      if (value && typeof value === "object") {
        stack.push(value);
      }
    }
  }
  events.sort(
    (a, b) =>
      new Date(a.startTime || a.startDateTime) -
      new Date(b.startTime || b.startDateTime),
  );
  return events;
}

async function fetchMatchData(url, dayYmd) {
  const refDate = dayYmd || toYmd(new Date());
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Accept-Language": "en-GB,en-US;q=0.9,en;q=0.8",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      Priority: "u=1, i",
      Referer: `https://www.bbc.co.uk/sport/football/scores-fixtures/${refDate}`,
    },
  });
  if (!response.ok) {
    throw new Error(`API request failed (${response.status})`);
  }
  const data = await response.json();
  const batchShape = data?.payload?.[0]?.body?.matchData;
  if (batchShape) {
    return flattenEvents(batchShape);
  }
  return flattenEventsFromContainer(data);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  let day;
  let team;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") {
      return { help: true };
    }
    if (arg === "--day") {
      day = args[i + 1] || true;
      i++;
      continue;
    }
    if (arg === "--team") {
      team = args[i + 1];
      i++;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!day && !team) {
    throw new Error("Provide either --day or --team.");
  }
  if (day && team) {
    throw new Error("Use either --day or --team, not both.");
  }

  if (day) {
    const parsed = parseYmd(day);
    if (!parsed) {
      return { day: toYmd(new Date()) };
    }
    return { day: toYmd(parsed) };
  }

  const normalizedTeam = String(team || "").toLowerCase();
  const teamQueryBase = normalizedTeam.startsWith("tfbb")
    ? TEAM_KEY_TO_SHORT[normalizedTeam.toUpperCase()] || normalizedTeam
    : normalizedTeam;
  const teamQuery = TEAM_QUERY_ALIASES[teamQueryBase] || teamQueryBase;
  return { teamQuery, teamInput: team, teamUrn: teamUrnFromQuery(teamQuery) };
}

async function fixturesForDay(dayYmd) {
  const today = toYmd(new Date());
  const url = urlForDaysGames(today, dayYmd, dayYmd);
  const events = (await fetchMatchData(url, dayYmd)).filter(competitionAllowed);

  printGroupedFixtures(events, `Fixtures for ${dayYmd}`);
}

function teamMatchesQuery(team, query) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) {
    return false;
  }
  const rawCandidates = [
    team?.key,
    team?.urn,
    urnSlug(team?.urn),
    team?.name?.abbreviation,
    team?.name?.shortName,
    team?.name?.fullName,
    team?.shortName,
    team?.fullName,
  ].filter(Boolean);
  const candidates = rawCandidates.map(normalizeText).filter(Boolean);
  const tokenSet = new Set();
  for (const raw of rawCandidates) {
    String(raw)
      .toLowerCase()
      .split(/[^a-z0-9]+/g)
      .filter(Boolean)
      .forEach((t) => tokenSet.add(t));
  }

  if (normalizedQuery.length <= 3) {
    // Short inputs like "liv" should be precise, not substring fuzzy.
    return tokenSet.has(normalizedQuery);
  }

  return candidates.some(
    (candidate) =>
      candidate.includes(normalizedQuery) ||
      normalizedQuery.includes(candidate),
  );
}

async function futureFixturesForTeam(teamQuery, teamInput, teamUrn) {
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

async function main() {
  try {
    const parsed = parseArgs(process.argv);
    if (parsed.help) {
      usage();
      return;
    }
    if (parsed.day) {
      await fixturesForDay(parsed.day);
      return;
    }
    await futureFixturesForTeam(
      parsed.teamQuery,
      parsed.teamInput,
      parsed.teamUrn,
    );
  } catch (error) {
    console.error(error.message);
    console.error("");
    usage();
    process.exit(1);
  }
}

main();
