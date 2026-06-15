import stringWidth from "string-width";

export const ANSI_ENTER_ALTERNATE_SCREEN = "\x1b[?1049h";
export const ANSI_LEAVE_ALTERNATE_SCREEN = "\x1b[?1049l";
export const ANSI_CLEAR_SCREEN = "\x1b[2J";
export const ANSI_HOME = "\x1b[H";
export const ANSI_ERASE_TO_END = "\x1b[J";
export const ANSI_HIDE_CURSOR = "\x1b[?25l";
export const ANSI_SHOW_CURSOR = "\x1b[?25h";

const ANSI_REGEX = /\x1b\[[0-9;]*m/g;

function visibleLength(value: string): number {
  return stringWidth(value.replace(ANSI_REGEX, ""));
}

function truncateToWidth(line: string, maxWidth: number): string {
  const plain = line.replace(ANSI_REGEX, "");
  if (stringWidth(plain) <= maxWidth) return line;
  let result = "";
  let width = 0;
  try {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    for (const { segment } of segmenter.segment(plain)) {
      const segmentWidth = stringWidth(segment);
      if (width + segmentWidth > maxWidth) break;
      result += segment;
      width += segmentWidth;
    }
    return result;
  } catch {
    return plain.slice(0, maxWidth);
  }
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

export function isMobileStatusTerminal(
  statusInnerWidth: number,
  calendarInnerWidth?: number,
  weatherLines?: string[] | null,
  solarLines?: string[] | null,
): boolean {
  const calInner = calendarInnerWidth ?? statusInnerWidth;
  const leftOuter = Math.max(boxOuterWidth(statusInnerWidth), boxOuterWidth(calInner));
  const layoutLines = [...(weatherLines || []), ...(solarLines || [])];
  const weatherContent = layoutLines.reduce(
    (max, line) => Math.max(max, visibleLength(line)),
    0,
  );
  const weatherInner = Math.max(statusInnerWidth, weatherContent);
  return !isWeatherWideTerminal(leftOuter, weatherInner);
}

function statusBoxInnerWidth(preferredInnerWidth: number): number {
  const columns = process.stdout.columns ?? 80;
  const maxInner = Math.max(columns - 4, 20);
  return Math.min(preferredInnerWidth, maxInner);
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

function contentInnerWidth(lines: string[], fallback: number): number {
  const columns = process.stdout.columns ?? 80;
  const contentWidth = lines.reduce(
    (max, line) => Math.max(max, visibleLength(line)),
    0,
  );
  return Math.min(Math.max(contentWidth, fallback), Math.max(fallback, columns - 4));
}

function weatherBoxInnerWidth(
  weatherLines: string[],
  statusInnerWidth: number,
  leftOuter: number,
  includeSportsColumn: boolean,
  sportsInnerWidth: number,
): number {
  const columns = process.stdout.columns ?? 80;
  const contentWidth = weatherLines.reduce(
    (max, line) => Math.max(max, visibleLength(line)),
    0,
  );
  const sportsOuter = includeSportsColumn ? WIDE_LAYOUT_GAP + boxOuterWidth(sportsInnerWidth) : 0;
  const availableOuter = columns - leftOuter - WIDE_LAYOUT_GAP - sportsOuter;
  const maxInner = Math.max(statusInnerWidth, availableOuter - 4);
  return Math.min(Math.max(contentWidth, statusInnerWidth), maxInner);
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

export type FullscreenPanelLines = {
  cricLines?: string[] | null;
  footyLines?: string[] | null;
  calendarLines?: string[] | null;
  calendarInnerWidth?: number;
  weatherLines?: string[] | null;
  solarLines?: string[] | null;
  middleDisplay?: "weather" | "solar";
  sportsDisplay?: "cric" | "footy" | "both";
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

export function writeFullscreenLines(
  statusLines: string[],
  innerWidth: number,
  panels: FullscreenPanelLines = {},
): void {
  const { cricLines, footyLines, calendarLines, calendarInnerWidth, weatherLines, solarLines, middleDisplay, sportsDisplay } =
    panels;
  const calInner = calendarInnerWidth ?? innerWidth;
  const middleLayoutLines = middlePanelLayoutLines(panels);

  if (isMobileStatusTerminal(innerWidth, calInner, weatherLines, solarLines)) {
    writeFullscreenScreen(boxLines(statusLines, statusBoxInnerWidth(innerWidth)));
    return;
  }

  const statusBox = boxLines(statusLines, innerWidth);
  const leftStack: string[][] = [statusBox];

  if (calendarLines && calendarLines.length > 0) {
    const calendarContent = fitCalendarContentLines(calendarLines, statusLines.length, true);
    if (calendarContent.length > 0) {
      leftStack.push(boxLines(calendarContent, calInner));
    }
  }

  const leftOuter = Math.max(boxOuterWidth(innerWidth), boxOuterWidth(calInner));
  const leftColumn = stackBoxesVertically(leftStack);

  const middleLines = resolveMiddlePanelLines(panels);
  const hasMiddle = Boolean(middleLines && middleLines.length > 0);
  const hasSports = Boolean(
    (cricLines && cricLines.length > 0) || (footyLines && footyLines.length > 0),
  );

  if (!hasMiddle) {
    writeFullscreenScreen(leftColumn);
    return;
  }

  const weatherInner = weatherBoxInnerWidth(
    middleLayoutLines.length > 0 ? middleLayoutLines : middleLines!,
    innerWidth,
    leftOuter,
    hasSports,
    innerWidth,
  );
  const showSports = hasSports && isSportsWideTerminal(leftOuter, weatherInner, innerWidth);
  const showWeatherMiddle = isWeatherWideTerminal(leftOuter, weatherInner);

  if (!showWeatherMiddle) {
    writeFullscreenScreen(leftColumn);
    return;
  }

  const columns: string[][] = [leftColumn, boxLines(middleLines!, weatherInner)];
  const outerWidths = [leftOuter, boxOuterWidth(weatherInner)];

  if (showSports) {
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

  writeFullscreenScreen(joinBoxedColumnsVariable(columns, outerWidths, WIDE_LAYOUT_GAP));
}
