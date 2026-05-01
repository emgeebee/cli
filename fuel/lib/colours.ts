const ESCAPE_CHARACTER = String.fromCharCode(27);
const ANSI_PATTERN = new RegExp(`${ESCAPE_CHARACTER}\\[[0-9;]*m`, "g");
const ANSI_RESET = "\u001B[0m";
const ANSI_BOLD = "\u001B[1m";
const ANSI_DIM = "\u001B[2m";

const PALETTE = {
  amber: "#f59e0b",
  blue: "#0f766e",
  dimGrey: "#6b7280",
  green: "#16a34a",
  red: "#dc2626",
  white: "#f8fafc"
} as const;

type WrapTextOptions = {
  continuationIndent?: string;
  firstIndent?: string;
  width: number;
};

export type TextStyler = {
  bold: (value: string) => string;
  danger: (value: string) => string;
  dim: (value: string) => string;
  header: (value: string) => string;
  primary: (value: string) => string;
  success: (value: string) => string;
  warning: (value: string) => string;
};

const parseRgb = (hex: string): { blue: number; green: number; red: number } => {
  const normalizedHex = hex.startsWith("#") ? hex.slice(1) : hex;

  return {
    blue: Number.parseInt(normalizedHex.slice(4, 6), 16),
    green: Number.parseInt(normalizedHex.slice(2, 4), 16),
    red: Number.parseInt(normalizedHex.slice(0, 2), 16)
  };
};

/** xterm 256-colour index (widely supported); truecolour `38;2` is often ignored in IDE / basic terminals. */
const rgbToAnsi256Index = (red: number, green: number, blue: number): number => {
  if ([red, green, blue].some((channel) => !Number.isFinite(channel))) {
    return 7;
  }

  if (red === green && green === blue) {
    if (red < 9) {
      return 16;
    }

    if (red > 248) {
      return 231;
    }

    return Math.round(((red - 8) / 247) * 24) + 232;
  }

  const r = Math.min(5, Math.max(0, Math.round((red / 255) * 5)));
  const g = Math.min(5, Math.max(0, Math.round((green / 255) * 5)));
  const b = Math.min(5, Math.max(0, Math.round((blue / 255) * 5)));

  return 16 + 36 * r + 6 * g + b;
};

const getAnsiForegroundCode = (hex: string): string => {
  const { blue, green, red } = parseRgb(hex);

  return `\u001B[38;5;${rgbToAnsi256Index(red, green, blue)}m`;
};

const applyCode = (value: string, code: string, enabled: boolean): string =>
  enabled ? `${code}${value}${ANSI_RESET}` : value;

/** `score` 1 = green (best), 10 = red (worst). Linear RGB between palette green and red. */
export const wrapFreshnessScaleColour = (text: string, score1to10: number, enabled: boolean): string => {
  if (!enabled) {
    return text;
  }

  const t = Math.min(1, Math.max(0, (score1to10 - 1) / 9));
  const fromRgb = parseRgb(PALETTE.green);
  const toRgb = parseRgb(PALETTE.red);
  const red = Math.round(fromRgb.red + (toRgb.red - fromRgb.red) * t);
  const green = Math.round(fromRgb.green + (toRgb.green - fromRgb.green) * t);
  const blue = Math.round(fromRgb.blue + (toRgb.blue - fromRgb.blue) * t);
  const index = rgbToAnsi256Index(red, green, blue);

  return applyCode(text, `\u001B[38;5;${index}m`, enabled);
};

export const createTextStyler = (enabled: boolean): TextStyler => ({
  bold: (value) => applyCode(value, ANSI_BOLD, enabled),
  danger: (value) => applyCode(value, getAnsiForegroundCode(PALETTE.red), enabled),
  dim: (value) => applyCode(value, `${ANSI_DIM}${getAnsiForegroundCode(PALETTE.dimGrey)}`, enabled),
  header: (value) => applyCode(applyCode(value, getAnsiForegroundCode(PALETTE.blue), enabled), ANSI_BOLD, enabled),
  primary: (value) => applyCode(value, getAnsiForegroundCode(PALETTE.white), enabled),
  success: (value) => applyCode(value, getAnsiForegroundCode(PALETTE.green), enabled),
  warning: (value) => applyCode(value, getAnsiForegroundCode(PALETTE.amber), enabled)
});

export const stripAnsi = (value: string): string => value.replaceAll(ANSI_PATTERN, "");

export const visibleWidth = (value: string): number => Array.from(stripAnsi(value)).length;

export const padVisibleEnd = (value: string, width: number): string =>
  `${value}${" ".repeat(Math.max(0, width - visibleWidth(value)))}`;

export const padVisibleStart = (value: string, width: number): string =>
  `${" ".repeat(Math.max(0, width - visibleWidth(value)))}${value}`;

const chunkWord = (value: string, size: number): string[] => {
  if (value.length <= size) {
    return [value];
  }

  return Array.from(value).reduce<string[]>((chunks, character) => {
    const currentChunk = chunks.at(-1) ?? "";

    if (visibleWidth(currentChunk) >= size) {
      return [...chunks, character];
    }

    return [...chunks.slice(0, -1), `${currentChunk}${character}`];
  }, [""]);
};

export const wrapText = (value: string, options: WrapTextOptions): string[] => {
  const firstIndent = options.firstIndent ?? "";
  const continuationIndent = options.continuationIndent ?? firstIndent;
  const width = Math.max(1, options.width);
  const paragraphs = value.split("\n");

  return paragraphs.flatMap((paragraph, paragraphIndex) => {
    const normalizedParagraph = paragraph.trim().replaceAll(/\s+/g, " ");

    if (normalizedParagraph.length === 0) {
      return paragraphIndex === paragraphs.length - 1 ? [] : [""];
    }

    const words = normalizedParagraph.split(" ");
    const lines: string[] = [];
    let currentIndent = firstIndent;
    let currentWords: string[] = [];

    const flushLine = (): void => {
      lines.push(`${currentIndent}${currentWords.join(" ")}`.trimEnd());
      currentIndent = continuationIndent;
      currentWords = [];
    };

    words.forEach((word) => {
      const maxContentWidth = Math.max(1, width - visibleWidth(currentIndent));
      const wordChunks = visibleWidth(word) > maxContentWidth ? chunkWord(word, maxContentWidth) : [word];

      wordChunks.forEach((wordChunk) => {
        const nextContent = currentWords.length === 0 ? wordChunk : `${currentWords.join(" ")} ${wordChunk}`;

        if (visibleWidth(nextContent) <= maxContentWidth) {
          currentWords = currentWords.length === 0 ? [wordChunk] : [...currentWords, wordChunk];
          return;
        }

        if (currentWords.length > 0) {
          flushLine();
        }

        currentWords = [wordChunk];
      });
    });

    if (currentWords.length > 0) {
      flushLine();
    }

    return paragraphIndex === paragraphs.length - 1 ? lines : [...lines, ""];
  });
};

export const joinAligned = (left: string, right: string, width: number, gap = 2): string => {
  const availableGap = width - visibleWidth(left) - visibleWidth(right);

  if (availableGap >= gap) {
    return `${left}${" ".repeat(availableGap)}${right}`;
  }

  return `${left}${" ".repeat(gap)}${right}`;
};

export const getTerminalWidth = (): number => process.stdout.columns ?? 80;
