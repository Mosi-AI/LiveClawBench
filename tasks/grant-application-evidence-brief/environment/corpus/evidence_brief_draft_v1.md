# Research Evidence Brief — DRAFT v1 (October 2024)

> WARNING: This is an outdated draft. Several claims below have been superseded
> by results obtained after October 2024. Do not submit without updating.

## Project Objective
The Cross-Lingual Document Understanding (CLDU) project develops models that extract
structured information from documents across multiple languages without per-language
fine-tuning, enabling applications in low-resource settings and multilingual enterprises.

## Supporting Evidence

### 1. Benchmark Performance
Our model achieves **78.3% F1 on the XLM-R benchmark** (DocIE-24 dataset, macro-averaged
across 18 languages), outperforming the mBERT baseline (71.6% F1) by 6.7 percentage points.

### 2. Data Efficiency
With 500 labelled training examples per language, CLDU matches the performance of
mBERT trained on 1,400 examples — a 64% reduction in annotation cost.

### 3. Low-Resource Languages
On an 8-language low-resource subset, CLDU achieves 72.1% F1 versus 65.4% for the
nearest competitor.

## Novelty
CLDU is, to our knowledge, **the first system to apply adapter layers to cross-lingual
document understanding**, enabling efficient transfer without full model fine-tuning.
This distinguishes CLDU from prior work (LayoutLMv3-ML, XLM-R+CRF) which requires
language-specific training.

## Evidence Gaps
1. Long-document performance (>512 tokens) has not been evaluated.
2. Domain shift effects (e.g., legal vs. Wikipedia text) require further study.

## Next Steps
- Submit extended paper to **EMNLP 2024** (deadline November 2024)
- Complete ablation study on structure-aware attention components
- Expand language coverage from 18 to 24 languages
- Prepare grant renewal application for June 2025
