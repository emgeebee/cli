import { createAppError } from "./errors";

type ProjectionErrorDetails = {
  examples?: string[];
  hint?: string;
  path: string;
};

const ARRAY_INDEX_PATTERN = /^\d+$/;

export const projectOutputValue = (
  value: unknown,
  path: string,
  examples: string[] = []
): unknown => {
  const segments = parseOutputPath(path, examples);

  return segments.reduce<unknown>(
    (currentValue, segment) => resolvePathSegment(currentValue, segment, path, examples),
    value
  );
};

const parseOutputPath = (path: string, examples: string[]): string[] => {
  if (path.trim().length === 0) {
    throw createInvalidOutputPathError(path, examples);
  }

  const segments = path.split(".");

  if (segments.some((segment) => segment.length === 0)) {
    throw createInvalidOutputPathError(path, examples);
  }

  return segments;
};

const resolvePathSegment = (
  currentValue: unknown,
  segment: string,
  path: string,
  examples: string[]
): unknown => {
  if (Array.isArray(currentValue)) {
    if (!ARRAY_INDEX_PATTERN.test(segment)) {
      throw createInvalidOutputPathError(path, examples);
    }

    const nextValue: unknown = currentValue[Number.parseInt(segment, 10)];

    if (nextValue === undefined) {
      throw createMissingOutputPathError(path, examples);
    }

    return nextValue;
  }

  if (typeof currentValue === "object" && currentValue !== null) {
    const recordValue = currentValue as Record<string, unknown>;
    const nextValue = recordValue[segment];

    if (nextValue === undefined) {
      throw createMissingOutputPathError(path, examples);
    }

    return nextValue;
  }

  throw createMissingOutputPathError(path, examples);
};

const createInvalidOutputPathError = (path: string, examples: string[]) =>
  createAppError("INVALID_INPUT", `Invalid output path "${path}".`, createProjectionErrorDetails(path, examples));

const createMissingOutputPathError = (path: string, examples: string[]) =>
  createAppError("NOT_FOUND", `Output path "${path}" did not match any value.`, createProjectionErrorDetails(path, examples));

const createProjectionErrorDetails = (
  path: string,
  examples: string[]
): ProjectionErrorDetails => ({
  ...(examples.length > 0 ? { examples } : {}),
  ...(examples.length > 0 ? { hint: `Try paths like: ${examples.join(", ")}` } : {}),
  path
});
