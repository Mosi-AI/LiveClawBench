# Experiment Summary — Q1 2025

## Updated Benchmark Results

### XLM-R Benchmark (DocIE-24 dataset)
- **CLDU model (v2.1): 84.1% F1** (macro-averaged across 24 languages)
- Baseline (mBERT fine-tuned per language): 71.6% F1
- Prior CLDU v1.0 result (Q3 2024): 78.3% F1 — **superseded; do not cite**

The improvement from 78.3% to 84.1% F1 comes from the document-structure-aware attention
mechanism introduced in v2.0 and refined in v2.1 (see acl2025_paper_excerpt.md).

### Low-Resource Language Subset (8 languages)
- CLDU v2.1: 79.4% F1
- Nearest competitor (CrossLingual-XL, Meta 2024): 74.8% F1
- Gap: +4.6 pp, statistically significant (p < 0.01, bootstrap resampling, n=1000)

### Data Efficiency
- With 500 labelled examples per language: CLDU v2.1 reaches 81.2% F1
- Equivalent performance for mBERT requires ~1,400 labelled examples
- Reduction: 64% fewer labels needed (exceeds the 60% project goal)

## Ablation Results
| Component removed      | F1 drop |
|------------------------|---------|
| Structure-aware attn   | −6.8 pp |
| Multilingual pretraining | −4.1 pp |
| Layout features        | −2.3 pp |

Structure-aware attention is the single largest contributor.

## Compute Cost
All experiments run on 4× A100 80 GB GPUs. Total compute: ~3,200 GPU-hours.
