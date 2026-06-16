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

// cric.ts
var cric_exports = {};
module.exports = __toCommonJS(cric_exports);

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

// lib/cricApi.ts
var CRICKET_BASE_URL = "https://web-cdn.api.bbci.co.uk/wc-poll-data/container/sport-data-scores-fixtures";
var CRICKET_URN = "urn:bbc:sportsdata:cricket:tournament-collection:collated";
var DAY_MS = 24 * 60 * 60 * 1e3;
var ANSI_RESET = "\x1B[0m";
var ANSI_DARK_GREEN = "\x1B[32m";
var ANSI_DARK_RED = "\x1B[31m";
var ANSI_DARK_YELLOW = "\x1B[33m";
var ANSI_PALE_YELLOW = "\x1B[38;5;227m";
var ANSI_BRIGHT_GREEN = "\x1B[92m";
var ANSI_BRIGHT_RED = "\x1B[91m";
var ANSI_PURPLE = "\x1B[35m";
function shouldUseColor() {
  return Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
}
function normalizeText(value) {
  return String(value || "").toLowerCase();
}
function isEnglandName(name) {
  const n = normalizeText(name);
  return n === "england" || n === "eng";
}
function highlightEngland(name) {
  if (!shouldUseColor() || !isEnglandName(name)) return name;
  return `${ANSI_PURPLE}${name}${ANSI_RESET}`;
}
function teamPlainLabel(team) {
  return team?.shortName || team?.name || "TBC";
}
function teamId(team) {
  return String(team?.id || "");
}
function isFinishedMatch(event) {
  return String(event.status || "") === "PostEvent";
}
function isLiveMatch(event) {
  const status = String(event.status || "");
  return status !== "PreEvent" && status !== "PostEvent";
}
function isDrawResult(event) {
  const result = normalizeText(event.matchSummary?.resultString);
  return result.includes("draw") || result.includes("tied");
}
function totalRuns(team) {
  return asInningsList(team).reduce((sum, innings) => sum + (innings.runs ?? 0), 0);
}
function teamMatchRole(event, side) {
  const homeTeam = event.participants?.homeTeam;
  const awayTeam = event.participants?.awayTeam;
  const team = side === "home" ? homeTeam : awayTeam;
  const status = String(event.status || "");
  if (status === "PreEvent") return null;
  if (!homeTeam || !awayTeam) return null;
  if (isFinishedMatch(event)) {
    if (isDrawResult(event)) return "draw";
    const winnerId = String(event.winnerTeamId || "");
    if (!winnerId) return null;
    return teamId(team) === winnerId ? "win" : "loss";
  }
  if (!isLiveMatch(event)) return null;
  const homeRuns = totalRuns(homeTeam);
  const awayRuns = totalRuns(awayTeam);
  if (homeRuns === awayRuns) return "draw";
  const ahead = homeRuns > awayRuns ? "home" : "away";
  return side === ahead ? "win" : "loss";
}
function colorTeamName(name, role, isLive) {
  if (isEnglandName(name)) return highlightEngland(name);
  if (!shouldUseColor()) return name;
  if (role === "win") return `${isLive ? ANSI_DARK_GREEN : ANSI_BRIGHT_GREEN}${name}${ANSI_RESET}`;
  if (role === "loss") return `${isLive ? ANSI_DARK_RED : ANSI_BRIGHT_RED}${name}${ANSI_RESET}`;
  return `${isLive ? ANSI_DARK_YELLOW : ANSI_PALE_YELLOW}${name}${ANSI_RESET}`;
}
function coloredTeamLabel(team, event, side) {
  const name = teamPlainLabel(team);
  const role = teamMatchRole(event, side);
  if (!role) return highlightEngland(name);
  return colorTeamName(name, role, isLiveMatch(event));
}
function teamLabel(team) {
  return teamPlainLabel(team);
}
function asInningsList(team) {
  const innings = team?.innings;
  if (!innings) return [];
  return Array.isArray(innings) ? innings : [innings];
}
function inningsScore(innings) {
  if (innings.runs == null) return "";
  const wickets = innings.wickets == null ? "-" : String(innings.wickets);
  const overs = innings.overs ? ` (${innings.overs})` : "";
  const declared = innings.isDeclared ? "d" : "";
  return `${innings.runs}/${wickets}${declared}${overs}`;
}
function inningsLine(team, innings, index, event, side) {
  const label = coloredTeamLabel(team, event, side);
  const suffix = index > 0 ? ` (Inns ${index + 1})` : "";
  if (!innings) return `${label}${suffix}: -`;
  const score = inningsScore(innings);
  return `${label}${suffix}: ${score || "-"}`;
}
function inningsOrder(innings) {
  const maybe = innings.inningsNumber ?? innings.innings_number ?? innings.number;
  if (maybe == null) return null;
  const parsed = Number(maybe);
  return Number.isNaN(parsed) ? null : parsed;
}
function inningsStartTime(innings) {
  const raw = innings.startDateTime || innings.start_date_time;
  if (!raw) return null;
  const ts = new Date(raw).getTime();
  return Number.isNaN(ts) ? null : ts;
}
function orderedInningsLines(homeTeam, awayTeam, event) {
  const entries = [
    ...asInningsList(homeTeam).map((innings, idx) => ({
      team: homeTeam,
      innings,
      localIndex: idx,
      side: "home"
    })),
    ...asInningsList(awayTeam).map((innings, idx) => ({
      team: awayTeam,
      innings,
      localIndex: idx,
      side: "away"
    }))
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
  return entries.map(
    (entry) => `  ${inningsLine(entry.team, entry.innings, entry.localIndex, event, entry.side)}`
  );
}
function competitionLabel(secondary, event) {
  return secondary.displayLabel || event.tournamentName || event.eventGroupingLabel || "Other";
}
function isAllowedCompetition(label) {
  const text = normalizeText(label);
  if (!text) return false;
  if (text.includes("women")) return false;
  const isCountyChampionship = text.includes("county championship");
  const isEnglishLeagueOrCup = (text.includes("league") || text.includes("cup")) && (text.includes("england") || text.includes("english") || text.includes("county") || text.includes("vitality blast") || text.includes("one-day cup") || text.includes("one day cup") || text.includes("the hundred"));
  const isTest = text.includes("test");
  const isMensInternational = text.includes("international") || text.includes("odi") || text.includes("t20i") || text.includes("world cup") || text.includes("champions trophy") || text.includes("ashes");
  return isCountyChampionship || isEnglishLeagueOrCup || isTest || isMensInternational;
}
function multiDayLabel(event, selectedYmd) {
  const start = event.matchDateSummary?.startDate;
  const end = event.matchDateSummary?.endDate;
  if (!start || !end || start === end) return "";
  const startDate = /* @__PURE__ */ new Date(`${start}T00:00:00Z`);
  const endDate = /* @__PURE__ */ new Date(`${end}T00:00:00Z`);
  const selectedDate = /* @__PURE__ */ new Date(`${selectedYmd}T00:00:00Z`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || Number.isNaN(selectedDate.getTime())) {
    return "";
  }
  if (selectedDate < startDate || selectedDate > endDate) return "";
  const dayNumber = Math.floor((selectedDate.getTime() - startDate.getTime()) / DAY_MS) + 1;
  return `Day ${dayNumber}`;
}
function fixtureHeaderLine(event, ymd) {
  const homeTeam = event.participants?.homeTeam;
  const awayTeam = event.participants?.awayTeam;
  const dayLabel = multiDayLabel(event, ymd);
  const home = coloredTeamLabel(homeTeam, event, "home");
  const away = coloredTeamLabel(awayTeam, event, "away");
  return [
    event.startTime || "??:??",
    `${home} vs ${away}`,
    event.groundShortName || "-",
    dayLabel || "-",
    event.matchSummary?.resultString || "-"
  ].join(" | ");
}
function eventActiveOnDate(event, ymd) {
  const start = event.matchDateSummary?.startDate;
  const end = event.matchDateSummary?.endDate;
  if (start && end && ymd >= start && ymd <= end) return true;
  if (start && !end && start === ymd) return true;
  const raw = event.startDateTime;
  if (!raw) return false;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return false;
  return date.toLocaleDateString("en-CA", { timeZone: "Europe/London" }) === ymd;
}
function cricketStatusSectionLines(data, ymd) {
  const lines = [];
  let matchCount = 0;
  for (const group of data.eventGroups || []) {
    for (const secondary of group.secondaryGroups || []) {
      const events = [...secondary.events || []].sort((a, b) => {
        const aTime = new Date(a.startDateTime || "").getTime();
        const bTime = new Date(b.startDateTime || "").getTime();
        return aTime - bTime;
      });
      const allowedEvents = events.filter(
        (event) => isAllowedCompetition(competitionLabel(secondary, event)) && eventActiveOnDate(event, ymd)
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
        lines.push(...orderedInningsLines(homeTeam, awayTeam, event));
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
function cricketFixtureLines(data, ymd) {
  const lines = cricketStatusSectionLines(data, ymd);
  if (lines.length === 1 && lines[0] === "none today") {
    return lines;
  }
  return [`Cricket fixtures for ${ymd}`, "", ...lines];
}
async function fetchTodayCricket(ymd) {
  const url = `${CRICKET_BASE_URL}?selectedEndDate=${ymd}&selectedStartDate=${ymd}&todayDate=${ymd}&urn=${encodeURIComponent(CRICKET_URN)}`;
  return fetchBbcJson(url, ymd, "cricket");
}

// cric.ts
function usage() {
  console.log("Usage:");
  console.log("  cric");
}
function printFixtures(data, ymd) {
  const lines = cricketFixtureLines(data, ymd);
  if (lines.length === 1 && lines[0] === "none today") {
    console.log("No cricket fixtures found today.");
    return;
  }
  for (const line of lines) {
    console.log(line);
  }
}
async function main() {
  try {
    const args = process.argv.slice(2);
    if (args[0] === "--help" || args[0] === "-h") {
      usage();
      return;
    }
    if (args.length > 0) {
      throw new Error("This command takes no arguments.");
    }
    const today = toYmd(/* @__PURE__ */ new Date());
    const data = await fetchTodayCricket(today);
    printFixtures(data, today);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    console.error("");
    usage();
    process.exit(1);
  }
}
void main();
