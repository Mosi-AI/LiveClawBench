/** @jsxImportSource hono/jsx */
/**
 * Sticker Store page — grid of available packs with preview thumbnails.
 */

import type { Database } from "bun:sqlite";

const WHATSAPP_GREEN = "#25D366";

interface StorePageProps {
  db: Database | null;
}

function getPacks(db: Database) {
  const packRows = db
    .query("SELECT id, title, provider_name, previews_json FROM sticker_pack ORDER BY sort_order ASC, id ASC")
    .all() as { id: number; title: string; provider_name: string; previews_json: string }[];

  const acquiredRows = db
    .query("SELECT sticker_pack_id FROM user_sticker_pack WHERE user_id = 1")
    .all() as { sticker_pack_id: number }[];
  const acquiredSet = new Set(acquiredRows.map((r) => r.sticker_pack_id));

  return packRows.map((row) => {
    let previews: { filename: string; label: string }[] = [];
    try {
      previews = JSON.parse(row.previews_json);
    } catch { /* ignore */ }
    return {
      id: row.id,
      title: row.title,
      provider_name: row.provider_name,
      previews,
      acquired: acquiredSet.has(row.id),
    };
  });
}

export function StorePage({ db }: StorePageProps) {
  const packs = db ? getPacks(db) : [];

  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Sticker Store</title>
        <style>{`
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: #f0f2f5;
            min-height: 100vh;
          }
          .top-bar {
            background: ${WHATSAPP_GREEN};
            color: white;
            padding: 16px 20px;
            font-size: 18px;
            font-weight: 600;
            display: flex;
            align-items: center;
            justify-content: space-between;
          }
          .nav-links {
            display: flex;
            gap: 16px;
          }
          .nav-links a {
            color: white;
            text-decoration: none;
            font-size: 14px;
            font-weight: 500;
          }
          .nav-links a:hover {
            text-decoration: underline;
          }
          .container {
            max-width: 900px;
            margin: 0 auto;
            padding: 24px 20px;
          }
          .pack-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 20px;
          }
          .pack-card {
            background: white;
            border-radius: 16px;
            padding: 20px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.08);
            display: flex;
            flex-direction: column;
            gap: 12px;
          }
          .pack-title {
            font-size: 16px;
            font-weight: 600;
            color: #111;
          }
          .pack-provider {
            font-size: 13px;
            color: #666;
          }
          .preview-row {
            display: flex;
            gap: 8px;
            justify-content: center;
          }
          .preview-row img {
            width: 48px;
            height: 48px;
            border-radius: 8px;
            object-fit: cover;
            background: #f0f2f5;
          }
          .acquire-btn {
            margin-top: 4px;
            padding: 10px 0;
            border-radius: 10px;
            border: none;
            background: ${WHATSAPP_GREEN};
            color: white;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
          }
          .acquire-btn:disabled {
            background: #ccc;
            cursor: default;
          }
        `}</style>
      </head>
      <body>
        <div class="top-bar">
          <span>Sticker Store</span>
          <div class="nav-links">
            <a href="/chat">Chat</a>
            <a href="/stickers">Manager</a>
          </div>
        </div>
        <div class="container">
          <div class="pack-grid" id="pack-grid">
            {packs.map((pack) => (
              <div class="pack-card" data-pack-id={pack.id}>
                <div class="pack-title">{pack.title}</div>
                <div class="pack-provider">{pack.provider_name}</div>
                <div class="preview-row">
                  {pack.previews.map((p) => (
                    <img src={`/static/chat/store/${p.filename}`} alt={p.label} />
                  ))}
                </div>
                <button
                  type="button"
                  class="acquire-btn"
                  data-pack-id={pack.id}
                  disabled={pack.acquired}
                >
                  {pack.acquired ? "Acquired" : "Acquire"}
                </button>
              </div>
            ))}
          </div>
        </div>
        <script>{`
          document.getElementById('pack-grid').addEventListener('click', async function(e) {
            const btn = e.target.closest('.acquire-btn');
            if (!btn || btn.disabled) return;
            const id = btn.dataset.packId;
            try {
              const res = await fetch('/api/store/packs/' + id + '/acquire', { method: 'POST' });
              if (res.ok) {
                window.location.reload();
              } else {
                alert('Failed to acquire pack');
              }
            } catch (err) {
              alert('Network error');
            }
          });
        `}</script>
      </body>
    </html>
  );
}
