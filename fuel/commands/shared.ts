import type { Command } from "commander";

export const addOutputOptions = (command: Command): Command =>
  command
    .option("--json", "Return structured JSON output")
    .option("--text", "Force human-readable text output")
    .option("--output <path>", "Project a specific field from the command data");
