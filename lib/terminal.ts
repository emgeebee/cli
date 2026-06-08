export const ANSI_ENTER_ALTERNATE_SCREEN = "\x1b[?1049h";
export const ANSI_LEAVE_ALTERNATE_SCREEN = "\x1b[?1049l";
export const ANSI_CLEAR_SCREEN = "\x1b[2J";
export const ANSI_HOME = "\x1b[H";
export const ANSI_ERASE_TO_END = "\x1b[J";
export const ANSI_HIDE_CURSOR = "\x1b[?25l";
export const ANSI_SHOW_CURSOR = "\x1b[?25h";

export const getTerminalWidth = (): number => {
  const columns = process.stdout.columns;
  if (columns === undefined) {
    return 80;
  }
  return Math.min(columns, 80);
};

export function enterFullscreen(): void {
  if (!process.stdout.isTTY) return;
  process.stdout.write(`${ANSI_ENTER_ALTERNATE_SCREEN}${ANSI_CLEAR_SCREEN}${ANSI_HOME}${ANSI_HIDE_CURSOR}`);
}

export function leaveFullscreen(): void {
  if (!process.stdout.isTTY) return;
  process.stdout.write(`${ANSI_SHOW_CURSOR}${ANSI_LEAVE_ALTERNATE_SCREEN}`);
}

export function writeFullscreenLines(lines: string[]): void {
  process.stdout.write(ANSI_HOME);
  for (const line of lines) {
    process.stdout.write(`\x1b[2K${line}\n`);
  }
  process.stdout.write(ANSI_ERASE_TO_END);
}
