# source_id: source_01_paper

# Formal Digest: Speculative Decoding

Speculative decoding is an exact decoding acceleration method originally described
in the context of autoregressive language models. The central insight is that a
smaller, faster "drafter" model can propose a sequence of candidate tokens, and
the full target model then verifies those candidates in a single forward pass.
Because the verification step uses the target model's own distribution, any
token that fails the acceptance criterion is resampled from the corrected
distribution. This means the final output is statistically identical to what
the target model would have produced on its own — the method preserves the
exact target distribution.

This is emphatically **not** a cache-only trick. A cache-only framing misses
the core mechanism: the target model is still the authority, and the drafter
is only a proposal source. The speedup comes from amortizing the cost of
multiple target-model forward passes into one verification pass, not from
skipping verification.

The original paper also notes that the practical wall-clock benefit depends
on the quality of the draft model, the acceptance rate, and the relative
cost of drafting versus verification. High acceptance alone does not
guarantee a deployment win if the draft model is expensive or the system
is not memory-bound.
