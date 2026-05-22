# Ansible iptables module should support ipset match_set

You are working in the Ansible repository, checked out at the commit
immediately before the upstream change landed. The repository root is
`/workspace/repo`.

An operator filed the following request:

> When I write iptables rules from Ansible I can express almost everything
> declaratively — *except* matching against ipset sets. Every time I need
> something like `-m set --match-set my-blocklist src` I have to drop down
> to a raw `shell:` task and lose all the idempotency guarantees Ansible
> normally gives me.
>
> Could the iptables module expose ipset's match-set functionality natively,
> with the same idempotency the rest of the module already provides?

Your task:

1. Add a way for the iptables module to express `-m set --match-set NAME
   FLAGS` rules.
2. Whatever module parameters you add must be validated by the module's
   normal parameter-validation machinery (illegal combinations should be
   rejected at the argspec layer, not by failing the iptables command
   itself).
3. Add unit tests covering the new parameters, both for argspec validation
   and for the rule string the module emits.
4. Do not regress existing tests.

The verifier will run the iptables module's unit tests and the integration-
style argspec validation. All must pass.

Constraints the grader enforces:

- The rule the module emits has to survive a round-trip through
  `iptables-save`. Concretely, if Ansible applies the same rule twice in a
  row (a normal `check_mode` flow), the second run must report no change.
  A rule string that looks right but isn't byte-for-byte what `iptables-save`
  emits will fail the second-run idempotency assertion. The grader runs
  this two-step check explicitly.
- Tests must reference the new parameter set and the idempotency invariant
  in a non-trivial way. Tautological tests will be rejected.

You do not need to update documentation unless required to keep the
project's existing self-tests passing.
