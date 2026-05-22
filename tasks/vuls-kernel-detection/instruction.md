# Vuls reports kernel CVEs that don't actually apply to my running kernel

You are working in the Vuls (vulnerability scanner) repository, checked out
at the commit immediately before the upstream fix landed. The repository root
is `/workspace/repo`.

A user filed the following issue:

> On my Red Hat 8 host I have several kernel packages installed (older
> kernels left around for rollback). After I `reboot`, Vuls keeps reporting
> CVEs that target the kernels I'm *not* currently running. The currently
> running kernel is fine, but Vuls is matching against every kernel-* RPM
> that's on disk.
>
> The same pattern shows up on Ubuntu and Debian when I have older kernels
> retained by apt — Vuls keeps flagging issues against the not-running ones.
>
> Expected: Vuls should only report kernel CVEs that affect the kernel my
> machine actually booted into.

Your task:

1. Reproduce the issue using the unit tests already in the repo.
2. Fix the root cause so that on every supported distribution, Vuls
   distinguishes between the running kernel and other installed kernel
   packages, and only reports CVEs against the running one.
3. Add Go tests covering the new behaviour for all the distributions you
   touched.
4. Do not regress existing tests.

The verifier will compile the project and run the kernel-detection tests
across multiple distribution scanners. All of them must pass.

Constraints the grader enforces:

- Fixing the symptom in only one scanner (for example, only patching the
  Red Hat path) while leaving the duplicated logic in the other scanners
  will be detected and capped at partial credit. The fix must be coherent
  across every distro adapter that exhibits the same bug.
- The new tests must reference the running-kernel-vs-installed-kernel
  distinction in a meaningful way. Tautological assertions will be rejected.
- You do not need to support distributions that the project does not
  already target.

You do not need to update documentation unless required to keep the
project's existing self-tests passing.
