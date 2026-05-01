"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addOutputOptions = void 0;
const addOutputOptions = (command) => command
    .option("--json", "Return structured JSON output")
    .option("--text", "Force human-readable text output")
    .option("--output <path>", "Project a specific field from the command data");
exports.addOutputOptions = addOutputOptions;
