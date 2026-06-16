import { formatWfhLine, toggleWfhStatus } from "./wfhApi";

export const CMD_BASE_URL = "http://api.emgeebee.buzz:1880";

export type CmdRoom = "shed" | "bedroom";
export type CmdDevice = "lights" | "music" | "heater";
export type CmdState = "on" | "off";

export type CmdTarget = {
  room: CmdRoom;
  device: CmdDevice;
  state: CmdState;
};

const COMMAND_CODES: Record<string, string> = {
  "shed:lights:on": "slon",
  "shed:lights:off": "slof",
  "shed:music:on": "smon",
  "shed:music:off": "smof",
  "shed:heater:on": "shon",
  "shed:heater:off": "shof",
  "bedroom:lights:on": "blon",
  "bedroom:lights:off": "blof",
};

const LEGACY_COMMANDS: Record<string, CmdTarget> = Object.fromEntries(
  Object.entries(COMMAND_CODES).map(([key, code]) => {
    const [room, device, state] = key.split(":") as [CmdRoom, CmdDevice, CmdState];
    return [code, { room, device, state }];
  }),
);

const ROOM_LABELS: Record<CmdRoom, string> = {
  shed: "shed",
  bedroom: "bedroom",
};

const DEVICE_LABELS: Record<CmdDevice, string> = {
  lights: "lights",
  music: "music",
  heater: "heater",
};

const DEVICE_KEYS: Record<CmdDevice, string> = {
  lights: "l",
  music: "m",
  heater: "h",
};

const ROOM_DEVICES: Record<CmdRoom, CmdDevice[]> = {
  shed: ["lights", "music", "heater"],
  bedroom: ["lights"],
};

export const CMD_MENU_INNER_WIDTH = 34;

export type CmdMenuStep = "top" | "device" | "state" | "running" | "done" | "error";

export type CmdMenuSelection = {
  room?: CmdRoom;
  device?: CmdDevice;
};

export function cmdCodeFor(target: CmdTarget): string | null {
  return COMMAND_CODES[`${target.room}:${target.device}:${target.state}`] ?? null;
}

export function legacyCmdTarget(code: string): CmdTarget | null {
  return LEGACY_COMMANDS[code.toLowerCase()] ?? null;
}

export function devicesForRoom(room: CmdRoom): CmdDevice[] {
  return ROOM_DEVICES[room];
}

export function roomForKey(key: string): CmdRoom | null {
  if (key === "s") return "shed";
  if (key === "b") return "bedroom";
  return null;
}

export function isWfhMenuKey(key: string): boolean {
  return key === "w";
}

export function deviceForKey(key: string, room: CmdRoom): CmdDevice | null {
  for (const device of devicesForRoom(room)) {
    if (DEVICE_KEYS[device] === key) return device;
  }
  return null;
}

export function stateForKey(key: string): CmdState | null {
  if (key === "o") return "on";
  if (key === "f") return "off";
  return null;
}

export function formatCmdTarget(target: CmdTarget): string {
  return `${ROOM_LABELS[target.room]} ${DEVICE_LABELS[target.device]} ${target.state}`;
}

export async function triggerCmdTarget(target: CmdTarget): Promise<string> {
  const code = cmdCodeFor(target);
  if (!code) {
    throw new Error(`Unsupported command: ${formatCmdTarget(target)}`);
  }

  const postCount = code === "slof" ? 2 : 1;
  const url = `${CMD_BASE_URL}/api/trigger-${target.room}-${target.device}/${target.state}`;

  for (let attempt = 0; attempt < postCount; attempt += 1) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
    const response = await fetch(url, { method: "POST" });
    if (!response.ok) {
      throw new Error(`Request failed (${response.status})`);
    }
  }

  return `Triggered ${formatCmdTarget(target)}`;
}

export async function triggerWfhToggle(): Promise<{ message: string; wfh: boolean }> {
  const wfh = await toggleWfhStatus();
  return { message: formatWfhLine(wfh), wfh };
}

export function buildCmdMenuLines(
  step: CmdMenuStep,
  selection: CmdMenuSelection,
  message?: string,
): string[] {
  if (step === "running") {
    return ["=== Commands ===", "", "Running...", ""];
  }

  if (step === "done" || step === "error") {
    return ["=== Commands ===", "", message ?? "", "", "any key  back"];
  }

  if (step === "top") {
    return [
      "=== Commands ===",
      "",
      "  w  work from home",
      "",
      "Room:",
      "  s  shed",
      "  b  bedroom",
      "",
      "q  cancel",
    ];
  }

  const room = selection.room;
  if (!room) {
    return ["=== Commands ===", "", "Room missing", "", "q  cancel"];
  }

  if (step === "device") {
    const deviceLines = devicesForRoom(room).map(
      (device) => `  ${DEVICE_KEYS[device]}  ${DEVICE_LABELS[device]}`,
    );
    return [
      "=== Commands ===",
      "",
      `Room: ${ROOM_LABELS[room]}`,
      "",
      "Device:",
      ...deviceLines,
      "",
      "q  cancel",
    ];
  }

  const device = selection.device;
  if (!device) {
    return ["=== Commands ===", "", "Device missing", "", "q  cancel"];
  }

  return [
    "=== Commands ===",
    "",
    `Room: ${ROOM_LABELS[room]}`,
    `Device: ${DEVICE_LABELS[device]}`,
    "",
    "State:",
    "  o  on",
    "  f  off",
    "",
    "q  cancel",
  ];
}
