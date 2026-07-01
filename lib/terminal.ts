import stringWidth from "string-width";
import stripAnsi from "strip-ansi";
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

function finalizeAnsiSegment(segment: string, usedAnsi: boolean): string {
  if (usedAnsi && !segment.endsWith(ANSI_RESET)) {
    return `${segment}${ANSI_RESET}`;
  }
  return segment;
}

function splitAtVisibleWidth(
  line: string,
  maxWidth: number,
  preferWordBreak: boolean,
): { head: string; tail: string } {
  if (visibleLength(line) <= maxWidth) {
    return { head: line, tail: "" };
  }

  let index = 0;
  let width = 0;
  let result = "";
  let usedAnsi = false;
  let activeAnsi = "";
  let bestBreak: { sourceIndex: number; result: string; activeAnsi: string } | null = null;

  while (index < line.length && width < maxWidth) {
    const ansiMatch = line.slice(index).match(ANSI_SEQUENCE);
    if (ansiMatch) {
      result += ansiMatch[0];
      if (ansiMatch[0] !== ANSI_RESET) {
        usedAnsi = true;
        activeAnsi += ansiMatch[0];
      } else {
        activeAnsi = "";
      }
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
        if (inlineAnsi[0] !== ANSI_RESET) {
          usedAnsi = true;
          activeAnsi += inlineAnsi[0];
        } else {
          activeAnsi = "";
        }
        index += inlineAnsi[0].length;
        continue;
      }

      const character = line[index];
      result += character;
      if (preferWordBreak && character === " ") {
        bestBreak = { sourceIndex: index + 1, result, activeAnsi };
      }
      index += 1;
      remaining -= 1;
    }

    width += graphemeWidth;
  }

  const minBreakWidth = Math.max(1, Math.floor(maxWidth * 0.25));
  const useWordBreak =
    preferWordBreak &&
    bestBreak !== null &&
    visibleLength(bestBreak.result) >= minBreakWidth;

  const headSourceEnd = useWordBreak ? bestBreak!.sourceIndex : index;
  const head = finalizeAnsiSegment(useWordBreak ? bestBreak!.result : result, usedAnsi);
  const tailPrefix = useWordBreak ? bestBreak!.activeAnsi : activeAnsi;
  const tail = `${tailPrefix}${line.slice(headSourceEnd).trimStart()}`;

  return { head, tail };
}

function wrapToWidth(line: string, maxWidth: number): string[] {
  if (maxWidth <= 0) return [line];
  if (visibleLength(line) <= maxWidth) return [line];
  if (line.trim() === "") return [""];

  const wrapped: string[] = [];
  let remaining = line;
  while (visibleLength(remaining) > maxWidth) {
    const { head, tail } = splitAtVisibleWidth(remaining, maxWidth, true);
    wrapped.push(head);
    remaining = tail;
    if (!remaining) break;
  }
  if (remaining.length > 0 || wrapped.length === 0) {
    wrapped.push(remaining);
  }
  return wrapped;
}

export function boxOuterWidth(innerWidth: number): number {
  return innerWidth + 4;
}

/** Maximum outer width of the status left column (status, shortcuts, calendar). */
export const STATUS_LEFT_COLUMN_MAX_OUTER = 79;

export function statusLeftColumnOuterWidth(): number {
  const columns = process.stdout.columns ?? 80;
  return Math.min(STATUS_LEFT_COLUMN_MAX_OUTER, columns);
}

export function statusLayoutInnerWidth(): number {
  return Math.max(statusLeftColumnOuterWidth() - 4, 1);
}

export function isNarrowStatusTerminal(): boolean {
  const columns = process.stdout.columns ?? 80;
  return columns < STATUS_LEFT_COLUMN_MAX_OUTER;
}

/** Target total width for a three-column status layout. */
export const STATUS_THREE_COLUMN_MAX_WIDTH = 236;

export function statusSideColumnInnerWidth(leftInnerWidth = statusLayoutInnerWidth()): number {
  const leftOuter = boxOuterWidth(leftInnerWidth);
  const availableOuter = STATUS_THREE_COLUMN_MAX_WIDTH - leftOuter - 2 * WIDE_LAYOUT_GAP;
  const sideOuter = Math.max(24, Math.floor(availableOuter / 2));
  return Math.max(sideOuter - 4, 20);
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
  shortcutContentLineCount = 0,
): number {
  const terminalRows = process.stdout.rows ?? 24;
  const statusBoxRows = statusContentLineCount + 2;
  const shortcutBoxRows = shortcutContentLineCount > 0 ? shortcutContentLineCount + 2 : 0;
  if (useFullHeight) {
    return Math.max(0, terminalRows - statusBoxRows - shortcutBoxRows - 2);
  }
  return Math.max(0, terminalRows - statusBoxRows - shortcutBoxRows);
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

export function isStatusOnlyTerminal(): boolean {
  const columns = process.stdout.columns ?? 80;
  const rows = process.stdout.rows ?? 24;
  return rows <= 32 && columns <= 79;
}

export function isMobileStatusTerminal(
  panelInnerWidth: number,
  _calendarInnerWidth?: number,
  _weatherLines?: string[] | null,
  _solarLines?: string[] | null,
): boolean {
  return isStatusOnlyTerminal() || !isWeatherWideTerminal(boxOuterWidth(panelInnerWidth), panelInnerWidth);
}

function fitCalendarContentLines(
  calendarLines: string[],
  statusContentLineCount: number,
  useFullHeight = false,
  shortcutContentLineCount = 0,
): string[] {
  const maxCalendarContent = maxCalendarContentLines(
    statusContentLineCount,
    useFullHeight,
    shortcutContentLineCount,
  );
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

function fitBoxContentLines(lines: string[], innerWidth: number): string[] {
  const wrapLines = isNarrowStatusTerminal();
  return lines.flatMap((line) =>
    wrapLines ? wrapToWidth(line, innerWidth) : [truncateToWidth(line, innerWidth)],
  );
}

export function boxLines(lines: string[], innerWidth: number): string[] {
  if (lines.length === 0 || innerWidth <= 0) return lines;
  const top = `┌${"─".repeat(innerWidth + 2)}┐`;
  const bottom = `└${"─".repeat(innerWidth + 2)}┘`;
  const body = fitBoxContentLines(lines, innerWidth).map((line) => {
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

export type StatusLayoutTier = "statusOnly" | "compact" | "stacked" | "twoColumn" | "threeColumn" | "full";

export type SportsRotatePanel = "cric" | "footy" | "plTable" | "villa";

export type CompactRotatePanel = "weather" | "solar" | "cric" | "footy" | "plTable" | "villa" | "calendar";

const MIN_CALENDAR_STACK_LINES = 4;

export function shouldStackCalendarUnderStatus(
  statusLineCount: number,
  shortcutContentLineCount = 0,
): boolean {
  return maxCalendarContentLines(statusLineCount, true, shortcutContentLineCount) >= MIN_CALENDAR_STACK_LINES;
}

export function resolveStatusLayoutTier(
  statusLineCount: number,
  innerWidth: number,
  panels: Pick<
    FullscreenPanelLines,
    "calendarLines" | "calendarInnerWidth" | "weatherLines" | "solarLines" | "cricLines" | "footyLines" | "plTableLines" | "villaLines"
  >,
): StatusLayoutTier {
  if (isStatusOnlyTerminal()) {
    return "statusOnly";
  }

  const columns = process.stdout.columns ?? 80;
  const panelInner = panels.calendarInnerWidth ?? innerWidth;
  const leftOuter = boxOuterWidth(panelInner);
  const sideInner = statusSideColumnInnerWidth(panelInner);
  const middleLayoutLines = middlePanelLayoutLines(panels as FullscreenPanelLines);
  const hasMiddle = middleLayoutLines.length > 0;
  const hasSports = Boolean(
    (panels.cricLines && panels.cricLines.length > 0) ||
      (panels.footyLines && panels.footyLines.length > 0) ||
      (panels.plTableLines && panels.plTableLines.length > 0) ||
      (panels.villaLines && panels.villaLines.length > 0),
  );

  if (!hasMiddle && !hasSports) {
    return shouldStackCalendarUnderStatus(statusLineCount) ? "stacked" : "compact";
  }

  const sportsOuter = boxOuterWidth(sideInner);
  const fourColWidth = layoutWidth([
    leftOuter,
    boxOuterWidth(sideInner),
    boxOuterWidth(sideInner),
    sportsOuter,
  ]);
  const threeColWidth = layoutWidth([leftOuter, boxOuterWidth(sideInner), sportsOuter]);
  const twoColWidth = layoutWidth([leftOuter, boxOuterWidth(sideInner)]);

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
  shortcutLines?: string[] | null,
): number {
  const terminalRows = process.stdout.rows ?? 24;
  const panelInner = calendarInnerWidth ?? innerWidth;
  let used = boxLines(statusLines, panelInner).length;
  if (shortcutLines && shortcutLines.length > 0) {
    used += boxLines(shortcutLines, panelInner).length;
  }
  if (stackCalendar && calendarLines && calendarLines.length > 0) {
    const calendarContent = fitCalendarContentLines(
      calendarLines,
      statusLines.length,
      true,
      shortcutLines?.length ?? 0,
    );
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
  shortcutLines?: string[] | null,
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
    shortcutLines,
  );
}

export type FullscreenPanelLines = {
  cricLines?: string[] | null;
  footyLines?: string[] | null;
  plTableLines?: string[] | null;
  villaLines?: string[] | null;
  calendarLines?: string[] | null;
  calendarInnerWidth?: number;
  weatherLines?: string[] | null;
  solarLines?: string[] | null;
  middleDisplay?: "weather" | "solar";
  sportsDisplay?: SportsRotatePanel;
  shortcutLines?: string[] | null;
  layoutTier?: StatusLayoutTier;
  stackCalendar?: boolean;
  compactDisplay?: CompactRotatePanel;
  pageOffsets?: FullscreenPanelPageOffsets;
};

export type FullscreenPanelPageOffsets = Record<string, number | undefined>;

export type FullscreenPaginationState = {
  hasOverflow: boolean;
  overflowKeys: string[];
  nextOffsets: Record<string, number>;
};

export function emptyFullscreenPaginationState(): FullscreenPaginationState {
  return {
    hasOverflow: false,
    overflowKeys: [],
    nextOffsets: {},
  };
}

const MORE_PROMPT = "d for more";

function likelySectionStart(line: string): boolean {
  const text = stripAnsi(line).trim();
  if (text.length === 0) return false;
  if (text.startsWith("|") || text.startsWith("+") || text.startsWith("-")) return false;
  if (/^\d+(?:\.\d+)?[kKMwW]?\s+\|/.test(text)) return false;
  if (/^(?:={2,}|─{2,})\s+.+\s+(?:={2,}|─{2,})$/.test(text)) return true;
  return /^[A-Z][A-Za-z0-9 ,()/-]+$/.test(text);
}

function normalizedPageStart(lines: string[], requestedStart: number): number {
  if (!Number.isFinite(requestedStart) || requestedStart <= 0 || requestedStart >= lines.length) {
    return 0;
  }
  let start = Math.floor(requestedStart);
  while (start < lines.length && lines[start] === "") {
    start += 1;
  }
  return start >= lines.length ? 0 : start;
}

function sensiblePageEnd(lines: string[], start: number, maxLines: number): number {
  const hardEnd = Math.min(lines.length, start + maxLines);
  if (hardEnd >= lines.length) return hardEnd;

  for (let index = hardEnd; index > start + 1; index -= 1) {
    if (lines[index - 1] === "") return index - 1;
  }

  for (let index = hardEnd - 1; index > start + 1; index -= 1) {
    if (likelySectionStart(lines[index])) return index;
  }

  return hardEnd;
}

function nextPageStart(lines: string[], end: number): number {
  let next = end;
  while (next < lines.length && lines[next] === "") {
    next += 1;
  }
  return next >= lines.length ? 0 : next;
}

function fitPageLines(
  lines: string[],
  bodyRows: number,
  requestedStart: number,
): { lines: string[]; overflow: boolean; nextOffset: number } {
  if (bodyRows <= 0) {
    return { lines: [], overflow: lines.length > 0, nextOffset: 0 };
  }

  if (lines.length <= bodyRows) {
    return { lines: [...lines], overflow: false, nextOffset: 0 };
  }

  const contentRows = Math.max(0, bodyRows - 1);
  if (contentRows === 0) {
    return { lines: [MORE_PROMPT], overflow: true, nextOffset: 0 };
  }

  const start = normalizedPageStart(lines, requestedStart);
  let end = sensiblePageEnd(lines, start, contentRows);
  if (end <= start) {
    end = Math.min(lines.length, start + contentRows);
  }

  const page = lines.slice(start, end);
  while (page.length < contentRows) {
    page.push("");
  }
  page.push(MORE_PROMPT);

  return {
    lines: page,
    overflow: true,
    nextOffset: nextPageStart(lines, end),
  };
}

function recordOverflow(
  pagination: FullscreenPaginationState,
  key: string,
  nextOffset: number,
): void {
  pagination.hasOverflow = true;
  pagination.overflowKeys.push(key);
  pagination.nextOffsets[key] = nextOffset;
}

function fullHeightBoxLines(
  key: string,
  lines: string[],
  innerWidth: number,
  targetRows: number,
  pageOffsets: FullscreenPanelPageOffsets | undefined,
  pagination: FullscreenPaginationState,
): string[] {
  const bodyRows = Math.max(0, targetRows - 2);
  const page = fitPageLines(lines, bodyRows, pageOffsets?.[key] ?? 0);
  if (page.overflow) {
    recordOverflow(pagination, key, page.nextOffset);
  }
  while (page.lines.length < bodyRows) {
    page.lines.push("");
  }
  return boxLines(page.lines, innerWidth);
}

function fitFullHeightColumnLines(
  key: string,
  lines: string[],
  outerWidth: number,
  targetRows: number,
  pageOffsets: FullscreenPanelPageOffsets | undefined,
  pagination: FullscreenPaginationState,
): string[] {
  const page = fitPageLines(lines, targetRows, pageOffsets?.[key] ?? 0);
  if (page.overflow) {
    recordOverflow(pagination, key, page.nextOffset);
  }
  while (page.lines.length < targetRows) {
    page.lines.push("");
  }
  return page.lines.map((line) => padVisible(truncateToWidth(line, outerWidth), outerWidth));
}

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
    case "plTable":
      return panels.plTableLines ?? null;
    case "villa":
      return panels.villaLines ?? null;
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
  if (panels.shortcutLines && panels.shortcutLines.length > 0) {
    leftStack.push(boxLines(panels.shortcutLines, panelInner));
  }
  const stackCalendar =
    panels.stackCalendar ?? shouldStackCalendarUnderStatus(statusLines.length);
  if (stackCalendar && panels.calendarLines && panels.calendarLines.length > 0) {
    const shortcutContentLineCount = panels.shortcutLines?.length ?? 0;
    const calendarContent = fitCalendarContentLines(
      panels.calendarLines,
      statusLines.length,
      true,
      shortcutContentLineCount,
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
): FullscreenPaginationState {
  const pagination = emptyFullscreenPaginationState();
  const terminalRows = process.stdout.rows ?? 24;
  const targetRows = Math.max(1, terminalRows);
  const tier =
    panels.layoutTier ?? resolveStatusLayoutTier(statusLines.length, innerWidth, panels);
  const stackCalendar =
    panels.stackCalendar ?? shouldStackCalendarUnderStatus(statusLines.length);
  const { column: leftColumn, outer: leftOuter } = buildLeftColumn(statusLines, innerWidth, {
    ...panels,
    stackCalendar,
  });
  const sideInner = statusSideColumnInnerWidth(innerWidth);

  if (tier === "statusOnly") {
    const panelInner = panels.calendarInnerWidth ?? innerWidth;
    const leftStack: string[][] = [boxLines(statusLines, panelInner)];
    if (panels.shortcutLines && panels.shortcutLines.length > 0) {
      leftStack.push(boxLines(panels.shortcutLines, panelInner));
    }
    writeFullscreenScreen(stackBoxesVertically(leftStack));
    return pagination;
  }

  if (tier === "compact" || tier === "stacked") {
    const compactLines = resolveCompactPanelLines(panels);
    if (compactLines && compactLines.length > 0) {
      writeFullscreenScreen(
        stackBoxesVertically([leftColumn, boxLines(compactLines, innerWidth)]),
      );
      return pagination;
    }
    writeFullscreenScreen(leftColumn);
    return pagination;
  }

  const { cricLines, footyLines, plTableLines, villaLines, weatherLines, solarLines, middleDisplay, sportsDisplay } =
    panels;
  const middleLayoutLines = middlePanelLayoutLines(panels);
  const hasWeather = middlePanelReady(weatherLines, "=== Weather");
  const hasSolar = middlePanelReady(solarLines, "=== Solar");
  const hasSports = Boolean(
    (cricLines && cricLines.length > 0) ||
      (footyLines && footyLines.length > 0) ||
      (plTableLines && plTableLines.length > 0) ||
      (villaLines && villaLines.length > 0),
  );

  if (tier === "twoColumn") {
    const compactLines = resolveCompactPanelLines(panels);
    if (compactLines && compactLines.length > 0) {
      writeFullscreenScreen(
        joinBoxedColumnsVariable(
          [
            leftColumn,
            fullHeightBoxLines(
              "compact",
              compactLines,
              sideInner,
              targetRows,
              panels.pageOffsets,
              pagination,
            ),
          ],
          [leftOuter, boxOuterWidth(sideInner)],
        ),
      );
      return pagination;
    }
    writeFullscreenScreen(leftColumn);
    return pagination;
  }

  if (tier === "full") {
    const columns: string[][] = [leftColumn];
    const outerWidths: number[] = [leftOuter];
    if (hasWeather && weatherLines) {
      columns.push(
        fullHeightBoxLines(
          "weather",
          weatherLines,
          sideInner,
          targetRows,
          panels.pageOffsets,
          pagination,
        ),
      );
      outerWidths.push(boxOuterWidth(sideInner));
    }
    if (hasSolar && solarLines) {
      columns.push(
        fullHeightBoxLines(
          "solar",
          solarLines,
          sideInner,
          targetRows,
          panels.pageOffsets,
          pagination,
        ),
      );
      outerWidths.push(boxOuterWidth(sideInner));
    }
    if (hasSports) {
      const sportsStack: string[][] = [];
      if (cricLines && cricLines.length > 0) {
        sportsStack.push(boxLines(cricLines, sideInner));
      }
      if (footyLines && footyLines.length > 0) {
        sportsStack.push(boxLines(footyLines, sideInner));
      }
      if (plTableLines && plTableLines.length > 0) {
        sportsStack.push(boxLines(plTableLines, sideInner));
      }
      if (villaLines && villaLines.length > 0) {
        sportsStack.push(boxLines(villaLines, sideInner));
      }
      if (sportsStack.length > 0) {
        columns.push(
          fitFullHeightColumnLines(
            "sports",
            stackBoxesVertically(sportsStack),
            boxOuterWidth(sideInner),
            targetRows,
            panels.pageOffsets,
            pagination,
          ),
        );
        outerWidths.push(boxOuterWidth(sideInner));
      }
    }
    writeFullscreenScreen(joinBoxedColumnsVariable(columns, outerWidths));
    return pagination;
  }

  const middleLines = resolveMiddlePanelLines(panels);
  const hasMiddle = Boolean(middleLines && middleLines.length > 0);
  if (!hasMiddle && !hasSports) {
    writeFullscreenScreen(leftColumn);
    return pagination;
  }

  const columns: string[][] = [leftColumn];
  const outerWidths: number[] = [leftOuter];

  if (hasMiddle && middleLines) {
    columns.push(
      fullHeightBoxLines(
        `middle:${panels.middleDisplay ?? "default"}`,
        middleLines,
        sideInner,
        targetRows,
        panels.pageOffsets,
        pagination,
      ),
    );
    outerWidths.push(boxOuterWidth(sideInner));
  }

  if (hasSports) {
    const sportsStack: string[][] = [];
    const show = sportsDisplay;
    if (show === "cric" && cricLines && cricLines.length > 0) {
      sportsStack.push(boxLines(cricLines, sideInner));
    } else if (show === "footy" && footyLines && footyLines.length > 0) {
      sportsStack.push(boxLines(footyLines, sideInner));
    } else if (show === "plTable" && plTableLines && plTableLines.length > 0) {
      sportsStack.push(boxLines(plTableLines, sideInner));
    } else if (show === "villa" && villaLines && villaLines.length > 0) {
      sportsStack.push(boxLines(villaLines, sideInner));
    } else if (!show) {
      if (cricLines && cricLines.length > 0) sportsStack.push(boxLines(cricLines, sideInner));
      if (footyLines && footyLines.length > 0) sportsStack.push(boxLines(footyLines, sideInner));
      if (plTableLines && plTableLines.length > 0) sportsStack.push(boxLines(plTableLines, sideInner));
      if (villaLines && villaLines.length > 0) sportsStack.push(boxLines(villaLines, sideInner));
    }
    if (sportsStack.length > 0) {
      columns.push(
        fitFullHeightColumnLines(
          `sports:${sportsDisplay ?? "all"}`,
          stackBoxesVertically(sportsStack),
          boxOuterWidth(sideInner),
          targetRows,
          panels.pageOffsets,
          pagination,
        ),
      );
      outerWidths.push(boxOuterWidth(sideInner));
    }
  }

  writeFullscreenScreen(joinBoxedColumnsVariable(columns, outerWidths));
  return pagination;
}
