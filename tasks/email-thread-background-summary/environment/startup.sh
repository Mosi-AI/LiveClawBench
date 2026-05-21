#!/usr/bin/env bash
set -euo pipefail

# Seed inbox email for email-thread-background-summary
# Inserts one project kickoff email so the agent can identify the topic
# and then read the relevant corpus files to prepare a background summary.

EMAIL_DB="/var/lib/mock-data/email/email.db"
if [ ! -f "$EMAIL_DB" ]; then
    echo "ERROR: Email DB not found at $EMAIL_DB" >&2
    exit 1
fi

PETER_ID=$(sqlite3 "$EMAIL_DB" "SELECT id FROM users WHERE username = 'peter' LIMIT 1;")
if [ -z "$PETER_ID" ]; then
    echo "ERROR: Peter user not found in email DB" >&2
    exit 1
fi

# Insert sender: David Chen (data engineering lead)
sqlite3 "$EMAIL_DB" "
INSERT OR IGNORE INTO users (id, username, email, password_hash, created_at)
VALUES (301, 'david.chen', 'd.chen@mosi-work.inc', 'x', datetime('now'));
"

# Insert the Nova Analytics Platform project kickoff email
sqlite3 "$EMAIL_DB" "
INSERT OR IGNORE INTO emails (id, sender_id, recipient_id, recipient_email, subject, body, folder, is_read, created_at, updated_at)
VALUES (
  601,
  301,
  ${PETER_ID},
  'peter.griffin@email.app',
  'New Project Kickoff: Nova Analytics Platform',
  'Hi,

Just wanted to loop you in on a new initiative kicking off next quarter.

We are building the Nova Analytics Platform — a unified internal data analytics system for the company. The goal is to replace our current fragmented reporting setup with a single source of truth for business intelligence.

I have put together some background materials in the corpus folder covering the project overview, architecture plans, stakeholders, and known risks. Please take a look and share your thoughts before our planning session next week.

Looking forward to collaborating on this one.

Best,
David Chen
Senior Data Engineer, Platform Team',
  'inbox',
  0,
  datetime('now', '-2 hours'),
  datetime('now', '-2 hours')
);
"

SEEDED=$(sqlite3 "$EMAIL_DB" "SELECT COUNT(*) FROM emails WHERE id = 601;")
echo "Seeded ${SEEDED} Nova Analytics email for email-thread-background-summary"
