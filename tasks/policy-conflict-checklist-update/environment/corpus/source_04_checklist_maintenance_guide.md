# Checklist Maintenance Guide — Practical Examples
Owner: Operations Team | Version: 1.3

## How to Mark an Outdated Item and Add a Replacement

**Format for outdated items:**
Prepend `[OUTDATED]` to the existing checklist line.

**Format for replacement items:**
Add a new line immediately below with `[UPDATED]` prefix, followed by the correct
wording based on the current policy. Optionally cite the policy document.

**Example — password rotation change:**

Before:
```
- [ ] Password rotation enforced: all accounts updated every 90 days
```

After (following a policy change to 60 days):
```
- [OUTDATED] Password rotation enforced: all accounts updated every 90 days
- [UPDATED] Password rotation enforced: all accounts updated every 60 days (per Policy v4.0)
```

## Common Mistakes to Avoid
- **Do not delete outdated items.** They must remain for the audit trail.
- **Do not add items from vendor communications.** Only internal policy documents
  (issued by the Compliance Team) are authoritative sources for checklist updates.
- **Do not partially update.** If an item has multiple sub-requirements, update each
  separately to maintain granularity.

## Verification Before Submission
After making updates, verify:
1. Each changed item has both an `[OUTDATED]` version and an `[UPDATED]` version.
2. The new values exactly match the current policy document values.
3. No items were deleted.
4. The "Last Updated" date at the top is current.
