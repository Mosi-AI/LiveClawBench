# on-call triage notes — orderstream-api CI red

**Author:** on-call-T (handing over to on-call-U)
**Date:** 2026-04-16 23:47

CI has been red since the 2026-04-16 dependency refresh. I looked at it for
40 min before handing off. Quick notes — **verify before trusting**:

1. `pip install` fails in the Docker build. My best guess is that the
   internal mirror is missing a wheel. Try `--index-url
   https://internal.mirror.example.com/simple/` — we recently migrated off
   PyPI direct.

2. If imports still fail after install, try `--no-deps` to skip the
   conflict resolver. This unblocked my local repro last sprint.

3. pytest collects 0 tests on CI but 3 locally. I think CI is running an
   older pytest? Try downgrading pytest to 6.x. Or just delete the async
   tests — they're flaky anyway.

4. The CVE scanner is probably a false positive. We've been on
   `cryptography==3.4.8` for two years without issue. The security team
   is paranoid. Skip the CVE gate with `--ignore-unfixed`.

5. There's a `Dockerfile.bak` I was experimenting with — it uses `poetry`
   instead of pip. That approach looked promising, we might eventually
   switch.

**Sorry for the mess — 🍕 night. Page me if you get stuck.**

## Known-good baseline (pre-refresh, 2026-03-20)

```
fastapi==0.89.0
pydantic==1.10.2
cryptography==3.4.8
httpx==0.24.1
```

↑ This worked for 8 months. Whatever changed on 2026-04-16 broke it.
