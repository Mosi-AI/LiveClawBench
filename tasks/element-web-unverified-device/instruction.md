# Notifications aren't reliable when a device becomes unverified

You are working in the Element web client repository, checked out at the commit
immediately before the upstream fix landed. The repository root is `/workspace/repo`.

A Matrix user filed the following issue:

> When I sign in on a new device, I get a notification saying "Unverified
> device" — that's great. But when one of my *existing* trusted devices
> *becomes* unverified later (for example after my account password is
> reset on the server, or after my cross-signing key gets rotated, or when
> I manually mark a device as unverified for review), no notification fires.
> The icon in the device list updates, but I get no popup, no badge, nothing
> in the notification center. I'd expect the same alert I get on a new login.

Your task:

1. Reproduce the issue.
2. Fix the root cause so that the same alert fires in every situation where
   a device ends up in the unverified state, not just on a fresh sign-in.
3. Add tests that cover the new behaviour. The tests must exercise more than
   one of the transition paths into the unverified state.
4. Do not regress any existing tests.

When you are done, the test suite for the affected package(s) must pass with
your changes in place. The verifier will compile the project and run the
relevant tests. Both the pre-existing tests **and** any new tests you add
must succeed.

Constraints the grader enforces:

- A "global broadcast" workaround at the application shell (catching any
  state change and unconditionally firing the notification) will be detected
  and rejected — the fix has to live where the unverified state is actually
  entered, not where the consequences are noticed.
- Tests must reference the verification state and the transition paths in
  a non-trivial way. An "assert true" or a tautological mock check will be
  rejected.
- A fix that only handles one or two of the transition paths will receive
  proportional partial credit, not full credit.

You do not need to update documentation unless it is necessary to keep the
project's existing self-tests passing.
