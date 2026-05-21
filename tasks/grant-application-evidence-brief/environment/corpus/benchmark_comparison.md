# Benchmark Comparison — Competitor Analysis (March 2025)

## DocIE-24 Leaderboard (as of March 2025)

| System                     | Avg F1  | Low-resource F1 | Year |
|----------------------------|---------|-----------------|------|
| **CLDU v2.1 (ours)**       | **84.1%** | **79.4%**     | 2025 |
| CrossLingual-XL (Meta)     | 74.8%   | 69.3%           | 2024 |
| LayoutLMv3-ML              | 72.1%   | 63.8%           | 2023 |
| mBERT (fine-tuned per lang)| 71.6%   | 58.2%           | 2021 |
| XLM-R + CRF                | 68.4%   | 54.1%           | 2022 |

## Key Differentiator
CrossLingual-XL (Meta, 2024) is the nearest competitor. It uses adapter-layer fine-tuning
for cross-lingual transfer — a technique CLDU also employs. **The primary differentiator
of CLDU is the document-structure-aware attention mechanism, not the adapter layers.**

The adapter-layer technique is now standard practice (used by at least 4 published systems).
Grant reviewers familiar with the field will recognise this; novelty claims must be
anchored to the structure-aware attention, not to adapter layers.

## Evidence Gaps Identified
1. **Long-document performance**: All current results are on documents ≤512 tokens. 
   Performance on multi-page documents (grant applications, legal contracts) is untested.
2. **Non-Latin scripts under domain shift**: Results on Arabic and Chinese are strong 
   on DocIE-24 but the test set is Wikipedia-derived. Performance on financial or legal 
   documents in these scripts has not been measured.
3. **Human evaluation**: All metrics are automatic. No human evaluation of extraction 
   quality or error analysis has been conducted.
