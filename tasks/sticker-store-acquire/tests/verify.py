#!/usr/bin/env python3
import sqlite3
import sys

DB_PATH = "/opt/mock/data/chat/chat.sqlite"


def main():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Check 1: user_sticker_pack has Cute Cats (pack_id=1) and Space Adventure (pack_id=2)
    cursor.execute(
        "SELECT sticker_pack_id FROM user_sticker_pack WHERE user_id = 1 AND sticker_pack_id IN (1, 2)"
    )
    acquired = {row["sticker_pack_id"] for row in cursor.fetchall()}

    # Check 2: at least 6 user_sticker rows with pack_id IN (1, 2)
    cursor.execute(
        "SELECT COUNT(*) as cnt FROM user_sticker WHERE user_id = 1 AND pack_id IN (1, 2)"
    )
    sticker_count = cursor.fetchone()["cnt"]

    cute_cats_acquired = 1 in acquired
    space_adventure_acquired = 2 in acquired

    if cute_cats_acquired and space_adventure_acquired and sticker_count >= 6:
        print("Score: 1.0/1.0")
        sys.exit(0)
    elif (cute_cats_acquired or space_adventure_acquired) and sticker_count >= 3:
        print("Score: 0.5/1.0")
        sys.exit(0)
    else:
        print("Score: 0.0/1.0")
        sys.exit(1)


if __name__ == "__main__":
    main()
