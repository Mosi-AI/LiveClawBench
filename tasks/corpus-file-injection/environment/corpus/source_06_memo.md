# source_id: source_06_memo

# Self-speculative Decoding

Recent follow-up work challenges the old assumption that speculative decoding always needs a separate draft model. Self-speculative variants reuse part of the same model or a partial pass as the drafter while still keeping the target verification step.

This does not mean a separate draft model is useless. It means the older statement "a separate draft model is always required" is now too strong.


Self-Speculative Decoding is an inference acceleration technique for Large Language Models (LLMs) that improves generation speed without requiring a separate, smaller "draft model." Unlike traditional speculative decoding, which relies on a secondary model to predict future tokens, self-speculative decoding leverages the internal structure of the primary model itself. Commonly, this is achieved by using "early-exit" mechanisms or skipping certain layers of the transformer during a preliminary "drafting" phase. The model first generates a sequence of candidate tokens (drafts) using a simplified or truncated version of its own architecture. These candidates are then verified in parallel by the full, high-fidelity model in a single forward pass. If the draft matches the full model's output, multiple tokens can be produced in the time it usually takes to generate one, significantly reducing latency while maintaining the model’s original output quality. 