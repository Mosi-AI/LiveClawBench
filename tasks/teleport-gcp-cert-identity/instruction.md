# Teleport: please add GCP identity for certificate-issued workloads

You are working in the Teleport repository, checked out at the commit
immediately before the upstream change landed. The repository root is
`/workspace/repo`.

A platform engineer filed the following request:

> Today my workloads can present a Teleport-issued client certificate and
> automatically be granted an AWS identity, or an Azure identity. We use
> GCP for most of our infrastructure and there's no equivalent — we have to
> ship a long-lived service account key into every pod, which is exactly
> what Teleport identity-in-cert was supposed to eliminate.
>
> Could Teleport add the same flow for GCP, so a workload presenting a
> Teleport cert can pick up a short-lived GCP identity the same way AWS and
> Azure already work?

Your task:

1. Read how AWS and Azure identity issuance are wired today.
2. Add GCP support so a workload presenting a valid Teleport certificate can
   acquire a short-lived GCP identity through the same machinery.
3. The integration must use GCP's native authentication model for this kind
   of flow — do not invent a Teleport-private auth flow that doesn't match
   what GCP actually accepts.
4. Add Go tests covering the new GCP flow.
5. Do not regress existing AWS / Azure flows.

The verifier will compile the project and run the relevant identity-provider
tests for AWS, Azure, and GCP. All must pass.

Constraints the grader enforces:

- A third bespoke code branch that copy-pastes from the AWS or Azure flow
  and then mutates a few strings will be detected and rejected. The right
  shape is to plug GCP into the same abstraction AWS and Azure already use,
  not to add a sibling branch alongside them.
- Tests must reference the GCP identity-issuance flow and the abstraction
  that AWS / Azure / GCP share. Tautological tests will be rejected.
- A fix that breaks any AWS or Azure tests will receive a significant
  penalty even if the new GCP tests pass.

You do not need to update documentation unless required to keep the
project's existing self-tests passing.
