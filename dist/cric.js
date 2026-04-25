#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bbc_1 = require("./bbc");
const CRICKET_BASE_URL = "https://web-cdn.api.bbci.co.uk/wc-poll-data/container/sport-data-scores-fixtures";
const CRICKET_URN = "urn:bbc:sportsdata:cricket:tournament-collection:collated";
const DAY_MS = 24 * 60 * 60 * 1000;
function usage() {
    console.log("Usage:");
    console.log("  cric");
}
function teamLabel(team) {
    return team?.shortName || team?.name || "TBC";
}
function asInningsList(team) {
    const innings = team?.innings;
    if (!innings)
        return [];
    return Array.isArray(innings) ? innings : [innings];
}
function inningsScore(innings) {
    if (innings.runs == null)
        return "";
    const wickets = innings.wickets == null ? "-" : String(innings.wickets);
    const overs = innings.overs ? ` (${innings.overs})` : "";
    const declared = innings.isDeclared ? "d" : "";
    return `${innings.runs}/${wickets}${declared}${overs}`;
}
function inningsLine(team, innings, index) {
    const label = teamLabel(team);
    const suffix = index > 0 ? ` (Inns ${index + 1})` : "";
    if (!innings)
        return `${label}${suffix}: -`;
    const score = inningsScore(innings);
    return `${label}${suffix}: ${score || "-"}`;
}
function normalizeText(value) {
    return String(value || "").toLowerCase();
}
function competitionLabel(secondary, event) {
    return (secondary.displayLabel ||
        event.tournamentName ||
        event.eventGroupingLabel ||
        "Other");
}
function isAllowedCompetition(label) {
    const text = normalizeText(label);
    if (!text)
        return false;
    if (text.includes("women"))
        return false;
    const isCountyChampionship = text.includes("county championship");
    const isEnglishLeagueOrCup = (text.includes("league") || text.includes("cup")) &&
        (text.includes("england") ||
            text.includes("english") ||
            text.includes("county") ||
            text.includes("vitality blast") ||
            text.includes("one-day cup") ||
            text.includes("one day cup") ||
            text.includes("the hundred"));
    const isTest = text.includes("test");
    const isMensInternational = text.includes("international") ||
        text.includes("odi") ||
        text.includes("t20i") ||
        text.includes("world cup") ||
        text.includes("champions trophy") ||
        text.includes("ashes");
    return isCountyChampionship || isEnglishLeagueOrCup || isTest || isMensInternational;
}
function multiDayLabel(event, selectedYmd) {
    const start = event.matchDateSummary?.startDate;
    const end = event.matchDateSummary?.endDate;
    if (!start || !end || start === end)
        return "";
    const startDate = new Date(`${start}T00:00:00Z`);
    const endDate = new Date(`${end}T00:00:00Z`);
    const selectedDate = new Date(`${selectedYmd}T00:00:00Z`);
    if (Number.isNaN(startDate.getTime()) ||
        Number.isNaN(endDate.getTime()) ||
        Number.isNaN(selectedDate.getTime())) {
        return "";
    }
    if (selectedDate < startDate || selectedDate > endDate)
        return "";
    const dayNumber = Math.floor((selectedDate.getTime() - startDate.getTime()) / DAY_MS) + 1;
    return `Day ${dayNumber}`;
}
function printFixtures(data, ymd) {
    console.log(`Cricket fixtures for ${ymd}`);
    const groups = data.eventGroups || [];
    let count = 0;
    for (const group of groups) {
        for (const secondary of group.secondaryGroups || []) {
            const events = [...(secondary.events || [])].sort((a, b) => {
                const aTime = new Date(a.startDateTime || "").getTime();
                const bTime = new Date(b.startDateTime || "").getTime();
                return aTime - bTime;
            });
            const allowedEvents = events.filter((event) => isAllowedCompetition(competitionLabel(secondary, event)));
            if (allowedEvents.length === 0)
                continue;
            console.log("");
            console.log(secondary.displayLabel || "Other");
            for (const event of allowedEvents) {
                count += 1;
                const homeTeam = event.participants?.homeTeam;
                const awayTeam = event.participants?.awayTeam;
                const homeInnings = asInningsList(homeTeam);
                const awayInnings = asInningsList(awayTeam);
                const maxInnings = Math.max(homeInnings.length, awayInnings.length, 1);
                const dayLabel = multiDayLabel(event, ymd);
                const header = [
                    event.startTime || "??:??",
                    `${teamLabel(homeTeam)} vs ${teamLabel(awayTeam)}`,
                    event.groundShortName || "-",
                    dayLabel || "-",
                    event.matchSummary?.resultString || "-",
                ].join(" | ");
                console.log(header);
                for (let i = 0; i < maxInnings; i += 1) {
                    console.log(`  ${inningsLine(homeTeam, homeInnings[i], i)}`);
                    console.log(`  ${inningsLine(awayTeam, awayInnings[i], i)}`);
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
    const url = `${CRICKET_BASE_URL}?selectedEndDate=${ymd}` +
        `&selectedStartDate=${ymd}` +
        `&todayDate=${ymd}` +
        `&urn=${encodeURIComponent(CRICKET_URN)}`;
    return (0, bbc_1.fetchBbcJson)(url, ymd, "cricket");
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
        const today = (0, bbc_1.toYmd)(new Date());
        const data = await fetchTodayCricket(today);
        printFixtures(data, today);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(message);
        console.error("");
        usage();
        process.exit(1);
    }
}
void main();
