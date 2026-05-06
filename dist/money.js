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

// money.ts
var money_exports = {};
module.exports = __toCommonJS(money_exports);

// config.ts
var import_node_fs = require("node:fs");
var import_node_path = require("node:path");
var import_node_os = require("node:os");
var CONFIG_FILE = ".phone_cli.json";
function getConfigPath() {
  return (0, import_node_path.join)((0, import_node_os.homedir)(), CONFIG_FILE);
}
function readPhoneCliConfig() {
  const path = getConfigPath();
  try {
    const raw = (0, import_node_fs.readFileSync)(path, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Top-level JSON must be an object.");
    }
    return parsed;
  } catch (error) {
    if (typeof error === "object" && error != null && "code" in error && error.code === "ENOENT") {
      return {};
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read config at ${path}: ${message}`);
  }
}

// money.ts
var DEFAULT_START_AMOUNT = 744;
var DAILY_DEDUCTION = 24;
function usage() {
  console.log("Usage:");
  console.log("  money");
  console.log("");
  console.log(`Optional config: ${getConfigPath()} -> { "money": { "budget": 744 } }`);
}
function resolveBudget() {
  const config = readPhoneCliConfig();
  const moneyConfig = config.money || {};
  const raw = moneyConfig.budget;
  if (raw == null || raw === "") return DEFAULT_START_AMOUNT;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid money.budget in ${getConfigPath()}. Expected a non-negative number.`);
  }
  return value;
}
function moneyForToday(startAmount, now = /* @__PURE__ */ new Date()) {
  const dayOfMonth = now.getDate();
  const remaining = startAmount - DAILY_DEDUCTION * dayOfMonth;
  return { dayOfMonth, remaining: Math.max(0, remaining) };
}
async function main() {
  try {
    const args = process.argv.slice(2);
    if (args[0] === "--help" || args[0] === "-h") {
      usage();
      return;
    }
    if (args.length > 0) {
      throw new Error("This command takes no arguments.");
    }
    const startAmount = resolveBudget();
    const { dayOfMonth, remaining } = moneyForToday(startAmount);
    console.log(`Day ${dayOfMonth}: ${remaining}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    console.error("");
    usage();
    process.exit(1);
  }
}
void main();
