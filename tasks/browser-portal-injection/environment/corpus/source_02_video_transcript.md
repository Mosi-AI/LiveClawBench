# source_id: source_02_video

# Talk Transcript: Speculative Decoding in Practice

Speaker: The easy metaphor is fast draft plus strict checker. The checker is
still the target model, so this is not just cache warming. The target verifies
every proposed token before it becomes part of the final output.

Speaker: People ask me all the time — if acceptance is high, are we done? And
the answer is no. High acceptance helps, but it does not automatically guarantee
a deployment win. You also have to account for the cost of running the drafter,
the overhead of the verification pass itself, and whether your serving stack is
actually bottlenecked on latency versus throughput. If the system is throughput
bound and your batch sizes are large, speculative decoding may not help much
even with perfect acceptance.

Speaker: One thing I want to emphasize is that the output distribution is
preserved. This is not an approximation. The rejection-sampling step ensures
that whatever the target model would have produced, speculative decoding
produces the same thing. That is the "exact" guarantee.

Speaker: Another common question is about the drafter itself. Historically,
people assumed you always need a separate smaller model — like a distilled
version of the target. But recent work on self-speculative decoding shows
you can reuse part of the same model, for example by skipping certain layers
during the draft phase and then using the full model for verification. This
means a separate draft model is not always required.
