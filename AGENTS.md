# phone_cli

Small personal CLI tools (TypeScript, compiled to `dist/` via esbuild). See `README.md` for the full list of CLIs and usage.

## Cursor Cloud specific instructions

- Package manager is `pnpm` (see `packageManager` in `package.json`). Node 22 and pnpm are preinstalled. The update script runs `pnpm install`.
- Lint/typecheck: `pnpm typecheck` (runs `tsc --noEmit`). There is no separate linter and no automated test suite (`pnpm test` is a placeholder that exits 1).
- Build: `pnpm build` (typecheck + esbuild bundle into `dist/`). The `pnpm approve-builds` warning about esbuild's ignored build script is harmless — esbuild ships its platform binary via optional dependencies, so bundling works without approving the script.
- Run a CLI after building: `node dist/<name>.js` (e.g. `node dist/ball.js`, `node dist/money.js`). The `pnpm <name>` scripts rebuild first, then run.
- Many CLIs read config from `~/.phone_cli.json` (see `config.ts`). CLIs like `cal` require a token there and will print a "Missing ... token" message if it is absent; this is expected without config, not an environment failure. `ball` and `money` work with no config.
- `ball`, `cric`, `w`, etc. fetch from live external APIs, so their output depends on network access and current data.
