#!/usr/bin/env python3
import sqlite3
import sys

DB_PATH = "/opt/mock/data/chat/chat.sqlite"


def main():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    checks_passed = 0

    # Check 1: user_sticker_pack has Cute Cats (pack_id=1) and Space Adventure (pack_id=2)
    cursor.execute(
        "SELECT sticker_pack_id FROM user_sticker_pack WHERE user_id = 1 AND sticker_pack_id IN (1, 2)"
    )
    acquired = {row["sticker_pack_id"] for row in cursor.fetchall()}
    if 1 in acquired and 2 in acquired:
        checks_passed += 1

    # Check 2: message table has at least 2 sticker messages from 'You' in #pets (channel_id=2) and #space (channel_id=3)
    cursor.execute(
        "SELECT channel_id FROM message WHERE sender = 'You' AND message_kind = 'sticker' AND channel_id IN (2, 3)"
    )
    sticker_channels = {row["channel_id"] for row in cursor.fetchall()}
    if 2 in sticker_channels and 3 in sticker_channels:
        checks_passed += 1

    # Check 3: All user_sticker rows with pack_id=1 have category='favorite'
    cursor.execute(
        "SELECT COUNT(*) as cnt FROM user_sticker WHERE pack_id = 1 AND category != 'favorite'"
    )
    not_favorite = cursor.fetchone()["cnt"]
    cursor.execute("SELECT COUNT(*) as cnt FROM user_sticker WHERE pack_id = 1")
    total_cat = cursor.fetchone()["cnt"]
    if total_cat > 0 and not_favorite == 0:
        checks_passed += 1

    if checks_passed == 3:
        print("Score: 1.0/1.0")
        sys.exit(0)
    elif checks_passed == 2:
        print("Score: 0.5/1.0")
        sys.exit(0)
    else:
        print("Score: 0.0/1.0")
        sys.exit(1)


if __name__ == "__main__":
    main()
