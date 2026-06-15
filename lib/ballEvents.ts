import stringWidth from "string-width";

type ApiActionDetail = {
  type?: string;
  timeLabel?: { value?: string };
};

type ApiPlayerAction = {
  playerName?: string;
  actionType?: string;
  actions?: ApiActionDetail[];
};

type TeamWithActions = {
  shortName?: string;
  name?: { shortName?: string; abbreviation?: string };
  actions?: ApiPlayerAction[];
};

type SideEvent = {
  sortKey: number;
  minute: string;
  kind: string;
};

type PlayerGroup = {
  sortKey: number;
  displayName: string;
  items: SideEvent[];
};

const COLUMN_GAP = 8;

function parseMinuteSortKey(label: string): number {
  const match = String(label).match(/^(\d+)'\s*(?:\+\s*(\d+))?/);
  if (!match) return 99_999;
  const base = Number.parseInt(match[1], 10);
  const extra = match[2] ? Number.parseInt(match[2], 10) : 0;
  return base * 100 + extra;
}

function kindForActionType(type: string): string {
  switch (type) {
    case "Goal":
      return "";
    case "Penalty":
      return "pen";
    case "Own Goal":
      return "og";
    case "Red Card":
      return "RC";
    case "Two Yellow Cards":
      return "2YC";
    default:
      if (type.toLowerCase().includes("miss")) return "pen missed";
      return type.toLowerCase();
  }
}

function displayPlayerName(name: string): string {
  const parts = name.trim().split(/\s+/);
  const surname = parts[parts.length - 1] || name;
  return surname.charAt(0).toUpperCase() + surname.slice(1).toLowerCase();
}

function displayMinute(label: string): string {
  return label.replace(/'/g, "");
}

function padEndDisplay(text: string, width: number): string {
  const w = stringWidth(text);
  if (w >= width) return text;
  return text + " ".repeat(width - w);
}

function collectSideEvents(side: TeamWithActions | undefined): PlayerGroup[] {
  const byPlayer = new Map<string, PlayerGroup>();

  for (const entry of side?.actions || []) {
    const player = String(entry.playerName || "").trim();
    if (!player) continue;

    for (const action of entry.actions || []) {
      const type = String(action.type || "").trim();
      if (!type) continue;
      const rawMinute = String(action.timeLabel?.value || "").trim();
      const sortKey = parseMinuteSortKey(rawMinute);
      const minute = displayMinute(rawMinute || "?");
      const kind = kindForActionType(type);

      let group = byPlayer.get(player);
      if (!group) {
        group = {
          sortKey,
          displayName: displayPlayerName(player),
          items: [],
        };
        byPlayer.set(player, group);
      }
      group.sortKey = Math.min(group.sortKey, sortKey);
      group.items.push({ sortKey, minute, kind });
    }
  }

  return [...byPlayer.values()].sort((a, b) => a.sortKey - b.sortKey);
}

function formatPlayerGroup(group: PlayerGroup): string {
  const sorted = [...group.items].sort((a, b) => a.sortKey - b.sortKey);
  const times = sorted
    .map((item) => (item.kind ? `${item.minute} ${item.kind}` : item.minute))
    .join(", ");
  return `${group.displayName} ${times}`;
}

export function matchEventLines(
  homeTeam: TeamWithActions | undefined,
  awayTeam: TeamWithActions | undefined,
  indent = "    ",
): string[] {
  const homeLines = collectSideEvents(homeTeam).map(formatPlayerGroup);
  const awayLines = collectSideEvents(awayTeam).map(formatPlayerGroup);
  if (homeLines.length === 0 && awayLines.length === 0) return [];

  const leftWidth = Math.max(
    ...homeLines.map((line) => stringWidth(line)),
    16,
  );
  const rows = Math.max(homeLines.length, awayLines.length);
  const lines: string[] = [];

  for (let i = 0; i < rows; i++) {
    const left = homeLines[i] || "";
    const right = awayLines[i] || "";
    lines.push(`${indent}${padEndDisplay(left, leftWidth + COLUMN_GAP)}${right}`);
  }

  return lines;
}
