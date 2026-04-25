"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toYmd = toYmd;
exports.fetchBbcJson = fetchBbcJson;
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
            Referer: `https://www.bbc.co.uk/sport/${sport}/scores-fixtures/${refDate}`,
        },
    });
    if (!response.ok) {
        throw new Error(`API request failed (${response.status})`);
    }
    return (await response.json());
}
