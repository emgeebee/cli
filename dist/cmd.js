#!/usr/bin/env node
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

// cmd.ts
var cmd_exports = {};
module.exports = __toCommonJS(cmd_exports);
var BASE_URL = "http://api.emgeebee.buzz:1880";
var COMMANDS = {
  slon: { room: "shed", device: "lights", state: "on" },
  slof: { room: "shed", device: "lights", state: "off" },
  smon: { room: "shed", device: "music", state: "on" },
  smof: { room: "shed", device: "music", state: "off" },
  shon: { room: "shed", device: "heater", state: "on" },
  shof: { room: "shed", device: "heater", state: "off" },
  blon: { room: "bedroom", device: "lights", state: "on" },
  blof: { room: "bedroom", device: "lights", state: "off" }
};
function usage() {
  console.log("Usage:");
  console.log("  cmd <command>");
  console.log("");
  console.log("Commands:");
  console.log("  slon  shed lights on");
  console.log("  slof  shed lights off");
  console.log("  smon  shed music on");
  console.log("  smof  shed music off");
  console.log("  shon  shed heater on");
  console.log("  shof  shed heater off");
  console.log("  blon  bedroom lights on");
  console.log("  blof  bedroom lights off");
}
async function main() {
  const args = process.argv.slice(2);
  if (args[0] === "--help" || args[0] === "-h" || args.length === 0) {
    usage();
    return;
  }
  if (args.length !== 1) {
    console.error("Expected exactly one command.");
    console.error("");
    usage();
    process.exit(1);
  }
  const code = args[0].toLowerCase();
  const target = COMMANDS[code];
  if (!target) {
    console.error(`Unknown command: ${args[0]}`);
    console.error("");
    usage();
    process.exit(1);
  }
  const url = `${BASE_URL}/api/trigger-${target.room}-${target.device}/${target.state}`;
  const response = await fetch(url, { method: "POST" });
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }
  console.log(`Triggered ${target.room} ${target.device} ${target.state}`);
}
main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`cmd failed: ${message}`);
  process.exit(1);
});
