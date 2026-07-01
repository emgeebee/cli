# Remote cache

phone_cli persists cross-run cache data in the shared docs API instead of local JSON files. Each **service** gets one document so reads and writes need at most one HTTP call per service per command.

## Authentication

Uses the same bearer token as `cal`:

```json
{
  "cal": {
    "token": "your-token-here"
  }
}
```

Requests send:

- `Authorization: Bearer <token>`
- `x-api-key: <token>`

## API

Base URL: `https://1q1v3hm1n2.execute-api.us-west-2.amazonaws.com/prod`

| Operation | Method | Path |
|-----------|--------|------|
| Create | `POST` | `/docs` |
| List | `GET` | `/docs` |
| Get | `GET` | `/docs/{id}` |
| Update | `PUT` | `/docs/{id}` |
| Delete | `DELETE` | `/docs/{id}` |

Document ids must be alphanumeric with `_` or `-` only. Your user id comes from the token; files are stored at `docs/{userid}/{id}.json` in S3.

### Create a document

```bash
curl -X POST 'https://1q1v3hm1n2.execute-api.us-west-2.amazonaws.com/prod/docs' \
  -H 'authorization: Bearer <token>' \
  -H 'content-type: application/json' \
  -d '{
    "id": "phone-cli-octo",
    "title": "phone-cli octo cache",
    "data": {
      "gasPrices": {},
      "electricityPrices": {},
      "monthlyAverages": {}
    }
  }'
```

`id` is optional — omit it to auto-generate one.

### Get one document

```bash
curl 'https://1q1v3hm1n2.execute-api.us-west-2.amazonaws.com/prod/docs/phone-cli-octo' \
  -H 'authorization: Bearer <token>'
```

### Update a document

Uses `PUT` when the document already exists. On first save, the client falls back to `POST` with the fixed service id.

```bash
curl -X PUT 'https://1q1v3hm1n2.execute-api.us-west-2.amazonaws.com/prod/docs/phone-cli-octo' \
  -H 'authorization: Bearer <token>' \
  -H 'content-type: application/json' \
  -d '{
    "title": "phone-cli octo cache",
    "data": {
      "gasPrices": { "2026-03-15": [7.2, 7.5] },
      "electricityPrices": {},
      "monthlyAverages": {}
    }
  }'
```

## Service documents

| Document id | Service | `data` fields |
|-------------|---------|---------------|
| `phone-cli-octo` | Octopus (`octo`, `status` gas/electricity) | `gasPrices`, `electricityPrices`, `monthlyAverages` |
| `phone-cli-solar` | Solar monthly yield (`solar`, `status`) | `monthlyYield` |

On first run with a token configured, any existing local cache files under the legacy cache directory are uploaded once, then kept in memory and synced remotely.

## Behaviour

- **Load**: one `GET` per service when a command first needs that cache
- **Save**: in-memory update immediately; debounced `PUT` (500ms) batches writes within a command
- **Exit**: `octo`, `solar`, and `status` flush pending writes before exiting
- **No token**: cache works in-memory for the session only; nothing is persisted

## Code

- `lib/docsApi.ts` — HTTP client for `/docs`
- `lib/cache.ts` — service-grouped cache load/save/flush

## Legacy local files

If `cacheDir` is set (or the default OS cache path is used), those paths are only read for one-time migration:

- `octo/gas-prices.json`
- `octo/electricity-prices.json`
- `octo/monthly-averages.json`
- `solar/monthly-yield.json`

Legacy blobs in `~/.phone_cli.json` under `octo.*` and `solar.monthlyYieldCache` are also migrated on first load.
