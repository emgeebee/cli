# phone_cli

Small personal CLI tools for football fixtures, cricket scorecards, calendar output, and weather.

The project is written in TypeScript and compiled to `dist/`.

## Included CLIs

- `ball`: football fixtures (day view or team view)
- `cric`: cricket scorecards for today
- `cal`: terminal month calendar
- `w`: weather forecast by postcode
- `octo`: placeholder CLI

## Install / Run

### From npm with npx

```bash
npx --yes --package @emgeebee/phone_cli ball
npx --yes --package @emgeebee/phone_cli ball 2026-04-26
npx --yes --package @emgeebee/phone_cli ball aston-villa
npx --yes --package @emgeebee/phone_cli cric
npx --yes --package @emgeebee/phone_cli cal
npx --yes --package @emgeebee/phone_cli w
npx --yes --package @emgeebee/phone_cli octo
```

### From this repo

```bash
pnpm build
node dist/ball.js
node dist/cric.js
node dist/cal.js
node dist/w.js
node dist/octo.js
```

Or use package scripts (which build first):

```bash
pnpm ball -- 2026-04-26
pnpm ball -- aston-villa
pnpm cric
pnpm cal
pnpm w
pnpm octo
```

### Global install / link

```bash
npm i -g @emgeebee/phone_cli
# or from local repo:
pnpm link --global
```

Then run:

```bash
ball
ball 2026-04-26
ball aston-villa
cric
cal
w
octo
```

## ball

### Usage (ball)

```bash
ball
ball YYYY-MM-DD
ball DD/MM
ball today|tomorrow|mon|tues|wed|thurs|fri|sat|sun
ball TEAM
```

### Team argument examples

```bash
ball avfc
ball liv
ball aston-villa
```

### Current behavior (ball)

- Day mode:
  - grouped by competition
  - competition allowlist applied (Premier League, Championship, League One, FA Cup, League Cup, Champions League, Europa League, Scottish Premiership)
  - competitions ordered in a fixed sequence (inverted display order)
- Team mode:
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

## cal

### Usage (cal)

```bash
cal
cal 4 2026
```

### Current behavior (cal)

- `cal` (no args): prints current month + next 2 months
- `cal <month> <year>`: prints one month (`month` is `1-12`)
- highlights today in terminal output when color is supported

## cric

### Usage (cric)

```bash
cric
```

### Current behavior (cric)

- Calls the BBC cricket collated scores-fixtures endpoint for today
- Filters to: County Championship, English league/cup competitions, Tests, and men's internationals
- Groups fixtures by competition
- Prints fixtures in multi-line blocks:
  - line 1: time, match, ground, day (for multi-day games), summary
  - next lines: innings lines for each team (including additional innings when present)

## w

### Usage (w)

```bash
w
w ws9
w sw1a
```

### Current behavior (w)

- Calls BBC weather aggregated forecast endpoint for a postcode district
- Defaults to `cm2` when no postcode is supplied
- Prints a daily summary (up to 7 days):
  - weather type
  - low/high temperature in C
  - precipitation probability
  - wind speed and direction

## octo

### Usage (octo)

```bash
export OCTOPUS_BASIC_AUTH_TOKEN="..."
export OCTOPUS_ACCOUNT_NUMBER="A-7A860530"
octo
```

`OCTOPUS_BASIC_AUTH_TOKEN` can be either a raw Octopus API key (for example `sk_live_...`) or a pre-encoded Basic auth token.

### Current behavior (octo)

- Requires `OCTOPUS_BASIC_AUTH_TOKEN` (basic auth token) and `OCTOPUS_ACCOUNT_NUMBER`
- Calls account endpoint: `https://api.octopus.energy/v1/accounts/<account>/`
- Derives active electricity/gas tariff + product codes from account agreements
- Fetches standard unit rates for electricity and gas for the next ~2 days
- Prints tariff codes and rate windows (inc/ex VAT)
