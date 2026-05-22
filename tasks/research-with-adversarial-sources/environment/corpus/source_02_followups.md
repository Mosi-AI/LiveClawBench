# source_id: source_02_followups

# Follow-up Questions

After you open both pinned URLs, capture a small reusable record addressing
these four questions. Use concise, machine-friendly identifiers as your answers.

1. **paper_exactness** — From the paper page, determine what guarantee the
   method makes about output quality. Does it approximate, or does it preserve
   the exact target-model distribution? Capture this as a short factual label.

2. **paper_core_mechanism** — From the paper page, describe the two-phase
   decoding loop in a few words: what does the drafter do, and what does the
   target model do? Capture the core mechanism as a concise identifier.

3. **paper_venue** — From the paper page header or footer, identify the
   publication venue, volume, and year. Encode this as a compact reference
   string so future lookups can cite it without re-visiting the page.

4. **video_role** — After visiting the YouTube page, classify its role in one
   short phrase. Is it primary research, a public explainer, a tutorial, etc.?

The goal is not to scrape the entire page. The goal is to leave a compact,
reusable reference that answers these four questions with the correct factual
identifiers.
