/** @jsxImportSource hono/jsx */
/**
 * Sticker Manager page — WhatsApp-style green top bar + category grid + upload modal.
 * Enhanced with per-sticker category select and sort-order arrows.
 */

import type { Database } from "bun:sqlite";

const WHATSAPP_GREEN = "#25D366";

interface StickerManagerPageProps {
  db: Database | null;
}

interface StickerRow {
  id: number;
  storage_path: string;
  category: string;
  sort_order: number;
}

function getStickers(db: Database): StickerRow[] {
  return db
    .query("SELECT id, storage_path, category, sort_order FROM user_sticker ORDER BY category, sort_order ASC")
    .all() as StickerRow[];
}

export function StickerManagerPage({ db }: StickerManagerPageProps) {
  const allStickers = db ? getStickers(db) : [];
  const categories = ["recent", "favorite", "custom"];

  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Sticker Manager</title>
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
            padding: 20px;
          }
          .tabs {
            display: flex;
            gap: 8px;
            margin-bottom: 20px;
          }
          .tab {
            padding: 8px 20px;
            border-radius: 20px;
            background: white;
            border: 1px solid #ddd;
            cursor: pointer;
            font-size: 14px;
            color: #555;
          }
          .tab.active {
            background: ${WHATSAPP_GREEN};
            color: white;
            border-color: ${WHATSAPP_GREEN};
          }
          .grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
            gap: 16px;
          }
          .card {
            background: white;
            border-radius: 12px;
            padding: 12px;
            text-align: center;
            box-shadow: 0 1px 3px rgba(0,0,0,0.08);
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
          }
          .card img {
            width: 80px;
            height: 80px;
            object-fit: cover;
            border-radius: 8px;
          }
          .card.add {
            border: 2px dashed #ccc;
            color: #888;
            justify-content: center;
            cursor: pointer;
            min-height: 160px;
          }
          .card.add .plus {
            font-size: 32px;
            color: ${WHATSAPP_GREEN};
            margin-bottom: 4px;
          }
          .sticker-controls {
            display: flex;
            flex-direction: column;
            gap: 6px;
            width: 100%;
          }
          .sticker-controls select {
            padding: 6px 8px;
            border-radius: 6px;
            border: 1px solid #ddd;
            font-size: 13px;
            width: 100%;
          }
          .sticker-arrows {
            display: flex;
            gap: 6px;
            justify-content: center;
          }
          .sticker-arrows button {
            padding: 4px 10px;
            border-radius: 6px;
            border: 1px solid #ddd;
            background: white;
            cursor: pointer;
            font-size: 13px;
          }
          .sticker-arrows button:hover {
            background: #f0f2f5;
          }
          .modal-overlay {
            display: none;
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.4);
            align-items: center;
            justify-content: center;
            z-index: 100;
          }
          .modal-overlay.open { display: flex; }
          .modal {
            background: white;
            border-radius: 16px;
            padding: 24px;
            width: 360px;
            max-width: 90vw;
          }
          .modal h3 {
            margin-bottom: 16px;
            font-size: 18px;
          }
          .modal input[type="file"] {
            margin-bottom: 16px;
            width: 100%;
          }
          .modal select {
            width: 100%;
            padding: 10px;
            border-radius: 8px;
            border: 1px solid #ddd;
            margin-bottom: 16px;
            font-size: 14px;
          }
          .modal .actions {
            display: flex;
            gap: 10px;
            justify-content: flex-end;
          }
          .modal button {
            padding: 10px 20px;
            border-radius: 8px;
            border: none;
            cursor: pointer;
            font-size: 14px;
          }
          .modal .cancel {
            background: #eee;
            color: #555;
          }
          .modal .submit {
            background: ${WHATSAPP_GREEN};
            color: white;
          }
        `}</style>
      </head>
      <body>
        <div class="top-bar">
          <span>Sticker Manager</span>
          <div class="nav-links">
            <a href="/store">Store</a>
            <a href="/chat">Chat</a>
          </div>
        </div>
        <div class="container">
          <div class="tabs">
            {categories.map((cat) => (
              <div
                class="tab"
                data-tab={cat}
                onclick={`switchTab('${cat}')`}
              >
                {cat}
              </div>
            ))}
          </div>
          <div class="grid" id="sticker-grid">
            {allStickers.map((sticker) => (
              <div class="card" data-category={sticker.category} data-sort-order={sticker.sort_order} data-sticker-id={sticker.id}>
                <img src={sticker.storage_path} alt="sticker" />
                <div class="sticker-controls">
                  <select
                    onchange={`updateCategory(${sticker.id}, this.value)`}
                  >
                    <option value="recent" selected={sticker.category === "recent"}>Recent</option>
                    <option value="favorite" selected={sticker.category === "favorite"}>Favorite</option>
                    <option value="custom" selected={sticker.category === "custom"}>Custom</option>
                  </select>
                  <div class="sticker-arrows">
                    <button onclick={`moveUp(this)`}>&uarr;</button>
                    <button onclick={`moveDown(this)`}>&darr;</button>
                  </div>
                </div>
              </div>
            ))}
            <div class="card add" onclick="openModal()">
              <div class="plus">+</div>
              <div>Create</div>
            </div>
          </div>
        </div>
        <div class="modal-overlay" id="modal">
          <div class="modal">
            <h3>Upload Sticker</h3>
            <form id="upload-form" action="/api/stickers" method="post" enctype="multipart/form-data">
              <input type="file" name="file" accept="image/gif,image/png,image/jpeg" required />
              <select name="category">
                <option value="recent">Recent</option>
                <option value="favorite">Favorite</option>
                <option value="custom">Custom</option>
              </select>
              <div class="actions">
                <button type="button" class="cancel" onclick="closeModal()">Cancel</button>
                <button type="submit" class="submit">Upload</button>
              </div>
            </form>
          </div>
        </div>
        <script>{`
          function openModal() {
            document.getElementById('modal').classList.add('open');
          }
          function closeModal() {
            document.getElementById('modal').classList.remove('open');
          }
          document.getElementById('modal').addEventListener('click', function(e) {
            if (e.target === this) closeModal();
          });

          function switchTab(cat) {
            document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === cat));
            document.querySelectorAll('.card[data-category]').forEach(c => {
              c.style.display = c.dataset.category === cat ? 'flex' : 'none';
            });
            document.querySelector('.card.add').style.display = 'flex';
          }

          async function updateCategory(id, category) {
            try {
              const res = await fetch('/api/stickers/' + id, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ category: category })
              });
              if (res.ok) {
                window.location.reload();
              } else {
                alert('Failed to update category');
              }
            } catch (e) {
              alert('Network error');
            }
          }

          async function moveUp(btn) {
            const card = btn.closest('.card');
            if (!card) return;
            const id = card.dataset.stickerId;
            const currentSort = parseInt(card.dataset.sortOrder || '0', 10);
            try {
              const res = await fetch('/api/stickers/' + id, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sort_order: Math.max(0, currentSort - 1) })
              });
              if (res.ok) {
                window.location.reload();
              }
            } catch (e) {
              alert('Network error');
            }
          }

          async function moveDown(btn) {
            const card = btn.closest('.card');
            if (!card) return;
            const id = card.dataset.stickerId;
            const currentSort = parseInt(card.dataset.sortOrder || '0', 10);
            try {
              const res = await fetch('/api/stickers/' + id, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sort_order: currentSort + 1 })
              });
              if (res.ok) {
                window.location.reload();
              }
            } catch (e) {
              alert('Network error');
            }
          }

          // Initialize first tab as active
          switchTab('recent');
        `}</script>
      </body>
    </html>
  );
}
