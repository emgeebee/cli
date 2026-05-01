"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerSearchCommand = void 0;
const constants_1 = require("../lib/constants");
const commandUtils_1 = require("../lib/commandUtils");
const errors_1 = require("../lib/errors");
const output_1 = require("../lib/output");
const stations_1 = require("../lib/stations");
const SEARCH_HELP_EXAMPLES = `
Examples:
  rail search "waterloo"
  rail search "waterloo" --select crs
  printf "waterloo\\nvictoria\\n" | rail search --stdin
`;
const SEARCH_USAGE = '[options] <query>\n       rail search [options] --stdin';
const VALID_SEARCH_SELECT_MODES = ['name', 'crs', 'name,crs'];
const registerSearchCommand = (program, huxleyClient) => {
    program
        .command('search')
        .description('Search National Rail stations by name.')
        .usage(SEARCH_USAGE)
        .argument('[query]', 'Station search query')
        .option('--stdin', 'Read newline-delimited queries from stdin')
        .option('--select <fields>', 'Return only search fields: name, crs, or name,crs')
        .option('--limit <count>', 'Maximum number of candidates to return', commandUtils_1.parseIntegerOption, constants_1.DEFAULT_LIMIT)
        .option('--json', 'Force JSON output')
        .option('--text', 'Force text output')
        .addHelpText('after', SEARCH_HELP_EXAMPLES)
        .action(async (query, options, command) => {
        if (!options.stdin && query === undefined) {
            command.error(`error: missing required argument 'query'`, {
                code: 'commander.missingArgument',
            });
        }
        await (0, output_1.runCommand)('search', (0, output_1.withGlobalOutputOptions)(command, options), async () => {
            const limit = (0, commandUtils_1.ensurePositiveInteger)(options.limit ?? constants_1.DEFAULT_LIMIT, 'limit');
            const selectMode = parseSearchSelectMode(options.select);
            if (options.stdin) {
                if (query !== undefined) {
                    throw (0, errors_1.createAppError)('INVALID_INPUT', 'query cannot be used together with --stdin. Remove the positional query or omit --stdin.');
                }
                return {
                    queries: await getBatchSearchResults(huxleyClient, limit, selectMode),
                };
            }
            const normalizedQuery = normalizeSearchQuery(query);
            return {
                candidates: await getProjectedCandidates(huxleyClient, normalizedQuery, limit, selectMode),
                query: normalizedQuery,
            };
        }, formatSearchText);
    });
};
exports.registerSearchCommand = registerSearchCommand;
const getBatchSearchResults = async (huxleyClient, limit, selectMode) => {
    if (process.stdin.isTTY === true) {
        throw (0, errors_1.createAppError)('INVALID_INPUT', '--stdin requires piped stdin input. Example: printf "waterloo\\nvictoria\\n" | rail search --stdin');
    }
    const queries = await readSearchQueriesFromStdin();
    if (queries.length === 0) {
        throw (0, errors_1.createAppError)('INVALID_INPUT', 'No search queries were provided on stdin. Pipe newline-delimited queries into rail search --stdin.');
    }
    return queries.reduce(async (queryResultsPromise, stdinQuery) => {
        const queryResults = await queryResultsPromise;
        const candidates = await getProjectedCandidates(huxleyClient, stdinQuery, limit, selectMode);
        return [
            ...queryResults,
            {
                candidates,
                query: stdinQuery,
            },
        ];
    }, Promise.resolve([]));
};
const getProjectedCandidates = async (huxleyClient, query, limit, selectMode) => (await (0, stations_1.searchStationCandidates)(huxleyClient, query))
    .slice(0, limit)
    .map((candidate) => projectCandidate(candidate, selectMode));
const projectCandidate = (candidate, selectMode) => {
    if (selectMode === undefined) {
        return candidate;
    }
    if (selectMode === 'name') {
        return {
            name: candidate.name,
        };
    }
    if (selectMode === 'crs') {
        return {
            crs: candidate.crs,
        };
    }
    return {
        name: candidate.name,
        crs: candidate.crs,
    };
};
const readSearchQueriesFromStdin = async () => {
    const stdinBody = await readStdin();
    return stdinBody
        .split(/\r?\n/u)
        .map((query) => query.trim())
        .filter((query) => query.length > 0);
};
const readStdin = async () => {
    let stdinBody = '';
    for await (const chunk of process.stdin) {
        stdinBody += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
    }
    return stdinBody;
};
const parseSearchSelectMode = (value) => {
    if (value === undefined) {
        return undefined;
    }
    const normalizedValue = value
        .split(',')
        .map((field) => field.trim())
        .join(',');
    if (isSearchSelectMode(normalizedValue)) {
        return normalizedValue;
    }
    throw (0, errors_1.createAppError)('INVALID_INPUT', `--select must be one of: ${VALID_SEARCH_SELECT_MODES.join(', ')}.`);
};
const isSearchSelectMode = (value) => VALID_SEARCH_SELECT_MODES.includes(value);
const normalizeSearchQuery = (query) => {
    const normalizedQuery = query?.trim() ?? '';
    if (normalizedQuery.length === 0) {
        throw (0, errors_1.createAppError)('INVALID_INPUT', 'query must not be empty.');
    }
    return normalizedQuery;
};
const formatSearchText = (data, context) => isSearchBatchData(data)
    ? formatBatchSearchText(data, context)
    : formatSingleSearchText(data, context);
const formatSingleSearchText = (data, context) => {
    if (data.candidates.length === 0) {
        return `No station matches for "${data.query}".`;
    }
    return data.candidates.map((candidate) => formatSearchCandidate(candidate, context)).join('\n');
};
const formatBatchSearchText = (data, context) => data.queries
    .map((queryResult) => {
    if (queryResult.candidates.length === 0) {
        return `Query: ${queryResult.query}\nNo station matches for "${queryResult.query}".`;
    }
    return [
        `Query: ${queryResult.query}`,
        ...queryResult.candidates.map((candidate) => formatSearchCandidate(candidate, context)),
    ].join('\n');
})
    .join('\n\n');
const formatSearchCandidate = (candidate, context) => {
    const includesName = hasCandidateName(candidate);
    const includesCrs = hasCandidateCrs(candidate);
    const formattedName = hasCandidateName(candidate)
        ? context.text.style.primary(context.text.style.bold(candidate.name))
        : undefined;
    const formattedCrs = includesCrs
        ? context.text.style.cyan(includesName ? `(${candidate.crs})` : candidate.crs)
        : undefined;
    if (formattedName && formattedCrs) {
        return `${formattedName} ${formattedCrs}`;
    }
    return formattedName ?? formattedCrs ?? '';
};
const isSearchBatchData = (data) => 'queries' in data;
const hasCandidateName = (candidate) => 'name' in candidate;
const hasCandidateCrs = (candidate) => 'crs' in candidate;
