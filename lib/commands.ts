import { spawnSync } from "node:child_process";
import { join } from "node:path";

export type LauncherCommand = {
  value: number;
  cmd: string;
  name: string;
  description: string;
  extraArgs?: string;
};

export const LAUNCHER_COMMANDS: LauncherCommand[] = [
  { value: 1, cmd: "ball", name: "Football fixtures", description: "Football fixtures" },
  { value: 2, cmd: "ball", name: "PL table", description: "Premier League table", extraArgs: "pl" },
  { value: 3, cmd: "ball", name: "Villa fixtures", description: "Aston Villa fixtures", extraArgs: "avfc" },
  { value: 4, cmd: "cal", name: "cal", description: "Calendar" },
  { value: 5, cmd: "w", name: "w", description: "Weather" },
  { value: 6, cmd: "cric", name: "cric", description: "Cricket fixtures" },
  { value: 7, cmd: "octo", name: "octo", description: "Octopus energy" },
  { value: 8, cmd: "bday", name: "bday", description: "Birthday age table" },
  { value: 9, cmd: "money", name: "money", description: "Monthly countdown value" },
  { value: 10, cmd: "cmd", name: "cmd", description: "Home automation shortcuts" },
  { value: 11, cmd: "fuel", name: "fuel", description: "UK fuel prices" },
  { value: 12, cmd: "r", name: "CHM", description: "UK rail boards", extraArgs: "CHM" },
  { value: 13, cmd: "temp", name: "temp", description: "House temperature history" },
  { value: 14, cmd: "solar", name: "solar", description: "Solar yield and power history" },
];

export function launcherArgs(command: LauncherCommand): string[] {
  const raw = command.extraArgs?.trim();
  return raw ? raw.split(/\s+/) : [];
}

export function runLauncherCommand(command: LauncherCommand): number {
  const scriptPath = join(__dirname, `${command.cmd}.js`);
  const result = spawnSync(process.execPath, [scriptPath, ...launcherArgs(command)], {
    stdio: "inherit",
  });
  return result.status ?? 1;
}

export type StatusShortcutPanel = "weather" | "solar" | "cric" | "footy" | "calendar";

export type StatusShortcut = {
  key: string;
  label: string;
  cmd: string;
  extraArgs?: string;
  panel?: StatusShortcutPanel;
};

export const STATUS_SHORTCUTS: StatusShortcut[] = [
  { key: "s", label: "solar", cmd: "solar", panel: "solar" },
  { key: "w", label: "weather", cmd: "w", panel: "weather" },
  { key: "o", label: "octo", cmd: "octo" },
  { key: "i", label: "cric", cmd: "cric", panel: "cric" },
  { key: "f", label: "footy", cmd: "ball", panel: "footy" },
  { key: "d", label: "dates", cmd: "cal", panel: "calendar" },
  { key: "b", label: "bdays", cmd: "bday" },
];

const STATUS_SHORTCUT_BY_KEY = Object.fromEntries(
  STATUS_SHORTCUTS.map((shortcut) => [shortcut.key, shortcut]),
) as Record<string, StatusShortcut>;

export function statusShortcutForKey(key: string): StatusShortcut | null {
  return STATUS_SHORTCUT_BY_KEY[key] ?? null;
}

export type StatusShortcutEntry = {
  key: string;
  label: string;
};

export function formatStatusShortcutLine(entries: StatusShortcutEntry[]): string {
  return entries.map((entry) => `${entry.key}:${entry.label}`).join("  ");
}

export const STATUS_BAR_SHORTCUTS: StatusShortcutEntry[] = [
  { key: "a", label: "all" },
  { key: "c", label: "cmd" },
  { key: "n", label: "next" },
  { key: "p", label: "pause" },
  { key: "q", label: "quit" },
];

export function buildStatusBarShortcutLines(): string[] {
  return [formatStatusShortcutLine(STATUS_BAR_SHORTCUTS)];
}

export function allStatusShortcutEntries(): StatusShortcutEntry[] {
  return [
    ...STATUS_SHORTCUTS.map(({ key, label }) => ({ key, label })),
    { key: "c", label: "cmd" },
    { key: "a", label: "all" },
    { key: "q", label: "quit" },
  ];
}

export const SHORTCUTS_MENU_INNER_WIDTH = 34;

const STATUS_MENU_SHORTCUTS: StatusShortcutEntry[] = [
  { key: "c", label: "cmd" },
  { key: "a", label: "back" },
  { key: "q", label: "quit" },
];

export function buildAllShortcutsMenuLines(): string[] {
  const lines = ["=== Shortcuts ===", ""];
  for (const { key, label } of STATUS_SHORTCUTS) {
    lines.push(`  ${key}  ${label}`);
  }
  lines.push("");
  for (const { key, label } of STATUS_MENU_SHORTCUTS) {
    lines.push(`  ${key}  ${label}`);
  }
  return lines;
}

export function statusShortcutsBoxWidth(): number {
  return formatStatusShortcutLine(STATUS_BAR_SHORTCUTS).length;
}

/** @deprecated Use statusShortcutsBoxWidth */
export function statusShortcutFooterWidth(): number {
  return statusShortcutsBoxWidth();
}

export function runStatusShortcut(shortcut: StatusShortcut): number {
  return runLauncherCommand({
    value: 0,
    cmd: shortcut.cmd,
    name: shortcut.label,
    description: shortcut.label,
    extraArgs: shortcut.extraArgs,
  });
}
