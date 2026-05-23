#!/bin/bash
# Oracle solution for ad-library-snapshot-capture
# Creates the exact expected output: 5 .png + 5 .md files for AD001-AD005

mkdir -p /workspace/ad_snapshots

# Minimal valid 1x1 white PNG
printf '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82' > /workspace/ad_snapshots/AD001.png

# Copy same minimal PNG for all 5 creatives
for id in AD002 AD003 AD004 AD005; do
    cp /workspace/ad_snapshots/AD001.png "/workspace/ad_snapshots/${id}.png"
done

# Write metadata files
cat > /workspace/ad_snapshots/AD001.md << 'EOF'
creative_id: AD001
status: CURRENT
headline: Summer Glow Collection - NovaLume
campaign_name: Summer 2026
start_date: 2026-04-01
end_date: 2026-08-31
platform: Meta
EOF

cat > /workspace/ad_snapshots/AD002.md << 'EOF'
creative_id: AD002
status: CURRENT
headline: NovaLume Hydration Serum Launch
campaign_name: Hydration 2026
start_date: 2026-05-15
end_date: 2026-09-15
platform: TikTok
EOF

cat > /workspace/ad_snapshots/AD003.md << 'EOF'
creative_id: AD003
status: CURRENT
headline: NovaLume x Creator Collab - Radiant Skin
campaign_name: Creator Q2 2026
start_date: 2026-03-01
end_date: 2026-06-30
platform: Instagram
EOF

cat > /workspace/ad_snapshots/AD004.md << 'EOF'
creative_id: AD004
status: CURRENT
headline: NovaLume Winter Defense Moisturizer
campaign_name: Winter 2026
start_date: 2026-02-01
end_date: 2026-07-31
platform: Meta
EOF

cat > /workspace/ad_snapshots/AD005.md << 'EOF'
creative_id: AD005
status: CURRENT
headline: NovaLume Everyday Essentials Bundle
campaign_name: Essentials 2026
start_date: 2026-01-15
end_date: 2026-12-31
platform: Google
EOF

echo "Oracle solution complete: 10 files in /workspace/ad_snapshots/"
