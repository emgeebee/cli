import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Command } from 'commander';

import { getConfigPath } from '../config';
import { registerArrivalsCommand } from './commands/arrivalsCommand';
import { registerDeparturesCommand } from './commands/departuresCommand';
import { registerSearchCommand } from './commands/searchCommand';
import { loadConfig } from './lib/config';
import { createHuxleyClient } from './providers/huxley';

import type { HuxleyClient } from './providers/huxley';

export type CliDependencies = {
  huxleyClient: HuxleyClient;
};

const readPackageVersion = (): string => {
  const candidatePaths = [join(__dirname, '..', '..', 'package.json'), join(__dirname, '..', 'package.json')];
  for (const path of candidatePaths) {
    if (!existsSync(path)) {
      continue;
    }
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as { version?: unknown };
    if (typeof parsed.version === 'string' && parsed.version.trim().length > 0) {
      return parsed.version;
    }
  }
  return '0.0.0';
};
const packageVersion = readPackageVersion();
const TOP_LEVEL_HELP_EXAMPLES = `
Examples:
  rail departures KGX
  rail departures "edinburgh" --to york
  rail arrivals leeds --from london --limit 5
  rail search "waterloo"
  printf "waterloo\\nvictoria\\n" | rail search --stdin
`;

export const buildCli = (dependencies?: CliDependencies): Command => {
  const config = loadConfig();
  const huxleyClient = dependencies?.huxleyClient ?? createHuxleyClient(config);
  const program = new Command();

  program
    .name('rail')
    .description('UK National Rail CLI for agents and humans')
    .option('--no-color', 'Disable ANSI colours in text output')
    .showHelpAfterError()
    .showSuggestionAfterError()
    .version(packageVersion);

  registerDeparturesCommand(program, huxleyClient);
  registerArrivalsCommand(program, huxleyClient);
  registerSearchCommand(program, huxleyClient);

  program.addHelpText('after', TOP_LEVEL_HELP_EXAMPLES);
  program.addHelpText(
    'after',
    `\nOptional config: ${getConfigPath()} → r.darwinAccessToken, r.railApiUrl (and rail.* aliases). Override API host with RAIL_API_URL.`,
  );
  program.addHelpText(
    'after',
    '\nOutput defaults to text in a TTY and JSON when piped. Use --json or --text to override.',
  );

  return program;
};
