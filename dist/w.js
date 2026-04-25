#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const WEATHER_BASE_URL = "https://weather-broker-cdn.api.bbci.co.uk/en/forecast/aggregated";
const DEFAULT_POSTCODE = "cm2";
const ANSI_RESET = "\x1b[0m";
const ANSI_BLUE = "\x1b[34m";
const ANSI_GREEN = "\x1b[32m";
const ANSI_YELLOW = "\x1b[33m";
const ANSI_ORANGE = "\x1b[38;5;208m";
const ANSI_RED = "\x1b[31m";
const ANSI_REGEX = /\x1b\[[0-9;]*m/g;
function visibleLength(value) {
    return value.replace(ANSI_REGEX, "").length;
}
function usage() {
    console.log("Usage:");
    console.log("  w");
    console.log("  w <postcode>");
    console.log("");
    console.log("Examples:");
    console.log("  w");
    console.log("  w ws9");
    console.log("  w sw1a");
}
function sanitizePostcode(input) {
    return String(input || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "");
}
function parseArgs(argv) {
    const args = argv.slice(2);
    if (args[0] === "--help" || args[0] === "-h") {
        return { help: true };
    }
    if (args.length === 0) {
        return { postcode: DEFAULT_POSTCODE };
    }
    if (args.length > 1) {
        throw new Error("Pass at most one postcode.");
    }
    const postcode = sanitizePostcode(args[0]);
    if (!postcode) {
        return { postcode: DEFAULT_POSTCODE };
    }
    return { postcode };
}
async function fetchWeather(postcode) {
    const url = `${WEATHER_BASE_URL}/${encodeURIComponent(postcode)}`;
    const response = await fetch(url, {
        method: "GET",
        headers: {
            Accept: "*/*",
            "Accept-Language": "en-GB,en-US;q=0.9,en;q=0.8",
            "Cache-Control": "no-cache",
            Pragma: "no-cache",
            Priority: "u=1, i",
            Referer: "https://www.bbc.co.uk/",
        },
    });
    if (!response.ok) {
        throw new Error(`Weather API request failed (${response.status})`);
    }
    return (await response.json());
}
function formatDayCells(report) {
    const date = formatDisplayDate(report.localDate);
    const weather = report.weatherTypeText || report.enhancedWeatherDescription || "Unknown";
    const hi = formatMaxTemp(report.maxTempC);
    const lo = formatMinTemp(report.minTempC);
    const rain = formatRain(report.precipitationProbabilityInPercent);
    const windSpeed = formatWindSpeed(report.windSpeedMph);
    const windDir = report.windDirectionAbbreviation || "?";
    return [date, weather, lo, hi, rain, `${windSpeed} ${windDir}`];
}
function formatDisplayDate(localDate) {
    if (!localDate)
        return "unknown-date";
    const d = new Date(`${localDate}T00:00:00`);
    if (Number.isNaN(d.getTime()))
        return localDate;
    const weekday = d.toLocaleDateString("en-GB", { weekday: "short" });
    const day = d.toLocaleDateString("en-GB", { day: "2-digit" });
    const month = d.toLocaleDateString("en-GB", { month: "2-digit" });
    return `${weekday} ${day}/${month}`;
}
function formatHourlyTemp(value) {
    if (value == null)
        return "?";
    return formatMaxTemp(value);
}
function formatHourlyCells(report) {
    const time = report.timeslot || "??:??";
    const weather = report.weatherTypeText || report.enhancedWeatherDescription || "Unknown";
    const temp = formatHourlyTemp(report.temperatureC);
    const rain = formatRain(report.precipitationProbabilityInPercent);
    const windSpeed = formatWindSpeed(report.windSpeedMph);
    const windDir = report.windDirectionAbbreviation || "?";
    return [time, weather, temp, rain, `${windSpeed} ${windDir}`];
}
function shouldUseColor() {
    return Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
}
function colorize(value, color) {
    if (!shouldUseColor())
        return value;
    return `${color}${value}${ANSI_RESET}`;
}
function formatMaxTemp(value) {
    if (value == null)
        return "?";
    const text = `${value}C`;
    if (value < 5)
        return colorize(text, ANSI_BLUE);
    if (value <= 15)
        return colorize(text, ANSI_YELLOW);
    if (value <= 25)
        return colorize(text, ANSI_ORANGE);
    return colorize(text, ANSI_RED);
}
function formatMinTemp(value) {
    if (value == null)
        return "?";
    const text = `${value}C`;
    if (value < 0)
        return colorize(text, ANSI_BLUE);
    if (value <= 8)
        return colorize(text, ANSI_YELLOW);
    if (value <= 16)
        return colorize(text, ANSI_ORANGE);
    return colorize(text, ANSI_RED);
}
function formatRain(value) {
    if (value == null)
        return "?%";
    const text = `${value}%`;
    if (value > 80)
        return colorize(text, ANSI_RED);
    if (value >= 50)
        return colorize(text, ANSI_ORANGE);
    if (value >= 25)
        return colorize(text, ANSI_YELLOW);
    return colorize(text, ANSI_GREEN);
}
function formatWindSpeed(value) {
    if (value == null)
        return "?mph";
    const text = `${value}mph`;
    if (value > 40)
        return colorize(text, ANSI_RED);
    if (value >= 20)
        return colorize(text, ANSI_ORANGE);
    return colorize(text, ANSI_GREEN);
}
function makeAsciiTable(headers, rows, forcedWidths) {
    const padCell = (value, width) => {
        const padCount = width - visibleLength(value);
        return padCount > 0 ? `${value}${" ".repeat(padCount)}` : value;
    };
    const widths = headers.map((header, colIdx) => {
        let max = Math.max(visibleLength(header), forcedWidths?.[colIdx] || 0);
        for (const row of rows) {
            const cell = row[colIdx] || "";
            const len = visibleLength(cell);
            if (len > max)
                max = len;
        }
        return max;
    });
    const border = `+${widths.map((w) => "-".repeat(w + 2)).join("+")}+`;
    const renderRow = (cells) => `| ${cells.map((cell, i) => padCell(cell || "", widths[i])).join(" | ")} |`;
    const lines = [border, renderRow(headers), border];
    for (const row of rows) {
        lines.push(renderRow(row));
    }
    lines.push(border);
    return lines;
}
function printForecast(data, requestedPostcode) {
    const location = data.location?.name || data.location?.id || requestedPostcode.toUpperCase();
    const lastUpdated = data.lastUpdated || "unknown";
    const reports = (data.forecasts || [])
        .map((f) => f.summary?.report)
        .filter((r) => Boolean(r));
    console.log(`Weather for ${location}`);
    console.log(`Last updated: ${lastUpdated}`);
    console.log("");
    if (reports.length === 0) {
        console.log("No daily forecast data available.");
        return;
    }
    const dayHeaders = ["Date", "Weather", "Min", "Max", "Rain", "Wind"];
    const dayRows = reports.slice(0, 7).map((report) => formatDayCells(report));
    const hourlyReports = (data.forecasts || [])
        .flatMap((f) => f.detailed?.reports || [])
        .filter((r) => Boolean(r && r.localDate && r.timeslot));
    const todayDate = reports[0]?.localDate || "";
    const tomorrowDate = reports[1]?.localDate || "";
    const rowsForDate = (date) => {
        if (!date)
            return [];
        return hourlyReports
            .filter((r) => r.localDate === date)
            .sort((a, b) => (a.timeslot || "").localeCompare(b.timeslot || ""))
            .map((report) => formatHourlyCells(report));
    };
    const todayHourlyRows = rowsForDate(todayDate);
    const tomorrowHourlyRows = rowsForDate(tomorrowDate);
    const allHourlyRows = [...tomorrowHourlyRows, ...todayHourlyRows];
    const tempWidth = Math.max(visibleLength("Temp"), visibleLength("Min"), visibleLength("Max"), ...dayRows.map((r) => Math.max(visibleLength(r[3] || ""), visibleLength(r[4] || ""))), ...allHourlyRows.map((r) => visibleLength(r[3] || "")));
    const sharedWidths = {
        dateOrTime: Math.max(visibleLength("Date"), visibleLength("Time"), ...dayRows.map((r) => visibleLength(r[0] || "")), ...allHourlyRows.map((r) => visibleLength(r[0] || ""))),
        weather: Math.max(visibleLength("Weather"), ...dayRows.map((r) => visibleLength(r[1] || "")), ...allHourlyRows.map((r) => visibleLength(r[1] || ""))),
        rain: Math.max(visibleLength("Rain"), ...dayRows.map((r) => visibleLength(r[4] || "")), ...allHourlyRows.map((r) => visibleLength(r[3] || ""))),
        wind: Math.max(visibleLength("Wind"), ...dayRows.map((r) => visibleLength(r[5] || "")), ...allHourlyRows.map((r) => visibleLength(r[4] || ""))),
    };
    const hourlyHeaders = ["Time", "Weather", "Temp", "Rain", "Wind"];
    const hourlyWidths = [
        sharedWidths.dateOrTime,
        sharedWidths.weather,
        tempWidth,
        sharedWidths.rain,
        sharedWidths.wind,
    ];
    const printHourlySection = (date, rows) => {
        if (!date || rows.length === 0)
            return;
        console.log(`Hourly forecast for ${formatDisplayDate(date)}`);
        const lines = makeAsciiTable(hourlyHeaders, rows, hourlyWidths);
        for (const line of lines) {
            console.log(line);
        }
        console.log("");
    };
    // Requested order: tomorrow hourly, today hourly, week ahead.
    printHourlySection(tomorrowDate, tomorrowHourlyRows);
    printHourlySection(todayDate, todayHourlyRows);
    console.log("Week ahead");
    const dayWidths = [
        sharedWidths.dateOrTime,
        sharedWidths.weather,
        tempWidth,
        tempWidth,
        sharedWidths.rain,
        sharedWidths.wind,
    ];
    const dayTableLines = makeAsciiTable(dayHeaders, dayRows, dayWidths);
    for (const line of dayTableLines) {
        console.log(line);
    }
}
async function main() {
    try {
        const parsed = parseArgs(process.argv);
        if (parsed.help) {
            usage();
            return;
        }
        const postcode = parsed.postcode || DEFAULT_POSTCODE;
        const data = await fetchWeather(postcode);
        printForecast(data, postcode);
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
