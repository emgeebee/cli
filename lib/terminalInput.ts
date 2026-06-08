export type TerminalKey =
  | { type: "char"; char: string }
  | { type: "up" }
  | { type: "down" }
  | { type: "enter" }
  | { type: "escape" }
  | { type: "ctrl-c" };

export function parseTerminalInputChunk(data: string, buffer: string): {
  keys: TerminalKey[];
  buffer: string;
} {
  let pending = buffer + data;
  const keys: TerminalKey[] = [];

  while (pending.length > 0) {
    if (pending[0] === "\u0003") {
      keys.push({ type: "ctrl-c" });
      pending = pending.slice(1);
      continue;
    }

    if (pending[0] === "\r" || pending[0] === "\n") {
      keys.push({ type: "enter" });
      pending = pending.slice(1);
      continue;
    }

    if (pending[0] === "\x1b") {
      if (pending.startsWith("\x1b[A") || pending.startsWith("\x1bOA")) {
        keys.push({ type: "up" });
        pending = pending.slice(pending.startsWith("\x1b[A") ? 3 : 4);
        continue;
      }
      if (pending.startsWith("\x1b[B") || pending.startsWith("\x1bOB")) {
        keys.push({ type: "down" });
        pending = pending.slice(pending.startsWith("\x1b[B") ? 3 : 4);
        continue;
      }
      if (pending.length < 3) {
        break;
      }
      keys.push({ type: "escape" });
      pending = pending.slice(1);
      continue;
    }

    keys.push({ type: "char", char: pending[0] });
    pending = pending.slice(1);
  }

  return { keys, buffer: pending };
}

export function enableRawTerminalInput(
  onKeys: (keys: TerminalKey[]) => void,
): () => void {
  if (!process.stdin.isTTY) {
    return () => {};
  }

  const stdin = process.stdin;
  let buffer = "";

  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");

  const handler = (data: string): void => {
    const parsed = parseTerminalInputChunk(data, buffer);
    buffer = parsed.buffer;
    if (parsed.keys.length > 0) {
      onKeys(parsed.keys);
    }
  };

  stdin.on("data", handler);

  return () => {
    stdin.removeListener("data", handler);
    stdin.setRawMode(false);
    stdin.resume();
  };
}

export function prepareStdinForChildProcess(): void {
  if (!process.stdin.isTTY) return;
  process.stdin.setRawMode(false);
  process.stdin.resume();
}

export function waitForKeypress(
  prompt = "Press any key to return to status...",
): Promise<void> {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) {
      resolve();
      return;
    }

    prepareStdinForChildProcess();
    process.stdout.write(`\n${prompt}`);

    const onData = (): void => {
      process.stdin.removeListener("data", onData);
      process.stdout.write("\n");
      resolve();
    };

    process.stdin.once("data", onData);
  });
}
