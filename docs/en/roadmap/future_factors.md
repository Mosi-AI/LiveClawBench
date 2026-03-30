# Future Factor Design: A3, A4, B3, C-axis

## Priority Order

| Priority | Factor | Rationale |
|:--------:|--------|-----------|
| 1 | **C1** — Environmental State Invalidation | Clearest reproducibility design; existing cases validate testability; most mature infrastructure |
| 2 | **A3** — Temporal & Resource Constraints | Concrete pilot case designs exist; main bottleneck is mock clock infrastructure |
| 3 | **B3** — Multi-Agent Delegation | Depends on OpenClaw sub-agent architecture maturity |
| 4 | **A4** — Cross-Modal Interaction | High build cost; accumulate pilot cases first, then formalize as a scored factor; requires vision-capable model |
| 5 | **C2** — Outcome Verification under Altered State | Defer until C1 pilot cases validate the C-axis evaluation infrastructure |

---

## A3: Temporal & Resource Constraints

**Status:** Roadmap — pilot case design needed.

### Definition

The task has time windows or quota limits; missing the window means the task cannot be completed.

### Core Test Point

Opportunity Cost — the agent must judge "if I don't do it now, it will be too late."

### Design Approach

- Inject real-time deadlines into mock environments
  (e.g., flight check-in window closes in 2 hours)
- Set resource quotas (e.g., only 3 API calls allowed, shopping budget cap)
- Introduce time-sensitive information that expires (e.g., flash sale prices)

### Planned Cases

1. Flight check-in window closing + seat preference negotiation
2. Time-limited discount shopping + budget constraint
3. Meeting scheduling: overlapping time slots + priority rules

### Technical Challenges

- Requires integrating a real-time clock into the mock environment
- Evaluation must account for timing (did the agent complete operations within the window?)
- Reproducibility: use relative time offsets rather than absolute timestamps

---

## A4: Cross-Modal Interaction

**Status:** Roadmap (extension direction) — higher build cost than A3; recommend accumulating pilot cases before formalizing as a scored factor. Requires vision-capable model.

### Definition

The task involves heterogeneous modality inputs or outputs (images, PDFs, screenshots, CAPTCHAs, audio); the agent must perceive across modalities and integrate information into the text-based decision flow.

### Core Test Point

Modality Bridging — can the agent accurately extract key information from non-text modalities and integrate it with the text service flow?

### Design Approach

- Key task information embedded in images/PDFs (e.g., order number in a screenshot, contract terms in a PDF)
- Requires parsing CAPTCHAs, graphical forms, or understanding page screenshots rather than DOM
- Built on Playwright browser tooling, leveraging the existing Chromium infrastructure

### Planned Cases

1. Extract key clauses from PDF contract + fill out online form
2. Identify product information from page screenshot + complete order flow
3. Parse image-containing email attachment + trigger subsequent service operations

### Technical Challenges

- Requires agent to have vision capability (multimodal LLM)
- Evaluation must distinguish "saw but misunderstood" vs. "didn't look at all"
- Higher build cost than A3; accumulate pilot cases before formalizing as a factor

### Relationship to Other Factors

- Orthogonal to A1: A1 focuses on the number of services, A4 focuses on the heterogeneity of input modalities
- Can be combined with A1: cross-service task + key information hidden in an image

---

## B3: Multi-Agent Delegation

**Status:** Roadmap — depends on OpenClaw sub-agent architecture maturity.

### Definition

Requires an orchestrator to coordinate multiple sub-agents to complete the task.

### Core Test Point

Delegation & Synthesis — how the orchestrator decomposes tasks, merges results, and handles conflicts.

### Design Approach

- Build on OpenClaw's internal sub-agent architecture
- Design scenarios that naturally decompose into parallel sub-tasks
- Construct situations where sub-agents produce conflicting results

### Planned Cases

1. Research report: collect information from multiple sources in parallel, then synthesize
2. Multi-service booking (hotel + flight + restaurant) with cross-agent constraint satisfaction
3. Code review + testing + deployment pipeline, with each stage handled by a specialized agent

### Technical Challenges

- Evaluate orchestration quality (not just final result)
- Measure coordination overhead vs. single-agent baseline
- Handle non-deterministic behavior of sub-agents

---

## Axis C: Runtime Adaptability

### Current Coverage

Thin — currently only `flight-seat-selection-failed` and `noise-filtering` partially address this dimension.

### C1: Environmental State Invalidation

**Status:** Next priority expansion direction.

**After the agent begins execution**, the environment state changes due to external causes, invalidating assumptions the agent has already established, forcing the agent to abandon its current path and replan.

**Key distinction from A2**: A2 = environment broken from the start (static); C1 = environment breaks mid-execution (dynamic, externally caused).

Key characteristics:
- State change occurs **mid-execution**, not at initial state (initial corruption belongs to A2)
- Change originates outside the agent's control (service-side rate limiting, resource preemption by a third party, security mechanism trigger, etc.)
- Forms a clean temporal split with A2: A2 = "broken from the start", C1 = "breaks mid-way"

Typical scenarios:
- Inventory cleared by another buyer mid-purchase (agent confirms availability → sold out at submission)
- API rate limit triggered (first few calls succeed → subsequent calls rejected)
- CAPTCHA appears on URL revisit (first visit normal → second visit requires verification)
- Service temporarily goes offline mid-task

> **Naming evolution**: original name "Dynamic Feedback Handling" (too broad) → "Deterministic Failure Injection"
> (heavily overlapped with A2; "deterministic injection" limited scenario scope) → current name "Environmental State Invalidation"
> (emphasizes "agent's established state assumptions are invalidated", forms a clean temporal split from A2,
> covers a broader range of exogenous changes including rate limits, flash sales, CAPTCHAs).

**Reproducibility design**: the mock environment must deterministically trigger state invalidation at the Nth specific operation (e.g., "2nd POST /checkout returns 409 Sold Out"), rather than introducing randomness.

### C2: Outcome Verification under Altered State

**Status:** Roadmap — lower priority than C1; defer until C1 pilot cases validate the C-axis evaluation infrastructure.

The agent must observe environment state to judge whether the task truly succeeded, rather than relying on a simple pass/fail signal.

Typical scenarios:
- "Did the email convey the right tone?" requires agent self-assessment
- After an operation, verify the service state has actually been updated, not just trust the API return value

### Expansion Directions

- Deterministically inject state failures during task execution (specified trigger timing, not random)
- Require agents to implement retry/fallback strategies
- Test graceful degradation when the optimal path is blocked
