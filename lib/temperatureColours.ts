const ANSI_RESET = "\x1b[0m";
const ANSI_BLUE = "\x1b[34m";
const ANSI_GREEN = "\x1b[32m";
const ANSI_YELLOW = "\x1b[33m";
const ANSI_ORANGE = "\x1b[38;5;208m";
const ANSI_RED = "\x1b[31m";

export type TemperatureColourScale = "min" | "max";

function shouldUseColor(): boolean {
  return Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
}

function colorize(value: string, color: string): string {
  if (!shouldUseColor()) return value;
  return `${color}${value}${ANSI_RESET}`;
}

export function colourTemperatureText(
  text: string,
  value: number,
  _scale: TemperatureColourScale = "max",
): string {

  if (value < 5) return colorize(text, ANSI_BLUE);
  if (value <= 10) return colorize(text, ANSI_GREEN);
  if (value <= 16) return colorize(text, ANSI_YELLOW);
  if (value <= 23) return colorize(text, ANSI_ORANGE);
  return colorize(text, ANSI_RED);
}

export function formatTemperatureText(
  value?: number | null,
  options?: {
    scale?: TemperatureColourScale;
    fractionDigits?: number;
    unknownText?: string;
  },
): string {
  if (value == null) return options?.unknownText ?? "?";
  const fractionDigits = options?.fractionDigits ?? 0;
  const text = `${value.toFixed(fractionDigits)}C`;
  return colourTemperatureText(text, value, options?.scale ?? "max");
}
