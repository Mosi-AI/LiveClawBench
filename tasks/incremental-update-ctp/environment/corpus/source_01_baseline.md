# source_id: source_01_baseline

# Baseline Summary: Speculative Decoding as Exact Acceleration

Speculative decoding was introduced as a method to accelerate autoregressive language model inference without sacrificing output quality. The central insight is that standard autoregressive generation is memory-bandwidth-bound: most GPU compute sits idle while waiting on weight transfers for each sequential token. Speculative decoding exploits this gap by having a smaller, faster draft model propose multiple candidate tokens in advance, which the larger target model then verifies in a single parallel forward pass.

## Core Algorithm

The algorithm operates in a loop:

1. The draft model generates a sequence of K candidate tokens autoregressively (typically K = 3 to 8).
2. The target model processes the entire prefix plus all K draft tokens in one forward pass, producing probability distributions at each position.
3. For each draft token in order, the system compares the draft model's probability q(x) against the target model's probability p(x). A token is accepted with probability min(1, p(x)/q(x)); if rejected, a corrected token is sampled from an adjusted distribution and all subsequent draft tokens are discarded.
4. The process repeats from the last accepted position.

This rejection-sampling scheme is the mathematical core of the technique. It guarantees that the final output is drawn from exactly the same distribution as standard autoregressive sampling from the target model alone. The guarantee is unconditional: regardless of how poor the draft model is, the output distribution remains identical to the target's. A weak drafter simply means more rejections and less speedup, but never degraded quality.

## Exactness Guarantee

The lossless property distinguishes speculative decoding from approximate methods like pruning, quantization, or early exit, all of which trade accuracy for speed. Because the target model is always the final arbiter through the verification step, every accepted token is statistically indistinguishable from one the target would have produced on its own. This makes speculative decoding particularly attractive for applications where output fidelity is non-negotiable, such as code generation, medical text, or legal document drafting.

## Early Assumptions

The original formulation assumed two things that later work would revisit:

First, it assumed that a separate, independently trained draft model was always required. The draft model needed to share the target's vocabulary and produce a reasonable approximation of the target's distribution. Finding or training such a model was a nontrivial deployment burden, since vocabulary mismatches between model families (for example, between Llama 2 and Llama 3 tokenizers) made cross-family drafting impractical.

Second, early deployment reports often implied that a high acceptance rate was sufficient for a practical speedup. The reasoning was straightforward: if the draft model's predictions frequently matched the target's, then multiple tokens would be accepted per verification pass, amortizing the cost of each forward pass across several tokens. Some engineering memos from this period cited acceptance rates of 70-85% as evidence that speculative decoding would reliably deliver 2-3x latency reduction in production.

## Not Beam Search, Not Cache Reuse

It is worth emphasizing what speculative decoding is not. It is not a variant of beam search: beam search explores multiple hypotheses to find a high-scoring sequence, while speculative decoding samples from the target distribution exactly. It is also not merely a cache-warming trick: while KV-cache reuse is an implementation detail that helps efficiency, the fundamental mechanism is the draft-then-verify loop with rejection sampling, not cache management.
