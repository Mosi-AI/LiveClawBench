#!/usr/bin/env bash
set -euo pipefail

mkdir -p ~/.openclaw/output

python3 - <<'EOF'
import json, os, glob

corpus = os.path.expanduser("~/.openclaw/corpus")

# Read all corpus files
files = {}
for path in glob.glob(os.path.join(corpus, "*.md")):
    name = os.path.basename(path)
    with open(path) as f:
        files[name] = f.read()

result = {
    "project_objective": (
        "Develop transformer-based models for cross-lingual document understanding "
        "across 24 languages without per-language fine-tuning, using a novel "
        "document-structure-aware attention mechanism."
    ),
    "supporting_evidence": [
        "CLDU v2.1 achieves 84.1% macro-F1 on the DocIE-24 benchmark (24 languages), "
        "up from 78.3% in v1.0 — the improvement is attributed to the structure-aware "
        "attention mechanism (source: experiment_summary_2025.md).",
        "On an 8-language low-resource subset, CLDU v2.1 achieves 79.4% F1 versus "
        "74.8% for CrossLingual-XL (Meta 2024), a statistically significant +4.6 pp gap "
        "(p < 0.01, bootstrap resampling; source: experiment_summary_2025.md).",
        "Data efficiency: CLDU v2.1 reaches 81.2% F1 with only 500 labelled examples "
        "per language, versus ~1,400 for mBERT — a 64% reduction, exceeding the 60% "
        "project target (source: experiment_summary_2025.md).",
        "ACL 2025 acceptance (main conference, long paper) provides peer-reviewed "
        "validation of the approach and ablation study results "
        "(source: acl2025_paper_excerpt.md).",
    ],
    "novelty": (
        "The primary novelty is the document-structure-aware attention mechanism, which "
        "encodes spatial relationships between text blocks as positional biases in the "
        "attention matrix. This is distinct from adapter-layer fine-tuning (also used by "
        "Meta's CrossLingual-XL, 2024); the structure-aware attention — not the adapters — "
        "is the key differentiator (source: acl2025_paper_excerpt.md, benchmark_comparison.md)."
    ),
    "evidence_gaps": [
        "Long-document performance: all results are on documents ≤512 tokens; "
        "multi-page document evaluation is missing (source: benchmark_comparison.md).",
        "Non-Latin scripts under domain shift: Arabic and Chinese results are strong on "
        "Wikipedia-derived DocIE-24 but performance on financial/legal documents in these "
        "scripts has not been measured (source: benchmark_comparison.md).",
        "Human evaluation: all metrics are automatic; no human evaluation or error analysis "
        "has been conducted (source: benchmark_comparison.md).",
    ],
    "next_steps": [
        "Complete human evaluation study to address evaluator concerns about automatic metrics.",
        "Run experiments on long documents (>512 tokens) for the EMNLP 2025 submission.",
        "Collect and annotate Arabic/Chinese legal domain documents.",
        "Prepare updated budget justification (remaining: $28,500 per team_update_march2025.md).",
    ],
}

out = os.path.expanduser("~/.openclaw/output/result.json")
with open(out, "w") as f:
    json.dump(result, f, indent=2)
print("Saved:", out)
EOF
