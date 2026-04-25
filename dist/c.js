#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bbc_1 = require("./bbc");
const CRICKET_BASE_URL = "https://web-cdn.api.bbci.co.uk/wc-poll-data/container/sport-data-scores-fixtures";
const CRICKET_URN = "urn:bbc:sportsdata:cricket:tournament-collection:collated";
function usage() {
    console.log("Usage:");
    console.log("  c");
}
function scoreline(team) {
    const innings = team?.innings;
    if (!innings || innings.runs == null)
        return "";
    const wickets = innings.wickets == null ? "-" : String(innings.wickets);
    const overs = innings.overs ? ` (${innings.overs})` : "";
    return ` ${innings.runs}/${wickets}${overs}`;
}
function teamLabel(team) {
    return team?.shortName || team?.name || "TBC";
}
function fixtureLine(event) {
    const home = teamLabel(event.participants?.homeTeam);
    const away = teamLabel(event.participants?.awayTeam);
    const homeScore = scoreline(event.participants?.homeTeam);
    const awayScore = scoreline(event.participants?.awayTeam);
    const start = event.startTime || "??:??";
    const ground = event.groundShortName ? ` @ ${event.groundShortName}` : "";
    const summary = event.matchSummary?.resultString ? ` - ${event.matchSummary.resultString}` : "";
    if (homeScore || awayScore) {
        return `${start} ${home}${homeScore} vs ${away}${awayScore}${ground}${summary}`;
    }
    return `${start} ${home} vs ${away}${ground}${summary}`;
}
function scorecardUrl(event) {
    if (!event.conciseViewScorecardLinkUrl)
        return "";
    if (event.conciseViewScorecardLinkUrl.startsWith("http")) {
        return event.conciseViewScorecardLinkUrl;
    }
    return `https://www.bbc.co.uk${event.conciseViewScorecardLinkUrl}`;
}
function printFixtures(data, ymd) {
    console.log(`Cricket scorecards for ${ymd}`);
    const groups = data.eventGroups || [];
    let count = 0;
    for (const group of groups) {
        for (const secondary of group.secondaryGroups || []) {
            const events = [...(secondary.events || [])].sort((a, b) => {
                const aTime = new Date(a.startDateTime || "").getTime();
                const bTime = new Date(b.startDateTime || "").getTime();
                return aTime - bTime;
            });
            if (events.length === 0)
                continue;
            const heading = secondary.displayLabel || "Other";
            console.log("");
            console.log(heading);
            for (const event of events) {
                count += 1;
                console.log(`- ${fixtureLine(event)}`);
                const url = scorecardUrl(event);
                if (url) {
                    console.log(`  ${url}`);
                }
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
