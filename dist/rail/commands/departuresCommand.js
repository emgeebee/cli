"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerDeparturesCommand = void 0;
const constants_1 = require("../lib/constants");
const commandUtils_1 = require("../lib/commandUtils");
const railBoards_1 = require("../lib/railBoards");
const output_1 = require("../lib/output");
const stations_1 = require("../lib/stations");
const DEPARTURES_HELP_EXAMPLES = `
Examples:
  rail departures KGX
  rail departures "edinburgh" --to york
`;
const registerDeparturesCommand = (program, huxleyClient) => {
    program
        .command('departures')
        .description('Get live departures from a National Rail station.')
        .argument('<station>', 'Station name or CRS code')
        .option('--to <destination>', 'Optional destination station to filter departures')
        .option('--expand', 'Include calling points for each service')
        .option('--limit <count>', 'Maximum number of departures to return', commandUtils_1.parseIntegerOption, constants_1.DEFAULT_LIMIT)
        .option('--json', 'Force JSON output')
        .option('--text', 'Force text output')
        .addHelpText('after', DEPARTURES_HELP_EXAMPLES)
        .action(async (station, options, command) => {
        await (0, output_1.runCommand)('departures', (0, output_1.withGlobalOutputOptions)(command, options), async () => {
            const limit = (0, commandUtils_1.ensurePositiveInteger)(options.limit ?? constants_1.DEFAULT_LIMIT, 'limit');
            const requestedStation = (0, railBoards_1.ensureStationInput)(station, 'station');
            const requestedFilter = options.to ? (0, railBoards_1.ensureStationInput)(options.to, 'destination') : undefined;
            const resolvedStation = await (0, stations_1.resolveStation)(huxleyClient, requestedStation);
            const resolvedFilter = requestedFilter
                ? await (0, stations_1.resolveStation)(huxleyClient, requestedFilter)
                : undefined;
            const board = await huxleyClient.getDepartures({
                crs: resolvedStation.crs,
                expand: options.expand,
                filterCrs: resolvedFilter?.crs,
                limit,
            });
            return (0, railBoards_1.normalizeRailBoardData)({
                board,
                boardKind: 'departures',
                expand: options.expand === true,
                requestedFilter,
                requestedStation,
                resolvedFilter,
                resolvedStation,
            });
        }, formatDeparturesText);
    });
};
exports.registerDeparturesCommand = registerDeparturesCommand;
const formatDeparturesText = (data, context) => (0, railBoards_1.formatRailBoardText)(data, 'departures', context);
