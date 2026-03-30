# What Makes Real Assistant Tasks Hard?

> LiveClawBench Paper §2 — Triple-Axis Complexity Framework

## 1. Opening Argument: The Compounding Effect of Complexity

The core limitation of existing benchmarks is not that tasks are too simple — it is that they **test only a single dimension of difficulty**.

SWE-bench tests code editing, WebArena tests web navigation, GAIA tests multi-source retrieval — each achieves high quality in its own dimension, but they share a hidden assumption: **task difficulty is single-factor**.

Real assistant scenarios do not work this way. When a user says "cancel my order from last week and use the refund to buy a flight to Shanghai next Wednesday", this single sentence simultaneously triggers:

- **Cross-service data flow**: order system → refund system → flight system → calendar system
- **Implicit goal resolution**: "my order from last week" requires the agent to locate it independently; "next Wednesday" requires date inference
- **State contamination**: the refund may fail, the flight may be sold out — the agent must handle non-ideal initial states

Testing any individual factor is not hard. **The difficulty arises when they stack together, because errors cascade and amplify** — a misjudgment in one step contaminates all downstream decisions. This is the factor stacking effect.

LiveClawBench's design goal: build a benchmark that **systematically measures the compounding effect of complexity**, rather than another single-dimension leaderboard.

---

## 2. Triple-Axis Complexity Framework

We decompose the complexity of assistant tasks into three orthogonal axes, each containing independently manipulable complexity factors.

> For the complete factor definitions, 30-case annotation table, and statistics, see [Complexity Framework Reference](../reference/complexity-framework.md).

### Axis A: Environment Complexity

This axis measures how many, and how complex, the external systems are that the agent must interact with.

A1 is the most fundamental and widespread source of complexity. The key test point is not "can it call two APIs" but rather **the accuracy of schema mapping** — the order ID format in email differs from the tracking number format in the logistics API, and the agent must convert correctly. 10 cases span a gradient from 2-service to 4-service coordination.

A2 is more subtle. Traditional benchmarks assume a clean environment state — the initial conditions the agent receives are all correct. In reality, databases may contain dirty data, config files may be outdated, a previous operation may have left a half-completed state. A2 requires the agent to **diagnose before executing** — a qualitative shift in what is being tested.

A3 is currently in roadmap. Time windows and resource quotas introduce opportunity cost — the agent must not only get it right, but get it right within constraints. This demands a fundamental improvement in planning capability.

### Axis B: Cognitive Demand

This axis measures the depth and persistence of the agent's internal reasoning chain.

B1 tests whether the agent can extract a complete execution plan from an ambiguous instruction. "Book me a restaurant" — for how many people? What cuisine? What price range? What time? The agent must judge which information must be asked, and which can be filled by common sense. 4 cases currently span a gradient from mildly ambiguous to severely underspecified.

B2 is one of LiveClawBench's most distinctive contributions. Virtually all existing benchmarks are stateless — each task is independent, requiring no cross-task knowledge maintenance. But real assistants must manage skill libraries, update knowledge bases, and handle schema evolution. 11 cases cover skill creation, skill update, skill merging, conflict resolution, and more.

B3 is currently in roadmap. Multi-agent delegation requires the orchestrator to possess task decomposition and result synthesis capability — a frontier challenge for current LLM agents.

### Axis C: Runtime Adaptability

> **Status: Next Priority Expansion Direction**

Axis C focuses on **the contrast between normal and abnormal flows in the same task scenario**. Unlike Axes A and B, the core of Axis C is not the number of environments or depth of reasoning, but **deterministic environmental state differences** — the same task scenario, preset to normal state vs. preset to abnormal state, fully reproducible.

Two existing cases provide initial validation of this dimension:

- `flight-seat-selection` (normal flow) vs. `flight-seat-selection-failed` (abnormal flow): the same seat selection scenario, but the latter presets the seat as unavailable — the agent must detect the failure and switch to an alternative
- `noise-filtering`: structured noise is mixed into the data returned by the environment — the agent must filter it during processing

The design advantage of Axis C lies in **fairness and reproducibility** — the environment state is identical across every run, and evaluation results are not subject to random variation. This differs from traditional "non-deterministic testing": we test the agent's adaptability by deterministically injecting different environment states, rather than introducing runtime randomness.

---

## 3. Benchmark Comparison

| Benchmark | A: Env Complexity | B: Cognitive Demand | C: Runtime Adapt. | Controlled Pairs |
|-----------|-------------------|---------------------|--------------------|------------------|
| SWE-bench | single repo env | fully specified goals | clean initial state | ✗ |
| WebArena | single web env | fully specified goals | clean initial state | ✗ |
| TerminalBench | single terminal env | long-horizon planning | some diagnosis tasks | ✗ |
| GAIA | multi-source retrieval | implicit sub-goals | clean initial state | ✗ |
| τ-bench | single service env | implicit preferences | dynamic user feedback | ✗ |
| **LiveClawBench** | **multi-service (2-4 svcs)** | **implicit + persistent knowledge** | **partial → roadmap** | **✓** |

Key differentiators:

1. **Multi-service vs. single environment**: SWE-bench/WebArena/TerminalBench all operate within a single environment. GAIA involves multiple data sources but no cross-service write operations or schema mapping. LiveClawBench cases require completing a full read-transform-write data flow across multiple Dockerized services.

2. **Persistent knowledge**: No other benchmark tests an agent's ability to maintain and evolve persistent skill/knowledge. This is B2's exclusive advantage.

3. **Controlled pairs**: This is LiveClawBench's methodological innovation. We design natural contrast groups — different variants of the same base task, each changing exactly one complexity factor. This enables controlled experiments to precisely measure the marginal effect of individual factors on agent performance, rather than reporting only an aggregate score.

---

## 4. Why This Framework Matters

### 4.1 Grounded in Real Usage, Not Theory

This framework was not derived from papers. It comes from systematic analysis of **1000+ real OpenClaw user interaction records**.

Our method is bottom-up: first annotate real failure cases, then inductively identify failure patterns, then abstract them into complexity factors. Each factor has explicit empirical grounding — not "we think this is important" but "we observed agents systematically failing here".

### 4.2 Enables Controlled Experiments via Natural Contrast Groups

Traditional benchmarks can only tell you "Model A scored 72 on Task X". But you cannot determine: was it because the cross-service mapping was wrong? Or because the contaminated state wasn't recognized? Or because the implicit goal wasn't properly resolved?

LiveClawBench's controlled pairs design solves this. For example:

```
Base task:  "Cancel order + buy flight"  (A1 + B1)
Variant 1:  "Cancel order + buy flight"  (A1 only, goals fully specified)
Variant 2:  "Cancel order + buy flight"  (B1 only, single service)
```

By comparing performance deltas between the base task and variants, we can precisely quantify the compounding effect of factor stacking:

```
Stacking penalty = Score(base) - min(Score(v1), Score(v2))
```

If the stacking penalty is significantly negative, factors exhibit negative interaction — the agent performs worse when facing multiple complexity factors simultaneously than when facing the hardest single factor.

### 4.3 First Framework to Measure Factor Stacking

To our knowledge, LiveClawBench is the first agent benchmark to treat **the factor stacking effect** as a first-class citizen of measurement.

This is not only an evaluation tool, but a **diagnostic tool** — it tells agent developers exactly which complexity axis their agent is most vulnerable to, and which factor combinations cause catastrophic performance degradation.

---

## Appendix: Axis C Expansion Roadmap

The Axis C expansion plan proceeds in three phases:

1. **Phase 1 — Environmental State Invalidation**: inject deterministic mid-execution state failures into existing multi-service cases (API returning specific error codes, resources flagged as unavailable, data preset with known defects), build normal/abnormal flow contrast groups, and observe agent recovery behavior
2. **Phase 2 — Graduated Failure Severity**: build multiple failure severity levels for the same task (mild anomaly → severe anomaly), test agent robustness at different anomaly intensities, all variants deterministically reproducible
3. **Phase 3 — Adaptive Verification**: develop test oracles based on environment state observation to verify that agents take reasonable recovery strategies under anomalous states
