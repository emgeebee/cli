#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_child_process_1 = require("node:child_process");
const node_path_1 = require("node:path");
const COMMANDS = new Set(["ball", "cal", "w", "cric", "octo", "bday", "money"]);
function printUsage() {
    console.log("phone_cli commands:");
    console.log("  ball   Football fixtures / PL table");
    console.log("  cal    Calendar");
    console.log("  w      Weather");
    console.log("  cric   Cricket fixtures");
    console.log("  octo   Octopus energy");
    console.log("  bday   Birthday age table");
    console.log("  money  Monthly countdown value");
    console.log("");
    console.log("Usage:");
    console.log("  npx @emgeebee/phone_cli <command> [args]");
    console.log("");
    console.log("Examples:");
    console.log("  npx @emgeebee/phone_cli ball");
    console.log("  npx @emgeebee/phone_cli ball pl");
    console.log("  npx @emgeebee/phone_cli money");
}
function runSubcommand(command, args) {
    const scriptPath = (0, node_path_1.join)(__dirname, `${command}.js`);
    const result = (0, node_child_process_1.spawnSync)(process.execPath, [scriptPath, ...args], { stdio: "inherit" });
    process.exit(result.status ?? 1);
}
async function main() {
    const args = process.argv.slice(2);
    const cmd = args[0];
    if (!cmd || cmd === "--help" || cmd === "-h") {
        printUsage();
        return;
    }
    if (!COMMANDS.has(cmd)) {
        console.error(`Unknown command: ${cmd}`);
        console.error("");
        printUsage();
        process.exit(1);
    }
    runSubcommand(cmd, args.slice(1));
}
void main();
