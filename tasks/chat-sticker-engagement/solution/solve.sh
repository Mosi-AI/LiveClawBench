#!/bin/bash
set -e

# Acquire Cute Cats and Space Adventure packs
curl -s -X POST http://localhost:5003/api/store/packs/1/acquire
curl -s -X POST http://localhost:5003/api/store/packs/2/acquire

# Get sticker IDs for the acquired packs
STICKERS=$(curl -s http://localhost:5003/api/stickers)

# Send a cat sticker in #pets (channel_id=2)
# Find first sticker with pack_id=1
CAT_ID=$(echo "$STICKERS" | python3 -c "import sys,json; s=json.load(sys.stdin); print([x['id'] for x in s['stickers'] if x.get('pack_id')==1][0])")
curl -s -X POST http://localhost:5003/api/channels/2/messages \
  -H "Content-Type: application/json" \
  -d "{\"message_kind\":\"sticker\",\"sticker_id\":$CAT_ID}"

# Send a space sticker in #space (channel_id=3)
SPACE_ID=$(echo "$STICKERS" | python3 -c "import sys,json; s=json.load(sys.stdin); print([x['id'] for x in s['stickers'] if x.get('pack_id')==2][0])")
curl -s -X POST http://localhost:5003/api/channels/3/messages \
  -H "Content-Type: application/json" \
  -d "{\"message_kind\":\"sticker\",\"sticker_id\":$SPACE_ID}"

# Move all cat stickers (pack_id=1) to favorite
for ID in $(echo "$STICKERS" | python3 -c "import sys,json; s=json.load(sys.stdin); print(' '.join(str(x['id']) for x in s['stickers'] if x.get('pack_id')==1))"); do
  curl -s -X PATCH "http://localhost:5003/api/stickers/$ID" \
    -H "Content-Type: application/json" \
    -d '{"category":"favorite"}'
done

echo "Tasks completed."
