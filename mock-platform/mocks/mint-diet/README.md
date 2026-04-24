# mock-mint-diet

Bun+Hono mock for a diet-tracking app. Runs on port 5003 by default.

## Usage

```bash
MOCK_DATA_DIR=/tmp/mint-diet ./mock-mint-diet --port 5003
```

- `MOCK_DATA_DIR` — directory where `mint-diet.sqlite` is written (required)
- `--port` — TCP port to listen on (default: `5003`)

## WAL verifier artifact contract

The SQLite database is opened in WAL mode (`PRAGMA journal_mode=WAL`). This means three files are
created inside `MOCK_DATA_DIR`:

| File | Purpose |
|---|---|
| `mint-diet.sqlite` | Main database file |
| `mint-diet.sqlite-wal` | Write-ahead log (present while database is open) |
| `mint-diet.sqlite-shm` | Shared-memory index for WAL readers |

Verifiers that read the database file directly must:

1. **Use a WAL-aware reader** — standard SQLite clients handle this automatically; raw file copies
   will miss unflushed WAL pages.
2. **Open the database read-only** after the mock process exits — the WAL is checkpointed on clean
   shutdown, so the main file is self-consistent.
3. **Not assume the `-wal`/`-shm` files are absent** — if the mock is killed (e.g. by Docker stop),
   the WAL may not be fully checkpointed. Open with `PRAGMA journal_mode` after connecting to force
   a read-time checkpoint if needed.

## Routes

### Daily log

| Method | Path | Description |
|---|---|---|
| GET | `/log` | Redirect to today's log |
| GET | `/log/:date` | Day view (slots: breakfast/lunch/dinner/snacks) |
| GET | `/log/:date/add/:slot` | Food search + add form |
| POST | `/log/:date/add/:slot` | Submit food entry |
| GET | `/log/entry/:id/edit` | Edit food entry form |
| POST | `/log/entry/:id` | Update food entry |
| POST | `/log/entry/:id/delete` | Delete food entry |

### Meal plans

| Method | Path | Description |
|---|---|---|
| GET | `/plans` | List all plans |
| POST | `/plans` | Create plan |
| GET | `/plans/:id` | Plan detail (days + slots + ingredients) |
| POST | `/plans/:id` | Update plan |
| POST | `/plans/:id/delete` | Delete plan |
| POST | `/plans/:id/items` | Add meal plan item |
| GET | `/plans/:id/slots/:date/:slot` | Slot editor (inline edit/delete per item) |
| POST | `/plans/:id/items/:itemId` | Update meal plan item |
| POST | `/plans/:id/items/:itemId/delete` | Delete meal plan item |
| POST | `/plans/:id/ingredients` | Add ingredient |
| POST | `/plans/:id/ingredients/:ingId` | Update ingredient |
| POST | `/plans/:id/ingredients/:ingId/delete` | Delete ingredient |

### Utility

| Method | Path | Description |
|---|---|---|
| GET | `/health` | `{"ok":true}` |
| GET | `/__mock_sentinel__/mint-diet` | `{"sentinel":true}` |

## Smoke test

```bash
# Build first (from mock-platform/)
bun run build

# Run smoke test against the built binary
./smoke.sh ../../dist/mock-mint-diet
```
