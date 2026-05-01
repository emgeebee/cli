"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerArrivalsCommand = void 0;
const constants_1 = require("../lib/constants");
const commandUtils_1 = require("../lib/commandUtils");
const railBoards_1 = require("../lib/railBoards");
const output_1 = require("../lib/output");
const stations_1 = require("../lib/stations");
const ARRIVALS_HELP_EXAMPLES = `
Examples:
  rail arrivals leeds --from london --limit 5
`;
const registerArrivalsCommand = (program, huxleyClient) => {
    program
        .command('arrivals')
        .description('Get live arrivals at a National Rail station.')
        .argument('<station>', 'Station name or CRS code')
        .option('--from <origin>', 'Optional origin station to filter arrivals')
        .option('--expand', 'Include calling points for each service')
        .option('--limit <count>', 'Maximum number of arrivals to return', commandUtils_1.parseIntegerOption, constants_1.DEFAULT_LIMIT)
        .option('--json', 'Force JSON output')
        .option('--text', 'Force text output')
        .addHelpText('after', ARRIVALS_HELP_EXAMPLES)
        .action(async (station, options, command) => {
        await (0, output_1.runCommand)('arrivals', (0, output_1.withGlobalOutputOptions)(command, options), async () => {
            const limit = (0, commandUtils_1.ensurePositiveInteger)(options.limit ?? constants_1.DEFAULT_LIMIT, 'limit');
            const requestedStation = (0, railBoards_1.ensureStationInput)(station, 'station');
            const requestedFilter = options.from ? (0, railBoards_1.ensureStationInput)(options.from, 'origin') : undefined;
            const resolvedStation = await (0, stations_1.resolveStation)(huxleyClient, requestedStation);
            const resolvedFilter = requestedFilter
                ? await (0, stations_1.resolveStation)(huxleyClient, requestedFilter)
                : undefined;
            const board = await huxleyClient.getArrivals({
                crs: resolvedStation.crs,
                expand: options.expand,
                filterCrs: resolvedFilter?.crs,
                limit,
            });
            return (0, railBoards_1.normalizeRailBoardData)({
                board,
                boardKind: 'arrivals',
                expand: options.expand === true,
                requestedFilter,
                requestedStation,
                resolvedFilter,
                resolvedStation,
            });
        }, formatArrivalsText);
    });
};
exports.registerArrivalsCommand = registerArrivalsCommand;
const formatArrivalsText = (data, context) => (0, railBoards_1.formatRailBoardText)(data, 'arrivals', context);
