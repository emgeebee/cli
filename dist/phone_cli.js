#!/usr/bin/env node
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// phone_cli.ts
var phone_cli_exports = {};
module.exports = __toCommonJS(phone_cli_exports);
var import_node_child_process = require("node:child_process");
var import_node_path = require("node:path");
var COMMANDS = /* @__PURE__ */ new Set(["i", "ball", "cal", "w", "cric", "octo", "bday", "money", "cmd", "fuel", "r", "temp", "solar", "status"]);
function printUsage() {
  console.log("phone_cli commands:");
  console.log("  ball   Football fixtures / PL table");
  console.log("  cal    Calendar");
  console.log("  w      Weather");
  console.log("  cric   Cricket fixtures");
  console.log("  octo   Octopus energy");
  console.log("  bday   Birthday age table");
  console.log("  money  Monthly countdown value");
  console.log("  cmd    Home automation shortcuts");
  console.log("         slon, slof, smon, smof, shon, shof, blon, blof, wfh");
  console.log("  fuel   UK fuel prices (near, station, list)");
  console.log("  r      UK rail boards (departures, arrivals, search)");
  console.log("  temp   House temperature history (last 24h)");
  console.log("  solar  Solar yield and power history");
  console.log("  status Clock, date, sunrise/sunset");
  console.log("");
  console.log("Or run the interactive picker:");
  console.log("  npx @emgeebee/phone_cli i");
  console.log("  i");
  console.log("");
  console.log("Usage:");
  console.log("  npx @emgeebee/phone_cli <command> [args]");
  console.log("");
  console.log("Examples:");
  console.log("  npx @emgeebee/phone_cli ball");
  console.log("  npx @emgeebee/phone_cli ball pl");
  console.log("  npx @emgeebee/phone_cli money");
  console.log("  npx @emgeebee/phone_cli cmd");
  console.log("  npx @emgeebee/phone_cli cmd slon");
  console.log('  npx @emgeebee/phone_cli fuel near "SE1 9SG" --fuel E10');
  console.log("  npx @emgeebee/phone_cli r departures KGX");
  console.log("  npx @emgeebee/phone_cli temp");
  console.log("  npx @emgeebee/phone_cli solar");
}
function runSubcommand(command, args) {
  const scriptPath = (0, import_node_path.join)(__dirname, `${command}.js`);
  const result = (0, import_node_child_process.spawnSync)(process.execPath, [scriptPath, ...args], { stdio: "inherit" });
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
