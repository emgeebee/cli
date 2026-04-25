# phone_cli

Small personal CLI tools for football fixtures and terminal calendar output.

## Included CLIs

- `ball`: football fixtures (day view or team view)
- `cal`: terminal month calendar

## Install / Run

### From npm with npx

```bash
npx --yes --package @emgeebee/phone_cli ball --day 2026-04-26
npx --yes --package @emgeebee/phone_cli ball --team aston-villa
npx --yes --package @emgeebee/phone_cli cal
```

### From this repo

```bash
pnpm ball -- --day 2026-04-26
pnpm ball -- --team aston-villa
pnpm cal
```

### Global install / link

```bash
npm i -g @emgeebee/phone_cli
# or from local repo:
pnpm link --global
```

Then run:

```bash
ball --day 2026-04-26
ball --team aston-villa
cal
```

## ball

### Usage

```bash
ball --day YYYY-MM-DD
ball --team TEAM
```

### Team argument examples

```bash
ball --team avfc
```

### Current behavior

- `--day`:
  - grouped by competition
  - competition allowlist applied (Premier League, Championship, League One, FA Cup, League Cup, Champions League, Europa League, Scottish Premiership)
  - competitions ordered in a fixed sequence
- `--team`:
  - pulls fixtures from BBC team `urn` endpoint
  - includes past 14 days + next 30 days
  - flat list (not grouped)
  - no competition filtering
  - shows competition name at end of each line
- Times are shown in UK local time (`Europe/London`) with timezone label (`BST`/`GMT`)
- Result color highlighting:
  - finished: dark green winner / dark red loser
  - live: brighter green winner / brighter red loser
  - disabled when output is non-interactive or `NO_COLOR` is set

### Example output (team mode)

```text
Future fixtures for aston-villa
- sun 12/04 14:00 BST Nottm Forest 1-1 Aston Villa (Premier League)
- thu 30/04 20:00 BST Nottm Forest vs Aston Villa (UEFA Europa League)
```

## cal

### Usage

```bash
cal
cal 4 2026
```

### Current behavior

- `cal` (no args): prints current month + next 2 months
- `cal <month> <year>`: prints one month (`month` is `1-12`)
- highlights today in terminal output when color is supported

