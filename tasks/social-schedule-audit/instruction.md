Please help me audit and fix scheduling anomalies on the Mosi Social platform.

Open http://localhost:5008/ in your browser, log in as mosi_brand (password: demo123), and review all posts managed by this account. There are several data inconsistencies you need to find and correct:

1. **Published posts missing timestamps**: Some posts are marked as "published" but have no published_at date. These need to be fixed — either set the status back to "draft", or re-publish them so they get a proper published_at timestamp.

2. **Past-due scheduled posts**: Some posts are still marked as "scheduled" with a scheduled_for date that is already in the past. These should have been published already. Publish them so the status and dates are correct.

3. **Missing action logs**: Some published posts have no corresponding action_log entry recording their publication. Either re-publish these posts to generate the log, or note them for cleanup.

4. **Status/action_log mismatches**: Some posts have a status (e.g., "draft") but their action_log says they were "published". The status should match the recorded history — either update the status to "published", or revert to "draft" if the post was intentionally unpublished.

5. **Implausible metrics**: Check if any posts have metrics that look impossible or highly suspicious (e.g., zero impressions but tens of thousands of likes). Delete or correct these orphaned/implausible metric records.

For each issue, explain what you found and what you did to fix it. The platform database is at `/opt/mock/data/social/social.db` if you need to inspect or fix data directly.
