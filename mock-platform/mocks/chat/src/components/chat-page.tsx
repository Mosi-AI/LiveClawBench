/** @jsxImportSource hono/jsx */
/**
 * Chat Room page — two-pane layout with channel sidebar and message thread.
 */

import type { Database } from "bun:sqlite";

const WHATSAPP_GREEN = "#25D366";

interface ChatPageProps {
  db: Database | null;
  selectedChannelId?: number;
}

function getChannels(db: Database) {
  return db
    .query("SELECT id, name, last_message_preview, unread_count FROM channel ORDER BY id ASC")
    .all() as { id: number; name: string; last_message_preview: string | null; unread_count: number }[];
}

function getMessages(db: Database, channelId: number) {
  return db
    .query("SELECT id, sender, body, sent_at, message_kind, source_ref FROM message WHERE channel_id = ? ORDER BY sent_at ASC")
    .all(channelId) as { id: number; sender: string; body: string; sent_at: string; message_kind: string; source_ref: string | null }[];
}

function getStickers(db: Database) {
  return db
    .query("SELECT id, storage_path, category FROM user_sticker ORDER BY category, sort_order ASC")
    .all() as { id: number; storage_path: string; category: string }[];
}

export function ChatRoomPage({ db, selectedChannelId: initialChannelId }: ChatPageProps) {
  const channels = db ? getChannels(db) : [];
  const selectedChannelId =
    initialChannelId && channels.some((ch) => ch.id === initialChannelId)
      ? initialChannelId
      : channels.length > 0
        ? channels[0].id
        : 1;
  const messages = db ? getMessages(db, selectedChannelId) : [];
  const stickers = db ? getStickers(db) : [];

  const categories = ["recent", "favorite", "custom"];

  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Chat</title>
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
            padding: 12px 20px;
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
          .layout {
            display: flex;
            height: calc(100vh - 48px);
          }
          .sidebar {
            width: 260px;
            background: white;
            border-right: 1px solid #ddd;
            overflow-y: auto;
          }
          .channel-item {
            padding: 14px 16px;
            cursor: pointer;
            border-bottom: 1px solid #f0f2f5;
            display: flex;
            flex-direction: column;
            gap: 4px;
          }
          .channel-item:hover, .channel-item.active {
            background: #f0f2f5;
          }
          .channel-name {
            font-size: 15px;
            font-weight: 600;
            color: #111;
          }
          .channel-preview {
            font-size: 13px;
            color: #666;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .channel-meta {
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .unread-badge {
            background: ${WHATSAPP_GREEN};
            color: white;
            font-size: 11px;
            padding: 2px 6px;
            border-radius: 10px;
          }
          .main {
            flex: 1;
            display: flex;
            flex-direction: column;
            background: #e5ddd5;
          }
          .messages {
            flex: 1;
            overflow-y: auto;
            padding: 16px;
            display: flex;
            flex-direction: column;
            gap: 10px;
          }
          .msg {
            max-width: 70%;
            padding: 10px 14px;
            border-radius: 12px;
            font-size: 14px;
            line-height: 1.4;
          }
          .msg.incoming {
            background: white;
            align-self: flex-start;
            border-top-left-radius: 2px;
          }
          .msg.outgoing {
            background: #dcf8c6;
            align-self: flex-end;
            border-top-right-radius: 2px;
          }
          .msg-sender {
            font-size: 12px;
            font-weight: 600;
            color: #666;
            margin-bottom: 2px;
          }
          .msg-sticker {
            width: 120px;
            height: 120px;
            object-fit: contain;
          }
          .input-bar {
            background: white;
            padding: 10px 16px;
            display: flex;
            gap: 10px;
            align-items: center;
            border-top: 1px solid #ddd;
          }
          .input-bar input {
            flex: 1;
            padding: 10px 14px;
            border: 1px solid #ddd;
            border-radius: 20px;
            font-size: 14px;
          }
          .input-bar button {
            padding: 10px 18px;
            border-radius: 20px;
            border: none;
            background: ${WHATSAPP_GREEN};
            color: white;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
          }
          .sticker-panel {
            display: none;
            position: absolute;
            bottom: 60px;
            left: 280px;
            right: 16px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            padding: 16px;
            max-height: 300px;
            overflow-y: auto;
            z-index: 50;
          }
          .sticker-panel.open { display: block; }
          .sticker-cat {
            font-size: 13px;
            font-weight: 600;
            color: #666;
            margin: 8px 0 6px;
            text-transform: capitalize;
          }
          .sticker-grid {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
          }
          .sticker-grid img {
            width: 64px;
            height: 64px;
            cursor: pointer;
            border-radius: 8px;
            object-fit: cover;
          }
          .sticker-grid img:hover {
            background: #f0f2f5;
          }
        `}</style>
      </head>
      <body>
        <div class="top-bar">
          <span>Chat</span>
          <div class="nav-links">
            <a href="/store">Store</a>
            <a href="/stickers">Manager</a>
          </div>
        </div>
        <div class="layout">
          <div class="sidebar" id="sidebar">
            {channels.map((ch) => (
              <div
                class={`channel-item ${ch.id === selectedChannelId ? "active" : ""}`}
                data-channel-id={ch.id}
                onclick={`selectChannel(${ch.id})`}
              >
                <div class="channel-name">{ch.name}</div>
                <div class="channel-meta">
                  <div class="channel-preview">{ch.last_message_preview ?? "No messages"}</div>
                  {ch.unread_count > 0 && (
                    <span class="unread-badge">{ch.unread_count}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div class="main">
            <div class="messages" id="messages">
              {messages.map((msg) => (
                <div class={`msg ${msg.sender === "You" ? "outgoing" : "incoming"}`}>
                  <div class="msg-sender">{msg.sender}</div>
                  {msg.message_kind === "sticker" && msg.source_ref ? (
                    <img
                      class="msg-sticker"
                      src={(() => {
                        // Look up sticker storage path from the stickers list
                        const s = stickers.find((st) => String(st.id) === msg.source_ref);
                        return s?.storage_path ?? "";
                      })()}
                      alt="sticker"
                    />
                  ) : (
                    <div>{msg.body}</div>
                  )}
                </div>
              ))}
            </div>
            <div class="input-bar">
              <input type="text" id="msg-input" placeholder="Type a message..." onkeypress={`if(event.key==='Enter')sendMessage()`} />
              <button onclick="toggleStickerPanel()">Sticker</button>
              <button onclick="sendMessage()">Send</button>
            </div>
            <div class="sticker-panel" id="sticker-panel">
              {categories.map((cat) => {
                const catStickers = stickers.filter((s) => s.category === cat);
                if (catStickers.length === 0) return null;
                return (
                  <div>
                    <div class="sticker-cat">{cat}</div>
                    <div class="sticker-grid">
                      {catStickers.map((s) => (
                        <img src={s.storage_path} alt="sticker" onclick={`sendSticker(${s.id})`} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <script>{`
          let currentChannelId = ${selectedChannelId};

          function selectChannel(id) {
            currentChannelId = id;
            window.location.href = '/chat?channel=' + id;
          }

          async function sendMessage() {
            const input = document.getElementById('msg-input');
            const body = input.value.trim();
            if (!body) return;
            try {
              const res = await fetch('/api/channels/' + currentChannelId + '/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ body: body, message_kind: 'chat' })
              });
              if (res.ok) {
                input.value = '';
                window.location.reload();
              } else {
                alert('Failed to send message');
              }
            } catch (e) {
              alert('Network error');
            }
          }

          async function sendSticker(stickerId) {
            try {
              const res = await fetch('/api/channels/' + currentChannelId + '/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message_kind: 'sticker', sticker_id: stickerId })
              });
              if (res.ok) {
                document.getElementById('sticker-panel').classList.remove('open');
                window.location.reload();
              } else {
                alert('Failed to send sticker');
              }
            } catch (e) {
              alert('Network error');
            }
          }

          function toggleStickerPanel() {
            document.getElementById('sticker-panel').classList.toggle('open');
          }

          // Parse channel from URL
          const params = new URLSearchParams(window.location.search);
          const urlChannel = params.get('channel');
          if (urlChannel) {
            currentChannelId = parseInt(urlChannel, 10);
            document.querySelectorAll('.channel-item').forEach(el => {
              el.classList.remove('active');
              if (el.dataset.channelId === urlChannel) el.classList.add('active');
            });
          }
        `}</script>
      </body>
    </html>
  );
}
