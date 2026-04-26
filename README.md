# phone_cli

Small personal CLI tools for football fixtures, cricket scorecards, calendar output, and weather.

The project is written in TypeScript and compiled to `dist/`.

## Included CLIs

- `ball`: football fixtures (day view or team view)
- `cric`: cricket scorecards for today
- `cal`: terminal month calendar
- `w`: weather forecast by postcode
- `octo`: placeholder CLI
- `bday`: birthday age table from config
- `money`: monthly countdown value

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
npx --yes --package @emgeebee/phone_cli bday
npx --yes --package @emgeebee/phone_cli money
```

### From this repo

```bash
pnpm build
node dist/ball.js
node dist/cric.js
node dist/cal.js
node dist/w.js
node dist/octo.js
node dist/bday.js
node dist/money.js
```

Or use package scripts (which build first):

```bash
pnpm ball -- 2026-04-26
pnpm ball -- aston-villa
pnpm cric
pnpm cal
pnpm w
pnpm octo
pnpm bday
pnpm money
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
bday
money
```

## ball

### Usage (ball)

```bash
ball
ball pl
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
ball pl
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
- Keyword table mode:
  - `ball pl` fetches and prints the Premier League table
  - reads RapidAPI key from `~/.phone_cli.json` under `ball.rapidApiKey`

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

You can also store per-CLI settings in `~/.phone_cli.json`:

```json
{
  "octo": {
    "basicAuthToken": "sk_live_...",
    "accountNumber": "A-00000000",
    "gasKwhPerUnit": 11.2
  },
  "cric": {},
  "ball": {
    "rapidApiKey": "YOUR_RAPIDAPI_KEY"
  }
}
```

When both are present, env vars take precedence for `octo`.

### Current behavior (octo)

- Requires `OCTOPUS_BASIC_AUTH_TOKEN` (basic auth token) and `OCTOPUS_ACCOUNT_NUMBER`
- Optional gas conversion factor: `OCTOPUS_GAS_KWH_PER_UNIT` (or config `octo.gasKwhPerUnit`, default `11.2`)
- Calls account endpoint: `https://api.octopus.energy/v1/accounts/<account>/`
- Derives active electricity/gas tariff + product codes from account agreements
- Fetches standard unit rates for electricity and gas for the next ~2 days
- Prints tariff codes and rate windows (inc VAT)

## bday

### Usage (bday)

```bash
bday
```

### Config shape (`~/.phone_cli.json`)

```json
{
  "bday": {
    "me": { "bd": "1984-07-28" },
  }
}
```

### Current behavior (bday)

- Reads birthdays from `bday` section in `~/.phone_cli.json`
- Prints an ASCII table with columns:
  - `Days`
  - `Weeks`
  - `Months`
  - `Normal` (e.g. `3 years, 4 months`)

## money

### Usage (money)

```bash
money
```

### Current behavior (money)

- Start amount comes from config `~/.phone_cli.json` at `money.budget` (defaults to `744` if unset)
- Uses a straight daily countdown:
  - day 1 = `720`
  - subtract `24` each day
  - day 26 = `120`
  - day 31 = `0`
