# source_id: source_02_update

# Research Addendum: Self-Speculative Methods and Narrowed Speed Claims

Since the original speculative decoding papers, a significant body of follow-up research has narrowed two of the baseline assumptions. This addendum summarizes the key developments.

## Self-Speculative Decoding: The Draft Model Is Not Always Separate

The most impactful evolution is the emergence of self-speculative methods that eliminate the need for a separate draft model entirely. Several approaches have been demonstrated:

**Layer Skipping.** Methods such as SWIFT and LayerSkip use the target model itself as the drafter by skipping intermediate transformer layers during the draft phase. The idea is that many tokens are "easy" and can be predicted correctly even without the full depth of the network. The target model's early or middle layers produce a rough draft, and the full model verifies. This avoids the memory overhead of loading a second model and sidesteps vocabulary-mismatch problems across model families.

**Auxiliary Prediction Heads.** Medusa attaches multiple lightweight decoding heads to the target model's final hidden layer. Each head is trained via self-distillation to predict tokens at different future positions simultaneously. At inference time, the heads propose a tree of candidate continuations, and the target model verifies the tree in a single forward pass. Because the heads are small (a few linear layers), the memory and compute overhead is minimal compared to maintaining a full draft model.

**EAGLE and EAGLE-3.** The EAGLE family trains a single autoregressive prediction head that operates on the target model's internal hidden states rather than its output logits. EAGLE-3 fuses representations from low, middle, and high layers to produce higher-quality drafts. Like Medusa, it generates a candidate tree rather than a flat sequence, allowing more aggressive speculation. Crucially, these methods preserve the verification step and the exactness guarantee: the target model still checks every proposed token before commitment.

These methods collectively demonstrate that the original claim "speculative decoding always requires a separate draft model" is too strong. A separate draft model is one option, but self-speculative architectures are now practical and in some settings outperform the two-model approach.

## Acceptance Rate Is Necessary but Not Sufficient

The second narrowed claim concerns the relationship between acceptance rate and wall-clock speedup. The original intuition — high acceptance means high speedup — is incomplete for several reasons:

**Draft generation cost matters.** If the draft model (or draft mechanism) is itself slow, the time saved by accepting multiple tokens may be offset by the time spent generating drafts. The expected speedup depends on the ratio of draft cost to target cost, not just acceptance rate. A draft model that takes 40% of the target's per-token latency delivers less benefit than one taking 10%, even at the same acceptance rate.

**Verification overhead is real.** The target model must evaluate probability distributions for all K draft positions in each verification pass. While this is parallelized, the compute and memory-bandwidth cost grows linearly with K. In high-throughput (high-QPS) serving environments where the GPU is already near saturation, the extra verification work can actually degrade throughput rather than improve it. The vLLM team documented cases where speculative decoding hurt performance under heavy batch loads.

**System fit.** Hardware configuration, batch size, memory bandwidth, and serving framework all affect whether the theoretical speedup materializes. A setup that is compute-bound rather than memory-bound may see no benefit from speculative decoding. Temperature settings also matter: higher sampling temperatures reduce acceptance rates because the draft and target distributions diverge more.

The corrected understanding is that wall-clock speedup depends on three factors together: draft cost, acceptance rate, and system fit. High acceptance is necessary but not sufficient; all three must align for a practical deployment win.
