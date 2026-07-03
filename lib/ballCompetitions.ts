import { readPhoneCliConfig } from "../config";

export type BallCompetitionEvent = {
  tournament?: {
    disambiguatedName?: string;
    name?: string;
    urn?: string;
  };
  eventGroupingLabel?: string;
};

export type BallCompetitionEntry = {
  key: string;
  displayName?: string;
};

const BUILT_IN_COMPETITIONS: BallCompetitionEntry[] = [
  { key: "fifaworldcup" },
  { key: "worldcup" },
  { key: "premierleague", displayName: "PL" },
  { key: "englishpremierleague", displayName: "PL" },
  { key: "facup" },
  { key: "leaguecup" },
  { key: "eflcup" },
  { key: "championsleague" },
  { key: "uefachampionsleague" },
  { key: "europaleague", displayName: "EL" },
  { key: "uefaeuropaleague", displayName: "EL" },
  { key: "championship" },
  { key: "englishchampionship" },
  { key: "leagueone" },
  { key: "englishleagueone" },
  { key: "scottishpremiership" },
];

export const COMPETITION_ORDER = [
  "fifaworldcup",
  "premierleague",
  "facup",
  "leaguecup",
  "championsleague",
  "europaleague",
  "championship",
  "leagueone",
  "scottishpremiership",
];

function normalizeText(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function urnSlug(urn: unknown): string {
  if (!urn) return "";
  const parts = String(urn).split(":");
  return parts[parts.length - 1] || "";
}

function rawCompetitionName(event: BallCompetitionEvent): string {
  return (
    event?.tournament?.disambiguatedName ||
    event?.tournament?.name ||
    event?.eventGroupingLabel ||
    "Other"
  );
}

function eventCompetitionCandidates(event: BallCompetitionEvent): string[] {
  return [
    event?.tournament?.disambiguatedName,
    event?.tournament?.name,
    urnSlug(event?.tournament?.urn),
    event?.eventGroupingLabel,
    rawCompetitionName(event),
  ]
    .filter(Boolean)
    .map(normalizeText);
}

function readConfiguredCompetitions(): BallCompetitionEntry[] | null {
  const ballConfig = readPhoneCliConfig().ball || {};
  const raw = ballConfig.competitions;
  if (!Array.isArray(raw)) return null;

  const entries: BallCompetitionEntry[] = [];
  for (const item of raw) {
    if (typeof item === "string") {
      const key = item.trim();
      if (key) entries.push({ key });
      continue;
    }
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const record = item as Record<string, unknown>;
    const key = String(record.key || record.match || record.name || "").trim();
    if (!key) continue;
    const displayName = String(record.displayName || "").trim();
    entries.push(displayName ? { key, displayName } : { key });
  }
  return entries.length > 0 ? entries : null;
}

function matchCompetitionEntry(
  event: BallCompetitionEvent,
  entries: BallCompetitionEntry[],
): BallCompetitionEntry | null {
  const candidates = eventCompetitionCandidates(event);
  for (const entry of entries) {
    const entryKey = normalizeText(entry.key);
    if (!entryKey) continue;
    if (candidates.some((candidate) => candidate === entryKey || candidate.includes(entryKey))) {
      return entry;
    }
  }
  return null;
}

function activeCompetitionEntries(): BallCompetitionEntry[] {
  return readConfiguredCompetitions() ?? BUILT_IN_COMPETITIONS;
}

export function competitionLabel(event: BallCompetitionEvent): string {
  const fullName = rawCompetitionName(event);
  const matched = matchCompetitionEntry(event, activeCompetitionEntries());
  return matched?.displayName?.trim() || fullName;
}

export function competitionAllowed(event: BallCompetitionEvent): boolean {
  const configured = readConfiguredCompetitions();
  if (configured) {
    return matchCompetitionEntry(event, configured) != null;
  }
  const candidates = eventCompetitionCandidates(event);
  const allowed = new Set(BUILT_IN_COMPETITIONS.map((entry) => normalizeText(entry.key)));
  return candidates.some((candidate) => allowed.has(candidate));
}

export function competitionSortRank(label: string): number {
  const normalized = normalizeText(label);
  const index = COMPETITION_ORDER.findIndex((name) => {
    const orderKey = normalizeText(name);
    return normalized === orderKey || normalized.includes(orderKey) || orderKey.includes(normalized);
  });
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}
