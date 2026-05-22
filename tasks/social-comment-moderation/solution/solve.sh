#!/usr/bin/env bash
set -euo pipefail
cd /workspace

# Reference solution for social-comment-moderation
# 1. Read email for moderation instructions
# 2. Login to social media, review comments
# 3. Delete violating comments (switch accounts as needed)
# 4. Reply to legitimate question from brand account

SOCIAL="http://127.0.0.1:5008"
COOKIE_JAR="/tmp/social_cookies.txt"

social_login() {
    local user="$1"
    local resp
    resp=$(curl -s -c "$COOKIE_JAR" -X POST "$SOCIAL/api/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"username\": \"$user\", \"password\": \"demo123\"}")
    echo "$resp"
}

# Step 1: Delete comment 101 (scam) - authored by alice
social_login "alice" > /dev/null
curl -s -b "$COOKIE_JAR" -X DELETE "$SOCIAL/api/comments/101"
echo "Deleted comment 101 (scam)"

# Step 2: Delete comment 103 (fake news) - authored by bob_creator
social_login "bob_creator" > /dev/null
curl -s -b "$COOKIE_JAR" -X DELETE "$SOCIAL/api/comments/103"
echo "Deleted comment 103 (fake news)"

# Step 3: Delete comment 104 (spam) - authored by alice
social_login "alice" > /dev/null
curl -s -b "$COOKIE_JAR" -X DELETE "$SOCIAL/api/comments/104"
echo "Deleted comment 104 (spam)"

# Step 4: Reply to comment 102 (legitimate question) from mosi_brand
social_login "mosi_brand" > /dev/null
curl -s -b "$COOKIE_JAR" -X POST "$SOCIAL/api/comments/102/reply" \
    -H "Content-Type: application/json" \
    -d '{"body": "Thank you for your feedback! The mobile app update is planned for next month. Stay tuned!"}'
echo "Replied to comment 102"

echo "All moderation actions completed."
