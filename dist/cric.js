#!/usr/bin/env node
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

// cric.ts
var CRICKET_BASE_URL = "https://web-cdn.api.bbci.co.uk/wc-poll-data/container/sport-data-scores-fixtures";
var CRICKET_URN = "urn:bbc:sportsdata:cricket:tournament-collection:collated";
var DAY_MS = 24 * 60 * 60 * 1e3;
function usage() {
  console.log("Usage:");
  console.log("  cric");
}
function teamLabel(team) {
  return team?.shortName || team?.name || "TBC";
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
function inningsLine(team, innings, index) {
  const label = teamLabel(team);
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
function orderedInningsLines(homeTeam, awayTeam) {
  const entries = [
    ...asInningsList(homeTeam).map((innings, idx) => ({ team: homeTeam, innings, localIndex: idx })),
    ...asInningsList(awayTeam).map((innings, idx) => ({ team: awayTeam, innings, localIndex: idx }))
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
function normalizeText(value) {
  return String(value || "").toLowerCase();
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
function printFixtures(data, ymd) {
  console.log(`Cricket fixtures for ${ymd}`);
  const groups = data.eventGroups || [];
  let count = 0;
  for (const group of groups) {
    for (const secondary of group.secondaryGroups || []) {
      const events = [...secondary.events || []].sort((a, b) => {
        const aTime = new Date(a.startDateTime || "").getTime();
        const bTime = new Date(b.startDateTime || "").getTime();
        return aTime - bTime;
      });
      const allowedEvents = events.filter(
        (event) => isAllowedCompetition(competitionLabel(secondary, event))
      );
      if (allowedEvents.length === 0) continue;
      console.log("");
      console.log(secondary.displayLabel || "Other");
      for (const event of allowedEvents) {
        count += 1;
        const homeTeam = event.participants?.homeTeam;
        const awayTeam = event.participants?.awayTeam;
        const dayLabel = multiDayLabel(event, ymd);
        const header = [
          event.startTime || "??:??",
          `${teamLabel(homeTeam)} vs ${teamLabel(awayTeam)}`,
          event.groundShortName || "-",
          dayLabel || "-",
          event.matchSummary?.resultString || "-"
        ].join(" | ");
        console.log(header);
        for (const line of orderedInningsLines(homeTeam, awayTeam)) {
          console.log(line);
        }
        console.log("");
      }
    }
  }
  if (count === 0) {
    console.log("No cricket fixtures found today.");
  }
}
async function fetchTodayCricket(ymd) {
  const url = `${CRICKET_BASE_URL}?selectedEndDate=${ymd}&selectedStartDate=${ymd}&todayDate=${ymd}&urn=${encodeURIComponent(CRICKET_URN)}`;
  return fetchBbcJson(url, ymd, "cricket");
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
