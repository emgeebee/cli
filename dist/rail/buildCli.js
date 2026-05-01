"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCli = void 0;
const node_path_1 = require("node:path");
const commander_1 = require("commander");
const config_1 = require("../config");
const arrivalsCommand_1 = require("./commands/arrivalsCommand");
const departuresCommand_1 = require("./commands/departuresCommand");
const searchCommand_1 = require("./commands/searchCommand");
const config_2 = require("./lib/config");
const huxley_1 = require("./providers/huxley");
// `phone_cli` compiles as CommonJS; resolve from compiled `dist/rail`.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const packageJson = require((0, node_path_1.join)(__dirname, '..', '..', 'package.json'));
const TOP_LEVEL_HELP_EXAMPLES = `
Examples:
  rail departures KGX
  rail departures "edinburgh" --to york
  rail arrivals leeds --from london --limit 5
  rail search "waterloo"
  printf "waterloo\\nvictoria\\n" | rail search --stdin
`;
const buildCli = (dependencies) => {
    const config = (0, config_2.loadConfig)();
    const huxleyClient = dependencies?.huxleyClient ?? (0, huxley_1.createHuxleyClient)(config);
    const program = new commander_1.Command();
    program
        .name('rail')
        .description('UK National Rail CLI for agents and humans')
        .option('--no-color', 'Disable ANSI colours in text output')
        .showHelpAfterError()
        .showSuggestionAfterError()
        .version(packageJson.version);
    (0, departuresCommand_1.registerDeparturesCommand)(program, huxleyClient);
    (0, arrivalsCommand_1.registerArrivalsCommand)(program, huxleyClient);
    (0, searchCommand_1.registerSearchCommand)(program, huxleyClient);
    program.addHelpText('after', TOP_LEVEL_HELP_EXAMPLES);
    program.addHelpText('after', `\nOptional config: ${(0, config_1.getConfigPath)()} → r.darwinAccessToken, r.railApiUrl (and rail.* aliases). Override API host with RAIL_API_URL.`);
    program.addHelpText('after', '\nOutput defaults to text in a TTY and JSON when piped. Use --json or --text to override.');
    return program;
};
exports.buildCli = buildCli;
