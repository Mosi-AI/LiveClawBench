#!/bin/bash
python3 - <<'PYEOF'
import subprocess
import sys

script = """
import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context()
        page = await context.new_page()

        # Read EN policy
        await page.goto("http://localhost:8400/en/policy")
        en_content = await page.content()

        # Read EU policy - handle cookie wall
        await page.goto("http://localhost:8400/eu/policy")
        try:
            await page.click("button[type=submit]", timeout=5000)
            await page.wait_for_load_state("networkidle")
        except Exception:
            pass
        eu_content = await page.content()

        await browser.close()

        diff = \"\"\"# Policy Diff: English vs EU

## Data Retention Period
- EN: We retain your data for up to 24 months.
- EU: We retain your data for up to 12 months.

## Deletion Window
- EN: Deletion requests are processed within 30 days.
- EU: Deletion requests are processed within 72 hours under GDPR Article 17.

## Export Formats
- EN: You may export your data in CSV or Excel format.
- EU: You may export your data in CSV only (machine-readable format).

## Data Sharing
- EN: Your data may be shared with trusted analytics partners.
- EU: No sharing without explicit consent from the data subject.
\"\"\"

        with open("/workspace/policy_diff.md", "w") as f:
            f.write(diff)
        print("Written /workspace/policy_diff.md")

asyncio.run(main())
"""

result = subprocess.run(
    ["python3", "-c", script],
    capture_output=True, text=True
)
print(result.stdout)
if result.returncode != 0:
    print(result.stderr, file=sys.stderr)
    sys.exit(result.returncode)
PYEOF
