"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConfigPath = getConfigPath;
exports.readPhoneCliConfig = readPhoneCliConfig;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const node_os_1 = require("node:os");
const CONFIG_FILE = ".phone_cli.json";
function getConfigPath() {
    return (0, node_path_1.join)((0, node_os_1.homedir)(), CONFIG_FILE);
}
function readPhoneCliConfig() {
    const path = getConfigPath();
    try {
        const raw = (0, node_fs_1.readFileSync)(path, "utf8");
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            throw new Error("Top-level JSON must be an object.");
        }
        return parsed;
    }
    catch (error) {
        if (typeof error === "object" &&
            error != null &&
            "code" in error &&
            error.code === "ENOENT") {
            return {};
        }
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to read config at ${path}: ${message}`);
    }
}
