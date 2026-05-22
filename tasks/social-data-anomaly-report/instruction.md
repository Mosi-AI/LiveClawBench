Please check your email inbox at http://localhost:5001/ for a message about a social media data integrity check. Once you understand the request, examine the social media platform at http://localhost:5008/ for data anomalies.

Log into the social media platform with username "mosi_brand" and password "demo123". Review the posts, their metrics, and the action logs to identify any inconsistencies. Pay close attention to:

- Posts with status "published" but missing published_at timestamps
- Posts with metrics that are impossible or contradictory (e.g., likes without impressions)
- Posts whose status contradicts their action log history

You may also inspect the database directly at `/opt/mock/data/social/social.db`.

Once you have identified the anomalies, send a detailed report email via the email system (http://localhost:5001/) to data-team@mosi.inc with the subject "Social Media Data Anomaly Report". The report should clearly describe each anomaly you found.
