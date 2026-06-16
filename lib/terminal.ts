import stringWidth from "string-width";
import stripAnsi from "strip-ansi";
import { statusCalendarInnerWidth } from "./calApi";
import { statusShortcutFooterWidth } from "./commands";

export const ANSI_ENTER_ALTERNATE_SCREEN = "\x1b[?1049h";
export const ANSI_LEAVE_ALTERNATE_SCREEN = "\x1b[?1049l";
export const ANSI_CLEAR_SCREEN = "\x1b[2J";
export const ANSI_HOME = "\x1b[H";
export const ANSI_ERASE_TO_END = "\x1b[J";
export const ANSI_HIDE_CURSOR = "\x1b[?25l";
export const ANSI_SHOW_CURSOR = "\x1b[?25h";

const ANSI_SEQUENCE = /^\x1b\[[0-9;]*m/;
const ANSI_RESET = "\x1b[0m";

function visibleLength(value: string): number {
  return stringWidth(stripAnsi(value));
}

function nextGrapheme(value: string): string {
  try {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    return [...segmenter.segment(value)][0]?.segment ?? value[0] ?? "";
  } catch {
    return value[0] ?? "";
  }
}

function truncateToWidth(line: string, maxWidth: number): string {
  if (visibleLength(line) <= maxWidth) return line;

  let index = 0;
  let width = 0;
  let result = "";
  let usedAnsi = false;

  while (index < line.length && width < maxWidth) {
    const ansiMatch = line.slice(index).match(ANSI_SEQUENCE);
    if (ansiMatch) {
      result += ansiMatch[0];
      if (ansiMatch[0] !== ANSI_RESET) usedAnsi = true;
      index += ansiMatch[0].length;
      continue;
    }

    const grapheme = nextGrapheme(stripAnsi(line.slice(index)));
    if (!grapheme) break;

    const graphemeWidth = stringWidth(grapheme);
    if (width + graphemeWidth > maxWidth) break;

    let remaining = grapheme.length;
    while (remaining > 0 && index < line.length) {
      const inlineAnsi = line.slice(index).match(ANSI_SEQUENCE);
      if (inlineAnsi) {
        result += inlineAnsi[0];
        if (inlineAnsi[0] !== ANSI_RESET) usedAnsi = true;
        index += inlineAnsi[0].length;
        continue;
      }
      result += line[index];
      index += 1;
      remaining -= 1;
    }

    width += graphemeWidth;
  }

  if (usedAnsi && !result.endsWith(ANSI_RESET)) {
    result += ANSI_RESET;
  }
  return result;
}

export function boxOuterWidth(innerWidth: number): number {
  return innerWidth + 4;
}

const WIDE_LAYOUT_GAP = 3;

export function wideLayoutWidth(innerWidth: number): number {
  return 2 * boxOuterWidth(innerWidth) + WIDE_LAYOUT_GAP;
}

export function extraWideLayoutWidth(innerWidth: number): number {
  return 3 * boxOuterWidth(innerWidth) + 2 * WIDE_LAYOUT_GAP;
}

export function isWideTerminal(innerWidth: number): boolean {
  const columns = process.stdout.columns ?? 80;
  return columns >= wideLayoutWidth(innerWidth);
}

export function isExtraWideTerminal(innerWidth: number): boolean {
  const columns = process.stdout.columns ?? 80;
  return columns >= extraWideLayoutWidth(innerWidth);
}

export function maxCalendarContentLines(
  statusContentLineCount: number,
  useFullHeight = false,
): number {
  const terminalRows = process.stdout.rows ?? 24;
  if (useFullHeight) {
    const statusBoxRows = statusContentLineCount + 2;
    return Math.max(0, terminalRows - statusBoxRows - 2);
  }
  const statusBoxRows = statusContentLineCount + 2;
  return Math.max(0, terminalRows - statusBoxRows);
}

export function layoutWidth(
  outerWidths: number[],
  gap = WIDE_LAYOUT_GAP,
): number {
  if (outerWidths.length === 0) return 0;
  return outerWidths.reduce((sum, width) => sum + width, 0) + gap * (outerWidths.length - 1);
}

export function isSportsWideTerminal(
  leftOuter: number,
  weatherInner: number,
  sportsInner: number,
): boolean {
  const columns = process.stdout.columns ?? 80;
  const needed = layoutWidth([
    leftOuter,
    boxOuterWidth(weatherInner),
    boxOuterWidth(sportsInner),
  ]);
  return columns >= needed;
}

export function isWeatherWideTerminal(
  leftOuter: number,
  weatherInner: number,
): boolean {
  const columns = process.stdout.columns ?? 80;
  return columns >= layoutWidth([leftOuter, boxOuterWidth(weatherInner)]);
}

export function statusLayoutInnerWidth(): number {
  const columns = process.stdout.columns ?? 80;
  const fixed = Math.max(statusCalendarInnerWidth(), statusShortcutFooterWidth());
  return Math.min(fixed, Math.max(columns - 4, 20));
}

export function isMobileStatusTerminal(
  panelInnerWidth: number,
  _calendarInnerWidth?: number,
  _weatherLines?: string[] | null,
  _solarLines?: string[] | null,
): boolean {
  const leftOuter = boxOuterWidth(panelInnerWidth);
  return !isWeatherWideTerminal(leftOuter, panelInnerWidth);
}

function fitCalendarContentLines(
  calendarLines: string[],
  statusContentLineCount: number,
  useFullHeight = false,
): string[] {
  const maxCalendarContent = maxCalendarContentLines(statusContentLineCount, useFullHeight);
  if (calendarLines.length <= maxCalendarContent) {
    return calendarLines;
  }
  if (maxCalendarContent <= 1) {
    return calendarLines.slice(0, maxCalendarContent);
  }

  const sections: string[][] = [];
  let index = 1;
  while (index < calendarLines.length && calendarLines[index] === "") {
    index += 1;
  }
  while (index < calendarLines.length) {
    const section: string[] = [];
    while (index < calendarLines.length && calendarLines[index] !== "") {
      section.push(calendarLines[index]);
      index += 1;
    }
    if (section.length > 0) {
      sections.push(section);
    }
    while (index < calendarLines.length && calendarLines[index] === "") {
      index += 1;
    }
  }

  const fitted = [calendarLines[0]];
  for (const section of sections) {
    if (fitted.length > 0) {
      if (fitted.length + 1 > maxCalendarContent) break;
      fitted.push("");
    }
    if (fitted.length + section.length > maxCalendarContent) break;
    fitted.push(...section);
  }
  return fitted;
}

function padVisible(line: string, width: number): string {
  const len = visibleLength(line);
  return len >= width ? line : `${line}${" ".repeat(width - len)}`;
}

export function boxLines(lines: string[], innerWidth: number): string[] {
  if (lines.length === 0 || innerWidth <= 0) return lines;
  const top = `┌${"─".repeat(innerWidth + 2)}┐`;
  const bottom = `└${"─".repeat(innerWidth + 2)}┘`;
  const body = lines.map((line) => {
    const fitted = truncateToWidth(line, innerWidth);
    const padding = innerWidth - visibleLength(fitted);
    return `│ ${fitted}${" ".repeat(padding)} │`;
  });
  return [top, ...body, bottom];
}

export function joinBoxedColumns(
  boxes: string[][],
  innerWidth: number,
  gap = 3,
): string[] {
  const outerWidths = boxes.map(() => boxOuterWidth(innerWidth));
  return joinBoxedColumnsVariable(boxes, outerWidths, gap);
}

export function joinBoxedColumnsVariable(
  boxes: string[][],
  outerWidths: number[],
  gap = 3,
): string[] {
  const gapStr = " ".repeat(gap);
  const maxHeight = Math.max(...boxes.map((box) => box.length), 0);
  const rows: string[] = [];
  for (let i = 0; i < maxHeight; i += 1) {
    rows.push(
      boxes
        .map((box, boxIdx) => {
          const outerWidth = outerWidths[boxIdx] ?? 0;
          const line = box[i];
          if (!line) return " ".repeat(outerWidth);
          return padVisible(truncateToWidth(line, outerWidth), outerWidth);
        })
        .join(gapStr),
    );
  }
  return rows;
}

function stackBoxesVertically(boxes: string[][]): string[] {
  const rows: string[] = [];
  for (const box of boxes) {
    rows.push(...box);
  }
  return rows;
}

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

export function writeFullscreenScreen(lines: string[]): void {
  const terminalRows = process.stdout.rows ?? 24;
  const clipped = lines.slice(0, terminalRows);
  process.stdout.write(ANSI_HOME);
  for (const line of clipped) {
    process.stdout.write(`\x1b[2K${line}\n`);
  }
  process.stdout.write(ANSI_ERASE_TO_END);
}

export function writeCenteredBox(lines: string[], innerWidth: number): void {
  const box = boxLines(lines, innerWidth);
  const columns = process.stdout.columns ?? 80;
  const rows = process.stdout.rows ?? 24;
  const centered = box.map((line) => {
    const pad = Math.max(0, Math.floor((columns - visibleLength(line)) / 2));
    return `${" ".repeat(pad)}${line}`;
  });
  const topPad = Math.max(0, Math.floor((rows - centered.length) / 2));
  writeFullscreenScreen([...Array(topPad).fill(""), ...centered]);
}

export type StatusLayoutTier = "compact" | "stacked" | "twoColumn" | "threeColumn" | "full";

export type CompactRotatePanel = "weather" | "solar" | "cric" | "footy" | "calendar";

const MIN_CALENDAR_STACK_LINES = 4;

export function shouldStackCalendarUnderStatus(statusLineCount: number): boolean {
  return maxCalendarContentLines(statusLineCount, true) >= MIN_CALENDAR_STACK_LINES;
}

export function resolveStatusLayoutTier(
  statusLineCount: number,
  innerWidth: number,
  panels: Pick<
    FullscreenPanelLines,
    "calendarLines" | "calendarInnerWidth" | "weatherLines" | "solarLines" | "cricLines" | "footyLines"
  >,
): StatusLayoutTier {
  const columns = process.stdout.columns ?? 80;
  const panelInner = panels.calendarInnerWidth ?? innerWidth;
  const leftOuter = boxOuterWidth(panelInner);
  const middleLayoutLines = middlePanelLayoutLines(panels as FullscreenPanelLines);
  const hasMiddle = middleLayoutLines.length > 0;
  const hasSports = Boolean(
    (panels.cricLines && panels.cricLines.length > 0) ||
      (panels.footyLines && panels.footyLines.length > 0),
  );

  if (!hasMiddle && !hasSports) {
    return shouldStackCalendarUnderStatus(statusLineCount) ? "stacked" : "compact";
  }

  const sportsOuter = boxOuterWidth(panelInner);
  const fourColWidth = layoutWidth([
    leftOuter,
    boxOuterWidth(panelInner),
    boxOuterWidth(panelInner),
    sportsOuter,
  ]);
  const threeColWidth = layoutWidth([leftOuter, boxOuterWidth(panelInner), sportsOuter]);
  const twoColWidth = layoutWidth([leftOuter, boxOuterWidth(panelInner)]);

  if (hasMiddle && hasSports && columns >= fourColWidth) return "full";
  if (hasMiddle && hasSports && columns >= threeColWidth) return "threeColumn";
  if (columns >= twoColWidth && (hasMiddle || hasSports)) return "twoColumn";
  return shouldStackCalendarUnderStatus(statusLineCount) ? "stacked" : "compact";
}

export function maxRotatingPanelBodyLines(
  innerWidth: number,
  statusLines: string[],
  calendarLines: string[] | null,
  stackCalendar: boolean,
  calendarInnerWidth?: number,
): number {
  const terminalRows = process.stdout.rows ?? 24;
  const panelInner = calendarInnerWidth ?? innerWidth;
  let used = boxLines(statusLines, panelInner).length;
  if (stackCalendar && calendarLines && calendarLines.length > 0) {
    const calendarContent = fitCalendarContentLines(calendarLines, statusLines.length, true);
    if (calendarContent.length > 0) {
      used += boxLines(calendarContent, panelInner).length;
    }
  }
  return Math.max(1, terminalRows - used - 4);
}

export function maxCompactPanelBodyLines(
  tier: StatusLayoutTier,
  innerWidth: number,
  statusLines: string[],
  calendarLines: string[] | null,
  stackCalendar: boolean,
  calendarInnerWidth?: number,
): number {
  if (tier === "twoColumn" || tier === "threeColumn" || tier === "full") {
    return maxFootballBodyLines(innerWidth, null);
  }
  return maxRotatingPanelBodyLines(
    innerWidth,
    statusLines,
    calendarLines,
    stackCalendar,
    calendarInnerWidth,
  );
}

export type FullscreenPanelLines = {
  cricLines?: string[] | null;
  footyLines?: string[] | null;
  calendarLines?: string[] | null;
  calendarInnerWidth?: number;
  weatherLines?: string[] | null;
  solarLines?: string[] | null;
  middleDisplay?: "weather" | "solar";
  sportsDisplay?: "cric" | "footy" | "both";
  layoutTier?: StatusLayoutTier;
  stackCalendar?: boolean;
  compactDisplay?: CompactRotatePanel;
};

function middlePanelReady(lines: string[] | null | undefined, marker: string): boolean {
  return Boolean(lines && lines.length > 0 && lines[0]?.startsWith(marker));
}

function resolveMiddlePanelLines(panels: FullscreenPanelLines): string[] | null {
  const { weatherLines, solarLines, middleDisplay } = panels;
  const hasWeather = middlePanelReady(weatherLines, "=== Weather");
  const hasSolar = middlePanelReady(solarLines, "=== Solar");
  if (!hasWeather && !hasSolar) return null;
  if (!hasSolar) return weatherLines!;
  if (!hasWeather) return solarLines!;
  return middleDisplay === "solar" ? solarLines! : weatherLines!;
}

function middlePanelLayoutLines(panels: FullscreenPanelLines): string[] {
  const lines: string[] = [];
  if (middlePanelReady(panels.weatherLines, "=== Weather")) {
    lines.push(...panels.weatherLines!);
  }
  if (middlePanelReady(panels.solarLines, "=== Solar")) {
    lines.push(...panels.solarLines!);
  }
  return lines;
}

export function maxFootballBodyLines(
  innerWidth: number,
  otherPanelLines: string[] | null,
  terminalRows = process.stdout.rows ?? 24,
): number {
  const panelHeaderRows = 2;
  const boxBorderRows = 2;
  const otherBoxRows =
    otherPanelLines && otherPanelLines.length > 0
      ? boxLines(otherPanelLines, innerWidth).length
      : 0;
  return Math.max(1, terminalRows - boxBorderRows - panelHeaderRows - otherBoxRows);
}

function resolveCompactPanelLines(panels: FullscreenPanelLines): string[] | null {
  switch (panels.compactDisplay) {
    case "weather":
      return panels.weatherLines ?? null;
    case "solar":
      return panels.solarLines ?? null;
    case "cric":
      return panels.cricLines ?? null;
    case "footy":
      return panels.footyLines ?? null;
    case "calendar":
      return panels.calendarLines ?? null;
    default:
      return null;
  }
}

function buildLeftColumn(
  statusLines: string[],
  innerWidth: number,
  panels: FullscreenPanelLines,
): { column: string[]; outer: number } {
  const panelInner = panels.calendarInnerWidth ?? innerWidth;
  const statusBox = boxLines(statusLines, panelInner);
  const leftStack: string[][] = [statusBox];
  const stackCalendar =
    panels.stackCalendar ?? shouldStackCalendarUnderStatus(statusLines.length);
  if (stackCalendar && panels.calendarLines && panels.calendarLines.length > 0) {
    const calendarContent = fitCalendarContentLines(
      panels.calendarLines,
      statusLines.length,
      true,
    );
    if (calendarContent.length > 0) {
      leftStack.push(boxLines(calendarContent, panelInner));
    }
  }
  return {
    column: stackBoxesVertically(leftStack),
    outer: boxOuterWidth(panelInner),
  };
}

export function writeFullscreenLines(
  statusLines: string[],
  innerWidth: number,
  panels: FullscreenPanelLines = {},
): void {
  const tier =
    panels.layoutTier ?? resolveStatusLayoutTier(statusLines.length, innerWidth, panels);
  const stackCalendar =
    panels.stackCalendar ?? shouldStackCalendarUnderStatus(statusLines.length);
  const { column: leftColumn, outer: leftOuter } = buildLeftColumn(statusLines, innerWidth, {
    ...panels,
    stackCalendar,
  });

  if (tier === "compact" || tier === "stacked") {
    const compactLines = resolveCompactPanelLines(panels);
    if (compactLines && compactLines.length > 0) {
      writeFullscreenScreen(
        stackBoxesVertically([leftColumn, boxLines(compactLines, innerWidth)]),
      );
      return;
    }
    writeFullscreenScreen(leftColumn);
    return;
  }

  const { cricLines, footyLines, weatherLines, solarLines, middleDisplay, sportsDisplay } =
    panels;
  const middleLayoutLines = middlePanelLayoutLines(panels);
  const hasWeather = middlePanelReady(weatherLines, "=== Weather");
  const hasSolar = middlePanelReady(solarLines, "=== Solar");
  const hasSports = Boolean(
    (cricLines && cricLines.length > 0) || (footyLines && footyLines.length > 0),
  );

  if (tier === "twoColumn") {
    const compactLines = resolveCompactPanelLines(panels);
    if (compactLines && compactLines.length > 0) {
      writeFullscreenScreen(
        joinBoxedColumnsVariable(
          [leftColumn, boxLines(compactLines, innerWidth)],
          [leftOuter, boxOuterWidth(innerWidth)],
        ),
      );
      return;
    }
    writeFullscreenScreen(leftColumn);
    return;
  }

  if (tier === "full") {
    const columns: string[][] = [leftColumn];
    const outerWidths: number[] = [leftOuter];
    if (hasWeather && weatherLines) {
      columns.push(boxLines(weatherLines, innerWidth));
      outerWidths.push(boxOuterWidth(innerWidth));
    }
    if (hasSolar && solarLines) {
      columns.push(boxLines(solarLines, innerWidth));
      outerWidths.push(boxOuterWidth(innerWidth));
    }
    if (hasSports) {
      const sportsStack: string[][] = [];
      if (cricLines && cricLines.length > 0) {
        sportsStack.push(boxLines(cricLines, innerWidth));
      }
      if (footyLines && footyLines.length > 0) {
        sportsStack.push(boxLines(footyLines, innerWidth));
      }
      if (sportsStack.length > 0) {
        columns.push(stackBoxesVertically(sportsStack));
        outerWidths.push(boxOuterWidth(innerWidth));
      }
    }
    writeFullscreenScreen(joinBoxedColumnsVariable(columns, outerWidths));
    return;
  }

  const middleLines = resolveMiddlePanelLines(panels);
  const hasMiddle = Boolean(middleLines && middleLines.length > 0);
  if (!hasMiddle && !hasSports) {
    writeFullscreenScreen(leftColumn);
    return;
  }

  const columns: string[][] = [leftColumn];
  const outerWidths: number[] = [leftOuter];

  if (hasMiddle && middleLines) {
    columns.push(boxLines(middleLines, innerWidth));
    outerWidths.push(boxOuterWidth(innerWidth));
  }

  if (hasSports) {
    const sportsStack: string[][] = [];
    const show = sportsDisplay ?? "both";
    if ((show === "both" || show === "cric") && cricLines && cricLines.length > 0) {
      sportsStack.push(boxLines(cricLines, innerWidth));
    }
    if ((show === "both" || show === "footy") && footyLines && footyLines.length > 0) {
      sportsStack.push(boxLines(footyLines, innerWidth));
    }
    if (sportsStack.length > 0) {
      columns.push(stackBoxesVertically(sportsStack));
      outerWidths.push(boxOuterWidth(innerWidth));
    }
  }

  writeFullscreenScreen(joinBoxedColumnsVariable(columns, outerWidths));
}
