"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCli = void 0;
const commander_1 = require("commander");
const node_path_1 = require("node:path");
const listCommand_1 = require("./commands/listCommand");
const nearCommand_1 = require("./commands/nearCommand");
const stationCommand_1 = require("./commands/stationCommand");
const config_1 = require("./lib/config");
const datasetStore_1 = require("./lib/datasetStore");
const fuelService_1 = require("./lib/fuelService");
const fuelFinderClient_1 = require("./providers/fuelFinderClient");
const postcodesClient_1 = require("./providers/postcodesClient");
// `phone_cli` compiles as CommonJS; avoid `import.meta` / `createRequire`.
// Use `__dirname` so the path still works after compilation into `dist/`.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const packageJson = require((0, node_path_1.join)(__dirname, "..", "..", "package.json"));
const TOP_LEVEL_HELP_EXAMPLES = [
    "fuel --list commute",
    "fuel list commute",
    'fuel near "SE1 9SG" --fuel E10',
    'fuel near "51.501,-0.141" --fuel B7_STANDARD --radius 8mi',
    'fuel station "tesco watford"',
    'fuel station "<node-id>" --json --output station.prices.0.pencePerLitre'
].join("\n  ");
const buildCli = (dependencies) => {
    const config = (0, config_1.loadConfig)();
    const fuelService = dependencies?.fuelService ??
        (0, fuelService_1.createFuelService)((0, datasetStore_1.createDatasetStore)(config.cacheDir, (0, fuelFinderClient_1.createFuelFinderClient)(config)), (0, postcodesClient_1.createPostcodesClient)());
    const program = new commander_1.Command();
    program
        .name("fuel")
        .description("UK fuel prices in your terminal. Built for AI agents, still useful for humans.")
        .option("--no-color", "Disable ANSI colours in text output")
        .showHelpAfterError()
        .showSuggestionAfterError()
        .version(packageJson.version);
    (0, nearCommand_1.registerNearCommand)(program, fuelService, config.defaultFuelType);
    (0, stationCommand_1.registerStationCommand)(program, fuelService);
    (0, listCommand_1.registerListCommand)(program, fuelService);
    program.addHelpText("after", `\nOutput defaults to text in a TTY and JSON when piped. Use --json or --text to override.\n\nExamples:\n  ${TOP_LEVEL_HELP_EXAMPLES}`);
    return program;
};
exports.buildCli = buildCli;
