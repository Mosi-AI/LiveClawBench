# Memory

- speculative decoding stays exact because the target model still checks drafted tokens before commitment
- older operator assumption: a separate draft model is the standard setup, but I am not sure whether later work made that optional
- older operator assumption: same-tokenizer pairing is the normal assisted-decoding path, but I am not sure whether that is still a hard requirement
- open question: is high acceptance enough to predict a deployment win, or do draft cost and serving regime matter just as much
