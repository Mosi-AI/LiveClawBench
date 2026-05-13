# mock-mint-diet

Bun+Hono mock for a diet-tracking app. Runs on port 5003 by default.

## Usage

```bash
MOCK_DATA_DIR=/tmp/mint-diet ./mock-mint-diet --port 5003
```

- `MOCK_DATA_DIR` — directory where `mint-diet.sqlite` is written (required)
- `--port` — TCP port to listen on (default: `5003`)

## WAL verifier artifact contract

The SQLite database is opened in WAL mode (`PRAGMA journal_mode=WAL`). Three points that verifiers must know:

1. **Standard SQLite clients opening the live DB path (`mint-diet.sqlite`) automatically read WAL data** — no special handling needed. The WAL is applied transparently on every read.

2. **Verifiers copying the DB artifact out of the container must include all three files**: `mint-diet.sqlite`, `mint-diet.sqlite-wal`, and `mint-diet.sqlite-shm` (if present). Copying only the main file misses unflushed WAL pages.

3. **`POST /admin/reset` runs `PRAGMA wal_checkpoint(FULL)` before responding**, so the main `.sqlite` file is guaranteed up-to-date immediately after a reset. Verifiers that reset and then copy the DB can safely copy only `mint-diet.sqlite` (the WAL is empty after a FULL checkpoint).

## Routes

### Daily log

| Method | Path | Description |
|---|---|---|
| GET | `/log` | Redirect to today's log |
| GET | `/log/:date` | Day view (slots: breakfast/lunch/dinner/snacks) |
| GET | `/log/:date/add/:slot` | Food search + add form |
| POST | `/log/:date/entries` | Submit food entry |
| GET | `/log/entry/:entryId/edit` | Edit food entry form |
| POST | `/log/entries/:entryId` | Update food entry |
| POST | `/log/entries/:entryId/delete` | Delete food entry |

### Meal plans

| Method | Path | Description |
|---|---|---|
| GET | `/plans` | List all plans |
| GET | `/plans/new` | New plan form |
| POST | `/plans` | Create plan |
| GET | `/plans/:planId` | Plan detail (`?tab=days` or `?tab=ingredients`) |
| GET | `/plans/:planId/edit` | Edit plan form |
| POST | `/plans/:planId` | Update plan |
| POST | `/plans/:planId/delete` | Delete plan |
| POST | `/plans/:planId/items` | Add meal plan item |
| GET | `/plans/:planId/days/:date/slots/:slot/edit` | Slot editor (inline edit/delete per item) |
| POST | `/plans/:planId/items/:itemId` | Update meal plan item |
| POST | `/plans/:planId/items/:itemId/delete` | Delete meal plan item |
| POST | `/plans/:planId/ingredients` | Add ingredient |
| POST | `/plans/:planId/ingredients/:ingId` | Update ingredient |
| POST | `/plans/:planId/ingredients/:ingId/delete` | Delete ingredient |

### Admin

| Method | Path | Description |
|---|---|---|
| POST | `/admin/reset` | Truncate mutable tables + WAL checkpoint (requires `MOCK_ADMIN=1`) |

### Utility

| Method | Path | Description |
|---|---|---|
| GET | `/health` | `{"ok":true,"status":"healthy","service":"mint-diet"}` |
| GET | `/__mock_sentinel__/mint-diet` | `{"mock":"mint-diet","sentinel":true}` |

## Smoke test

```bash
# Build first (from mock-platform/)
bun run build

# Run smoke test against the built binary
./smoke.sh ../../dist/mock-mint-diet
```
