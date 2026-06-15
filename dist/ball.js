#!/usr/bin/env node
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// ball.ts
var ball_exports = {};
module.exports = __toCommonJS(ball_exports);

// bbc.ts
function toYmd(date) {
  return date.toISOString().slice(0, 10);
}
async function fetchBbcJson(url, refDate, sport) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Accept-Language": "en-GB,en-US;q=0.9,en;q=0.8",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      Priority: "u=1, i",
      Referer: `https://www.bbc.co.uk/sport/${sport}/scores-fixtures/${refDate}`
    }
  });
  if (!response.ok) {
    throw new Error(`API request failed (${response.status})`);
  }
  return await response.json();
}

// config.ts
var import_node_fs = require("node:fs");
var import_node_path = require("node:path");
var import_node_os = require("node:os");
var CONFIG_FILE = ".phone_cli.json";
function getConfigPath() {
  return (0, import_node_path.join)((0, import_node_os.homedir)(), CONFIG_FILE);
}
function readPhoneCliConfig() {
  const path = getConfigPath();
  try {
    const raw = (0, import_node_fs.readFileSync)(path, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Top-level JSON must be an object.");
    }
    return parsed;
  } catch (error) {
    if (typeof error === "object" && error != null && "code" in error && error.code === "ENOENT") {
      return {};
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read config at ${path}: ${message}`);
  }
}

// ball.ts
var DAY_MS = 24 * 60 * 60 * 1e3;
var TEAM_QUERY_ALIASES = {
  avfc: "aston-villa"
};
var COMPETITION_ALLOWLIST = /* @__PURE__ */ new Set([
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
  "fifaworldcup"
]);
var COMPETITION_ORDER = [
  "FIFA World Cup",
  "Premier League",
  "FA Cup",
  "League Cup",
  "UEFA Champions League",
  "UEFA Europa League",
  "Championship",
  "League One",
  "Scottish Premiership"
];
var BBC_BASE_URL = "https://www.bbc.co.uk/wc-data/container/sport-data-scores-fixtures";
var PL_STANDINGS_URL = "https://premier-league-standings1.p.rapidapi.com/";
var PL_RAPID_HOST = "premier-league-standings1.p.rapidapi.com";
var ANSI_RESET = "\x1B[0m";
var ANSI_DARK_GREEN = "\x1B[32m";
var ANSI_DARK_RED = "\x1B[31m";
var ANSI_BRIGHT_GREEN = "\x1B[92m";
var ANSI_BRIGHT_RED = "\x1B[91m";
var ANSI_BG_CLARET = "\x1B[48;5;88m";
var ANSI_VILLA_BLUE = "\x1B[38;5;39m";
var ANSI_ORANGE = "\x1B[38;5;208m";
var ANSI_BLUE = "\x1B[94m";
var ANSI_REGEX = /\x1b\[[0-9;]*m/g;
var urlForDaysGames = (today, end, start) => `${BBC_BASE_URL}?selectedEndDate=${end}&selectedStartDate=${start}&todayDate=${today}&urn=${encodeURIComponent("urn:bbc:sportsdata:football:tournament-collection:collated")}`;
var urlForTeamGames = (today, end, start, teamUrn) => `${BBC_BASE_URL}?selectedEndDate=${end}&selectedStartDate=${start}&todayDate=${today}&urn=${encodeURIComponent(teamUrn)}`;
function usage() {
  console.log("Usage:");
  console.log("  ball   (yesterday, then tomorrow, then today)");
  console.log("  ball pl");
  console.log("  ball YYYY-MM-DD");
  console.log("  ball DD/MM");
  console.log("  ball today|tomorrow|mon|tues|wed|thurs|fri|sat|sun");
  console.log("  ball TEAM");
}
function parseYmd(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const d = /* @__PURE__ */ new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  return toYmd(d) === value ? d : null;
}
function startOfMostRecentAugust(reference = /* @__PURE__ */ new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "numeric"
  }).formatToParts(reference);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const augustYear = month >= 8 ? year : year - 1;
  return parseYmd(`${augustYear}-08-01`) ?? /* @__PURE__ */ new Date(`${augustYear}-08-01T00:00:00Z`);
}
function parseDayMonthInput(value) {
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
  const now = /* @__PURE__ */ new Date();
  const nowY = now.getFullYear();
  const y = year || nowY;
  const candidate = new Date(Date.UTC(y, month - 1, day));
  if (candidate.getUTCFullYear() !== y || candidate.getUTCMonth() !== month - 1 || candidate.getUTCDate() !== day) {
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
function parseRelativeDayInput(value) {
  const v = String(value || "").trim().toLowerCase();
  const now = /* @__PURE__ */ new Date();
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  if (v === "today") return today;
  if (v === "tomorrow") return new Date(today.getTime() + DAY_MS);
  const weekdayMap = {
    sun: 0,
    sunday: 0,
    mon: 1,
    monday: 1,
    tue: 2,
    tues: 2,
    tuesday: 2,
    wed: 3,
    weds: 3,
    wednesday: 3,
    thu: 4,
    thur: 4,
    thurs: 4,
    thursday: 4,
    fri: 5,
    friday: 5,
    sat: 6,
    saturday: 6
  };
  if (weekdayMap[v] == null) return null;
  const targetDow = weekdayMap[v];
  const currentDow = today.getUTCDay();
  let delta = (targetDow - currentDow + 7) % 7;
  if (delta === 0) delta = 7;
  return new Date(today.getTime() + delta * DAY_MS);
}
function defaultThreeDayRows() {
  const now = /* @__PURE__ */ new Date();
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const yesterday = new Date(today.getTime() - DAY_MS);
  const tomorrow = new Date(today.getTime() + DAY_MS);
  return [
    { relative: "yesterday", ymd: toYmd(yesterday) },
    { relative: "tomorrow", ymd: toYmd(tomorrow) },
    { relative: "today", ymd: toYmd(today) }
  ];
}
var WEEKDAY_HEADING_SPELLING = {
  Tue: "Tues",
  Thu: "Thurs"
};
function formatYmdLondonShort(dayYmd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayYmd);
  if (!m) return dayYmd;
  const y = Number.parseInt(m[1], 10);
  const mo = Number.parseInt(m[2], 10) - 1;
  const d = Number.parseInt(m[3], 10);
  const date = new Date(Date.UTC(y, mo, d, 12, 0, 0));
  const weekday = date.toLocaleDateString("en-GB", {
    weekday: "short",
    timeZone: "Europe/London"
  });
  const dayNum = date.toLocaleDateString("en-GB", { day: "2-digit", timeZone: "Europe/London" });
  const monthNum = date.toLocaleDateString("en-GB", { month: "2-digit", timeZone: "Europe/London" });
  const cap = weekday.charAt(0).toUpperCase() + weekday.slice(1).toLowerCase();
  const wday = WEEKDAY_HEADING_SPELLING[cap] ?? cap;
  return `${wday} ${dayNum}/${monthNum}`;
}
function formatFixtureDate(isoDateTime) {
  const d = new Date(isoDateTime);
  if (Number.isNaN(d.getTime())) return "unknown-date";
  const weekday = d.toLocaleDateString("en-GB", {
    weekday: "short",
    timeZone: "Europe/London"
  });
  const day = d.toLocaleDateString("en-GB", { day: "2-digit", timeZone: "Europe/London" });
  const month = d.toLocaleDateString("en-GB", { month: "2-digit", timeZone: "Europe/London" });
  const dayName = weekday.charAt(0).toUpperCase() + weekday.slice(1).toLowerCase();
  return `${dayName} ${day}/${month}`;
}
function formatPrintedAtTimestamp(date = /* @__PURE__ */ new Date()) {
  const weekday = date.toLocaleDateString("en-GB", {
    weekday: "short",
    timeZone: "Europe/London"
  });
  const day = date.toLocaleDateString("en-GB", { day: "2-digit", timeZone: "Europe/London" });
  const month = date.toLocaleDateString("en-GB", { month: "2-digit", timeZone: "Europe/London" });
  const time = date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/London"
  });
  const dayName = weekday.charAt(0).toUpperCase() + weekday.slice(1).toLowerCase();
  return `${dayName} ${day}/${month} ${time}`;
}
function eventTime(event) {
  const dateValue = event.startTime || event.startDateTime;
  if (!dateValue) return "??:?? UK";
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return "??:?? UK";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZoneName: "short"
  }).formatToParts(d);
  const hh = parts.find((p) => p.type === "hour")?.value || "??";
  const mm = parts.find((p) => p.type === "minute")?.value || "??";
  const tz = parts.find((p) => p.type === "timeZoneName")?.value || "UK";
  return `${hh}:${mm} ${tz}`;
}
function teamLabel(team) {
  const base = team?.name?.shortName || team?.shortName || team?.name?.abbreviation || team?.name?.fullName || team?.fullName || team?.key || "unknown-team";
  return highlightAstonVilla(base);
}
function isAstonVillaName(name) {
  const n = normalizeText(name);
  return n === "astonvilla" || n === "avfc" || n === "avl";
}
function highlightAstonVilla(name) {
  if (!shouldUseColor() || !isAstonVillaName(name)) return name;
  return `${ANSI_BG_CLARET}${ANSI_VILLA_BLUE}AVFC${ANSI_RESET}`;
}
function competitionLabel(event) {
  return event?.tournament?.disambiguatedName || event?.tournament?.name || event?.eventGroupingLabel || "Other";
}
function competitionAllowed(event) {
  const candidates = [
    event?.tournament?.disambiguatedName,
    event?.tournament?.name,
    urnSlug(event?.tournament?.urn)
  ].filter(Boolean).map(normalizeText);
  return candidates.some((candidate) => COMPETITION_ALLOWLIST.has(candidate));
}
function teamScore(team, event) {
  const direct = team?.scores?.score ?? team?.runningScores?.score ?? team?.score ?? null;
  if (direct != null) return String(direct);
  const participant = (event.participants || []).find((p) => {
    return p.alignment === (team === event.homeTeam ? "home" : "away");
  });
  const participantScore = participant?.score ?? participant?.runningScore ?? null;
  return participantScore != null ? String(participantScore) : null;
}
function isResultState(event) {
  const status = String(event.status || "").toLowerCase();
  return Boolean(status) && status !== "preevent";
}
function isFinishedState(event) {
  const status = String(event.status || "").toLowerCase();
  if (status === "postevent") return true;
  const note = String(event.eventStatusNote || "").toLowerCase();
  return note === "ft" || note.includes("full time") || note.includes("final") || note.includes("aet") || note.includes("pens");
}
function shouldUseColor() {
  return Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
}
function scoreNumber(score) {
  if (score == null) return null;
  const parsed = Number.parseInt(String(score), 10);
  return Number.isNaN(parsed) ? null : parsed;
}
function colorTeamName(name, role, isLive) {
  if (isAstonVillaName(name)) return highlightAstonVilla(name);
  if (!shouldUseColor()) return name;
  if (role === "win") return `${isLive ? ANSI_BRIGHT_GREEN : ANSI_DARK_GREEN}${name}${ANSI_RESET}`;
  if (role === "loss") return `${isLive ? ANSI_BRIGHT_RED : ANSI_DARK_RED}${name}${ANSI_RESET}`;
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
  const datePrefix = includeDate ? `${formatFixtureDate(event.startTime || event.startDateTime)} ` : "";
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
    if (homeN != null && awayN != null && homeN !== awayN) {
      homeDisplay = colorTeamName(home, homeN > awayN ? "win" : "loss", isLive);
      awayDisplay = colorTeamName(away, awayN > homeN ? "win" : "loss", isLive);
    }
    return `${datePrefix}${timeDisplay} ${homeDisplay} ${homeScore}-${awayScore} ${awayDisplay}${suffixWithSpace}`;
  }
  return `${datePrefix}${timeDisplay} ${home} vs ${away}${suffixWithSpace}`;
}
function eventTeamSide(event, teamUrn) {
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
function teamResultOutcome(event, side) {
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
function buildTeamCompetitionRecords(events, teamUrn) {
  const stats = /* @__PURE__ */ new Map();
  for (const event of events) {
    const side = eventTeamSide(event, teamUrn);
    if (!side) continue;
    const outcome = teamResultOutcome(event, side);
    if (!outcome) continue;
    const comp = competitionLabel(event);
    const venue = side === "home" ? "H" : "A";
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
function printTeamCompetitionSummary(events, teamUrn) {
  const records = buildTeamCompetitionRecords(events, teamUrn);
  if (records.length === 0) return;
  const rows = records.map((row) => [
    `${row.comp} (${row.venue})`,
    String(row.wins),
    String(row.draws),
    String(row.losses)
  ]);
  console.log("");
  console.log("Record by competition (finished matches)");
  for (const line of makeAsciiTable(["Comp", "W", "D", "L"], rows)) {
    console.log(line);
  }
}
function printGroupedFixtures(events, heading, options = {}) {
  console.log(heading);
  if (events.length === 0) {
    console.log(options.emptyMessage || "No fixtures.");
    return;
  }
  const groups = /* @__PURE__ */ new Map();
  for (const event of events) {
    const key = competitionLabel(event);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(event);
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
function printFlatFixtures(events, heading, options = {}) {
  console.log(heading);
  if (options.teamUrn) {
    printTeamCompetitionSummary(events, options.teamUrn);
  }
  if (events.length === 0) {
    console.log(options.emptyMessage || "No fixtures.");
    return;
  }
  const sorted = [...events].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );
  for (const event of sorted) {
    console.log(`- ${fixtureLine(event, options)}`);
  }
}
function normalizeText(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}
function slugifyTeam(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function teamUrnFromQuery(query) {
  if (String(query || "").startsWith("urn:bbc:sportsdata:football:team:")) {
    return query;
  }
  const slug = slugifyTeam(query);
  return `urn:bbc:sportsdata:football:team:${slug}`;
}
function urnSlug(urn) {
  if (!urn) return "";
  const parts = String(urn).split(":");
  return parts[parts.length - 1] || "";
}
function normalizeEvent(raw) {
  const home = raw.homeTeam || raw.home;
  const away = raw.awayTeam || raw.away;
  return {
    ...raw,
    startTime: raw.startTime || raw.startDateTime || "",
    eventStatusNote: raw.eventStatusNote || raw.statusComment?.value || raw.periodLabel?.value || raw.status || raw.statusText || "",
    homeTeam: {
      ...home,
      key: home?.key || home?.id || home?.urn || "",
      name: {
        abbreviation: home?.name?.abbreviation || home?.name?.shortName || home?.shortName || home?.fullName || "",
        shortName: home?.name?.shortName || home?.shortName || "",
        fullName: home?.name?.fullName || home?.fullName || ""
      },
      urn: home?.urn || ""
    },
    awayTeam: {
      ...away,
      key: away?.key || away?.id || away?.urn || "",
      name: {
        abbreviation: away?.name?.abbreviation || away?.name?.shortName || away?.shortName || away?.fullName,
        shortName: away?.name?.shortName || away?.shortName || "",
        fullName: away?.name?.fullName || away?.fullName || ""
      },
      urn: away?.urn || ""
    },
    participants: raw.participants || []
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
  events.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  return events;
}
function flattenEventsFromContainer(root) {
  const events = [];
  const stack = [root];
  while (stack.length > 0) {
    const node = stack.pop();
    if (Array.isArray(node)) {
      for (const item of node) stack.push(item);
      continue;
    }
    if (!node || typeof node !== "object") continue;
    const n = node;
    if ((n.home || n.homeTeam) && (n.away || n.awayTeam) && (n.startTime || n.startDateTime)) {
      events.push(normalizeEvent(n));
    }
    for (const value of Object.values(n)) {
      if (value && typeof value === "object") {
        stack.push(value);
      }
    }
  }
  events.sort(
    (a, b) => new Date(a.startTime || a.startDateTime).getTime() - new Date(b.startTime || b.startDateTime).getTime()
  );
  return events;
}
async function fetchMatchData(url, dayYmd) {
  const refDate = dayYmd || toYmd(/* @__PURE__ */ new Date());
  const data = await fetchBbcJson(url, refDate, "football");
  const batchShape = data?.payload?.[0]?.body?.matchData;
  if (batchShape) return flattenEvents(batchShape);
  return flattenEventsFromContainer(data);
}
function padCell(value, width) {
  const visible = value.replace(ANSI_REGEX, "").length;
  return value + " ".repeat(Math.max(0, width - visible));
}
function makeAsciiTable(headers, rows) {
  const widths = headers.map(
    (header, idx) => Math.max(
      header.replace(ANSI_REGEX, "").length,
      ...rows.map((row) => (row[idx] || "").replace(ANSI_REGEX, "").length)
    )
  );
  const border = `+-${widths.map((w) => "-".repeat(w)).join("-+-")}-+`;
  const headerLine = `| ${headers.map((h, i) => padCell(h, widths[i])).join(" | ")} |`;
  const body = rows.map((row) => `| ${row.map((v, i) => padCell(v || "", widths[i])).join(" | ")} |`);
  return [border, headerLine, border, ...body, border];
}
function toRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value;
}
function valueByPath(record, path) {
  const parts = path.split(".");
  let cursor = record;
  for (const part of parts) {
    const rec = toRecord(cursor);
    if (!rec) return void 0;
    cursor = rec[part];
  }
  return cursor;
}
function firstValue(record, keys) {
  for (const key of keys) {
    const v = key.includes(".") ? valueByPath(record, key) : record[key];
    if (v != null && v !== "") return v;
  }
  return void 0;
}
function asNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}
function asString(value) {
  if (value == null) return "";
  return String(value);
}
function normalizePlRows(payload) {
  const rowsSource = Array.isArray(payload) ? payload : (() => {
    const rec = toRecord(payload);
    if (!rec) return [];
    const candidates = [
      rec.standings,
      rec.table,
      rec.data,
      rec.results,
      valueByPath(rec, "response.standings"),
      valueByPath(rec, "response.table"),
      valueByPath(rec, "response.data")
    ];
    for (const c of candidates) {
      if (Array.isArray(c)) return c;
    }
    return [];
  })();
  const normalized = [];
  for (const row of rowsSource) {
    const rec = toRecord(row);
    if (!rec) continue;
    const teamRaw = firstValue(rec, [
      "team.name",
      "team.shortName",
      "team.abbreviation"
    ]) ?? firstValue(rec, [
      "team",
      "teamName",
      "name",
      "club",
      "team.name",
      "team.shortName"
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
      "stats.gamesPlayed"
    ])) ?? 0;
    const won = asNumber(firstValue(rec, [
      "won",
      "wins",
      "w",
      "stats.wins"
    ])) ?? 0;
    const draw = asNumber(firstValue(rec, [
      "drawn",
      "draw",
      "draws",
      "d",
      "ties",
      "stats.ties",
      "stats.draws"
    ])) ?? 0;
    const lost = asNumber(firstValue(rec, [
      "lost",
      "losses",
      "l",
      "stats.losses",
      "stats.lost"
    ])) ?? 0;
    const gd = asNumber(firstValue(rec, [
      "goalDifference",
      "gd",
      "goalsDiff",
      "stats.goalDifference"
    ])) ?? 0;
    const points = asNumber(firstValue(rec, [
      "points",
      "pts",
      "stats.points"
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
    String(r.points)
  ]);
}
async function printPremierLeagueTable() {
  const config = readPhoneCliConfig();
  const ballConfig = config.ball || {};
  const rapidApiKey = String(
    ballConfig.rapidApiKey || ballConfig.rapidapiKey || ballConfig.plRapidApiKey || process.env.RAPIDAPI_KEY || ""
  ).trim();
  if (!rapidApiKey) {
    throw new Error(
      `Missing RapidAPI key. Set ball.rapidApiKey in ${getConfigPath()} or RAPIDAPI_KEY env var.`
    );
  }
  const response = await fetch(PL_STANDINGS_URL, {
    headers: {
      "Content-Type": "application/json",
      "x-rapidapi-host": PL_RAPID_HOST,
      "x-rapidapi-key": rapidApiKey
    }
  });
  if (!response.ok) {
    throw new Error(`Premier League table request failed (${response.status})`);
  }
  const payload = await response.json();
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
function parseArgs(argv) {
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
  const dayParsers = [parseRelativeDayInput, parseYmd, parseDayMonthInput];
  for (const parser of dayParsers) {
    const parsed = parser(input);
    if (parsed) return { day: toYmd(parsed) };
  }
  const normalizedTeam = String(input || "").toLowerCase();
  const teamQueryBase = normalizedTeam;
  const teamQuery = TEAM_QUERY_ALIASES[teamQueryBase] || teamQueryBase;
  return { teamQuery, teamInput: input, teamUrn: teamUrnFromQuery(teamQuery) };
}
async function fixturesForDay(dayYmd, relativeHeading) {
  const today = toYmd(/* @__PURE__ */ new Date());
  const url = urlForDaysGames(today, dayYmd, dayYmd);
  const events = (await fetchMatchData(url, dayYmd)).filter(competitionAllowed);
  const heading = relativeHeading !== void 0 ? `${ANSI_ORANGE}=== Fixtures for ${relativeHeading} (${formatYmdLondonShort(dayYmd)}) ===${ANSI_RESET}` : `Fixtures for ${dayYmd} (at ${formatPrintedAtTimestamp()})`;
  if (relativeHeading !== void 0) {
    console.log("");
    console.log("");
  }
  printGroupedFixtures(events, heading);
}
async function futureFixturesForTeam(teamQuery, teamInput, teamUrn) {
  const now = /* @__PURE__ */ new Date();
  const seasonStart = startOfMostRecentAugust(now);
  const start = toYmd(seasonStart);
  const end = toYmd(new Date(now.getTime() + 30 * DAY_MS));
  const url = urlForTeamGames(start, end, start, teamUrn);
  const events = (await fetchMatchData(url, start)).filter((event) => {
    const dt = new Date(event.startTime || event.startDateTime);
    return dt.getTime() >= seasonStart.getTime();
  });
  printFlatFixtures(events, `Future fixtures for ${teamInput || teamQuery} (at ${formatPrintedAtTimestamp()})`, {
    includeDate: true,
    showCompetitionTag: true,
    teamUrn,
    emptyMessage: `No fixtures since ${formatYmdLondonShort(start)} or in the next 30 days.`
  });
}
async function main() {
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
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    console.error("");
    usage();
    process.exit(1);
  }
}
void main();
