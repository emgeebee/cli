#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const OCTOPUS_BASE_URL = "https://api.octopus.energy/v1";
const TOKEN_ENV = "OCTOPUS_BASIC_AUTH_TOKEN";
const ACCOUNT_ENV = "OCTOPUS_ACCOUNT_NUMBER";
const DAY_MS = 24 * 60 * 60 * 1000;
const ANSI_RESET = "\x1b[0m";
const ANSI_GREEN = "\x1b[32m";
const ANSI_YELLOW = "\x1b[33m";
const ANSI_ORANGE = "\x1b[38;5;208m";
const ANSI_RED = "\x1b[31m";
function usage() {
    console.log("Usage:");
    console.log("  octo");
    console.log("");
    console.log("Required environment variables:");
    console.log(`  ${TOKEN_ENV}=<basic auth token>`);
    console.log(`  ${ACCOUNT_ENV}=<account number, e.g. A-12345678>`);
}
function requiredEnv(name) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing environment variable: ${name}`);
    }
    return value;
}
function latestAgreement(agreements) {
    if (!agreements || agreements.length === 0) {
        throw new Error("No agreement found on meter point.");
    }
    const sorted = [...agreements].sort((a, b) => {
        const aTs = new Date(a.valid_from || "").getTime();
        const bTs = new Date(b.valid_from || "").getTime();
        return aTs - bTs;
    });
    return sorted[sorted.length - 1];
}
function productFromTariffCode(tariffCode) {
    // Mirrors: tariff_code.split('-').slice(0, -1).slice(2).join('-')
    const parts = tariffCode.split("-").slice(0, -1).slice(2);
    if (parts.length === 0) {
        throw new Error(`Unable to derive product code from tariff code: ${tariffCode}`);
    }
    return parts.join("-");
}
function deriveTariffs(account) {
    const property = account.properties?.[0];
    if (!property) {
        throw new Error("No property found on account.");
    }
    const emPoint = property.electricity_meter_points?.[0];
    const gmPoint = property.gas_meter_points?.[0];
    if (!emPoint || !gmPoint) {
        throw new Error("Electricity and gas meter points are required.");
    }
    const etariff = latestAgreement(emPoint.agreements);
    const gtariff = latestAgreement(gmPoint.agreements);
    if (!etariff.tariff_code || !gtariff.tariff_code) {
        throw new Error("Missing tariff_code on one or more agreements.");
    }
    const eProduct = productFromTariffCode(etariff.tariff_code);
    const gProduct = productFromTariffCode(gtariff.tariff_code);
    return {
        etariff,
        gtariff,
        etariffPrices: `${OCTOPUS_BASE_URL}/products/${eProduct}/electricity-tariffs/${etariff.tariff_code}/standard-unit-rates/`,
        gtariffPrices: `${OCTOPUS_BASE_URL}/products/${gProduct}/gas-tariffs/${gtariff.tariff_code}/standard-unit-rates/`,
    };
}
async function fetchOctopusJson(url, token) {
    const raw = token.trim();
    const candidates = new Set();
    if (raw.toLowerCase().startsWith("basic ")) {
        candidates.add(raw);
    }
    else {
        // Accept either:
        // 1) pre-encoded Basic token, or
        // 2) raw Octopus API key (e.g. sk_live_...) requiring "key:" base64 encoding.
        candidates.add(`Basic ${raw}`);
        candidates.add(`Basic ${Buffer.from(`${raw}:`).toString("base64")}`);
    }
    let lastStatus = 0;
    for (const authHeader of candidates) {
        const response = await fetch(url, {
            headers: {
                Accept: "application/json",
                Authorization: authHeader,
            },
        });
        if (response.ok) {
            return (await response.json());
        }
        lastStatus = response.status;
        if (response.status !== 401) {
            throw new Error(`Octopus API request failed (${response.status}) for ${url}`);
        }
    }
    throw new Error(`Octopus API request failed (${lastStatus || 401}) for ${url}`);
}
function toIsoNoMs(date) {
    return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}
function ratesUrlWithWindow(baseUrl, from, to) {
    const url = new URL(baseUrl);
    url.searchParams.set("period_from", toIsoNoMs(from));
    url.searchParams.set("period_to", toIsoNoMs(to));
    return url.toString();
}
function shouldUseColor() {
    return Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
}
function colorize(text, color) {
    if (!shouldUseColor())
        return text;
    return `${color}${text}${ANSI_RESET}`;
}
function formatWindow(rate) {
    const from = rate.valid_from ? new Date(rate.valid_from) : null;
    const to = rate.valid_to ? new Date(rate.valid_to) : null;
    if (!from || Number.isNaN(from.getTime()) || !to || Number.isNaN(to.getTime())) {
        return "unknown";
    }
    const dayLabel = from.toLocaleDateString("en-GB", {
        weekday: "short",
        timeZone: "Europe/London",
    });
    const day = from.toLocaleDateString("en-GB", { day: "numeric", timeZone: "Europe/London" });
    const month = from.toLocaleDateString("en-GB", { month: "numeric", timeZone: "Europe/London" });
    const startTime = from.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Europe/London",
    });
    const endTime = to.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Europe/London",
    });
    const capDay = dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1).toLowerCase();
    return `${capDay} ${day}/${month} ${startTime} -> ${endTime}`;
}
function colorForRate(rateIncVat, fuel) {
    if (fuel === "electricity") {
        if (rateIncVat <= 5)
            return ANSI_GREEN;
        if (rateIncVat <= 12)
            return ANSI_YELLOW;
        if (rateIncVat < 20)
            return ANSI_ORANGE;
        return ANSI_RED;
    }
    if (rateIncVat < 4)
        return ANSI_GREEN;
    if (rateIncVat <= 5)
        return ANSI_YELLOW;
    if (rateIncVat < 6)
        return ANSI_ORANGE;
    return ANSI_RED;
}
function formatRateLine(rate, fuel) {
    const window = formatWindow(rate);
    const inc = rate.value_inc_vat == null ? "?" : `${rate.value_inc_vat.toFixed(4)}p`;
    if (rate.value_inc_vat == null) {
        return `${window} | ${inc}`;
    }
    return `${window} | ${colorize(inc, colorForRate(rate.value_inc_vat, fuel))}`;
}
function printRates(title, rates, fuel) {
    console.log("");
    console.log(title);
    if (rates.length === 0) {
        console.log("- No rates returned for selected window.");
        return;
    }
    const sorted = [...rates].sort((a, b) => {
        const aTs = new Date(a.valid_from || "").getTime();
        const bTs = new Date(b.valid_from || "").getTime();
        return aTs - bTs;
    });
    for (const rate of sorted) {
        console.log(`- ${formatRateLine(rate, fuel)}`);
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
        const token = requiredEnv(TOKEN_ENV);
        const accountNumber = requiredEnv(ACCOUNT_ENV);
        const accountUrl = `${OCTOPUS_BASE_URL}/accounts/${accountNumber}/`;
        const account = await fetchOctopusJson(accountUrl, token);
        const derived = deriveTariffs(account);
        const from = new Date();
        const to = new Date(from.getTime() + 2 * DAY_MS);
        const eRatesUrl = ratesUrlWithWindow(derived.etariffPrices, from, to);
        const gRatesUrl = ratesUrlWithWindow(derived.gtariffPrices, from, to);
        const [electricity, gas] = await Promise.all([
            fetchOctopusJson(eRatesUrl, token),
            fetchOctopusJson(gRatesUrl, token),
        ]);
        console.log(`Octopus account ${accountNumber}`);
        console.log(`Window: ${toIsoNoMs(from)} -> ${toIsoNoMs(to)}`);
        console.log(`Electric tariff: ${derived.etariff.tariff_code}`);
        console.log(`Gas tariff: ${derived.gtariff.tariff_code}`);
        printRates("Electricity rates (inc VAT)", electricity.results || [], "electricity");
        printRates("Gas rates (inc VAT)", gas.results || [], "gas");
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
