# phone_cli

Small personal CLI tools (TypeScript, compiled to `dist/` via esbuild). See `README.md` for the full list of CLIs and usage.

## Cursor Cloud specific instructions

- Package manager is `pnpm` (see `packageManager` in `package.json`). Node 22 and pnpm are preinstalled. The update script runs `pnpm install`.
- Lint/typecheck: `pnpm typecheck` (runs `tsc --noEmit`). There is no separate linter and no automated test suite (`pnpm test` is a placeholder that exits 1).
- Build: `pnpm build` (typecheck + esbuild bundle into `dist/`). The `pnpm approve-builds` warning about esbuild's ignored build script is harmless — esbuild ships its platform binary via optional dependencies, so bundling works without approving the script.
- Run a CLI after building: `node dist/<name>.js` (e.g. `node dist/ball.js`, `node dist/money.js`). The `pnpm <name>` scripts rebuild first, then run.
- Many CLIs read config from `~/.phone_cli.json` (see `config.ts`). CLIs like `cal` require a token there and will print a "Missing ... token" message if it is absent; this is expected without config, not an environment failure. `ball` and `money` work with no config.
- `ball`, `cric`, `w`, etc. fetch from live external APIs, so their output depends on network access and current data.

## Status UI layout (`status` CLI)

The live `status` dashboard (`status.ts`, layout in `lib/terminal.ts`, mobile panels in `lib/mobileStatusScreens.ts`) is a fullscreen TTY UI. Terminal **width** (columns) picks the layout tier; **height** can stack the calendar under the status box or force mobile mode on very short terminals.

### Column width model

Panels are drawn as boxed columns. A box adds 4 columns of border (`boxOuterWidth = innerWidth + 4`). Columns are separated by a 3-space gap.

The left column (status, shortcuts, optional calendar) targets **79 outer columns** (~75 chars of content). Side columns are sized to the same ~80-char target where possible (`STATUS_LEFT_COLUMN_MAX_OUTER = 79`, `STATUS_THREE_COLUMN_MAX_WIDTH = 236` for three-column sizing).

- **< 79 cols** — narrow: the left column shrinks to the terminal width; long lines wrap.
- **≥ 80 cols** — standard column width: left column stays at 79 outer; a second ~80-col panel can sit beside it (~161 cols total with gap).
- **Wider** — layout grows progressively: fit as many ~80-col columns as the terminal allows (two-column → three-column → four-column “full”). Tier selection is in `resolveStatusLayoutTier()`.

Very short terminals (`rows ≤ 32` and `columns ≤ 79`) always use mobile/status-only mode regardless of width math.

### Layout tiers

| Tier | When | What you see |
|------|------|--------------|
| `statusOnly` | Too narrow for a second column (`isMobileStatusTerminal`) or very small terminal | One full-screen panel at a time |
| `compact` | Wide enough for extra content but calendar does not fit under status | Status (+ shortcuts) stacked above one rotating panel |
| `stacked` | Same as compact, but enough height to stack calendar under status in the left column | Left stack + one rotating panel below |
| `twoColumn` | Fits status column + one side column | Left stack \| one rotating side panel |
| `threeColumn` | Fits three columns | Left stack \| middle panel \| sports panel — **columns rotate independently** |
| `full` | Fits four columns | Left \| weather \| solar \| sports (all visible, no rotation) |

### Rotation vs columns

**Small / mobile (`statusOnly`):** the whole screen is a single revolving set of panels. Cycles through `MOBILE_ROTATE_SCREENS` (status, football, villa, octo, solar, weather daily/hourly, cricket, calendar, birthdays). Only one panel visible at a time.

**Medium (`compact`, `stacked`, `twoColumn`):** one secondary panel rotates at a time (“compact rotation”) — weather, solar, sports panels, calendar (if not stacked in the left column). The left column stays fixed.

**Large (`threeColumn`):** panels sit in columns and **each column rotates on its own timer** (15 s by default, `PANEL_ALTERNATE_MS`):
- **Middle column:** weather ↔ solar
- **Sports column:** cricket ↔ football ↔ PL table ↔ villa

**Extra large (`full`):** all panels visible simultaneously; sports panels stack in the rightmost column.

Press **`n`** to flip to the next panel manually, **`p`** to pause/resume auto-rotation, **`d`** to page within a column when content overflows.

### Where to change things

- Layout tier logic and column joining: `lib/terminal.ts` (`resolveStatusLayoutTier`, `writeFullscreenLines`)
- Mobile full-screen panels and their content: `lib/mobileStatusScreens.ts`
- Rotation pools, timers, and key handling: `status.ts`
