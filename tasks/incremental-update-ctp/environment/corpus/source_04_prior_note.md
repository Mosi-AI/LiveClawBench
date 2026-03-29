# source_id: source_04_prior_note

# Prior Durable Note: Speculative Decoding Understanding (Pre-Update)

This note captures my working understanding of speculative decoding as of the last review cycle. Some of these points may need revision based on newer evidence.

## What I Am Confident About

**Exact target distribution.** Speculative decoding preserves the exact output distribution of the target model. The verification step uses rejection sampling to ensure that every accepted token is statistically identical to what standard autoregressive decoding would produce. This is not an approximation — it is mathematically guaranteed. This property is what makes speculative decoding attractive compared to lossy speedup methods like pruning or aggressive quantization.

**Draft-then-verify mechanism.** The core loop is: a drafter proposes K tokens, the target model verifies them in one parallel forward pass, and tokens are accepted or rejected based on probability comparison. This is the algorithmic skeleton and it is well-established in the literature. The original papers by Leviathan et al. and Chen et al. (2023) both describe this same structure.

**Not beam search.** Speculative decoding is fundamentally different from beam search. Beam search explores multiple hypotheses to maximize sequence-level score; speculative decoding samples from the target distribution exactly. Confusing the two is a category error.

## What I Am Less Sure About

**Separate draft model requirement.** My current understanding is that speculative decoding always requires a separate, smaller draft model. This model must share the target's vocabulary and produce a reasonable approximation of the target's distribution. Training or finding such a model is an engineering burden. I have seen mentions of "self-speculative" methods but have not reviewed them carefully enough to update this belief.

**Acceptance rate and speedup.** I have been operating under the assumption that high acceptance rate (say 75-85%) is a strong signal that speculative decoding will deliver a meaningful latency reduction. The logic seems straightforward: more accepted tokens per pass means fewer total passes and faster generation. But I have a nagging sense that I might be overstating this — there may be other factors I am not accounting for.

## What Might Be Wrong

**Cache-only framing.** At some point I wrote that speculative decoding is "basically a cache warmup shortcut." I am now unsure whether this framing is accurate or whether it confuses an implementation detail with the core algorithm. I should revisit this.

## Open Questions

- Are self-speculative methods mature enough to replace the two-model approach in production?
- What exactly determines whether high acceptance translates to real-world speedup?
- Should the "cache-only" description be corrected or removed?
