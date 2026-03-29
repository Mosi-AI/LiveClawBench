# Browser Portal

The internal portal is available through `tools/browser_mock_client.py`.

Use it when the local corpus is not enough to confirm later updates, deployment caveats, or lower-confidence pages that should be rejected.

Typical usage:

- `python3 tools/browser_mock_client.py home`
- `python3 tools/browser_mock_client.py search "your query"`
- `python3 tools/browser_mock_client.py visit "/docs/example?sid=search_0001&rank=1"`

The portal contains both validated pages and lower-confidence pages. Inspect both kinds before you finalize the durable note or the database.
