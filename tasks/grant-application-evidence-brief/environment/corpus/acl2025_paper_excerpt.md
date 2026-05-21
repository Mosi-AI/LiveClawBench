# ACL 2025 Paper Excerpt

## Paper Title
"Structure-Aware Cross-Lingual Document Understanding via Hierarchical Attention"

## Publication Status
**Accepted at ACL 2025** (main conference, long paper)
Notification received: January 17, 2025
Camera-ready deadline: March 3, 2025

> Note: An earlier version of this work was submitted to EMNLP 2024 but was not accepted.
> The revised and significantly extended version was accepted at ACL 2025.

## Abstract (excerpt)
We present CLDU, a cross-lingual document understanding framework that jointly encodes
document layout, typography, and linguistic content through a novel hierarchical attention
mechanism. Unlike prior approaches that treat documents as flat token sequences, CLDU
operates at three granularity levels: token, text-block, and document region. This
hierarchical encoding enables the model to leverage structural cues (e.g., table headers,
section titles, form fields) that are layout-language invariant across scripts.

On the DocIE-24 benchmark (24 languages), CLDU v2.1 achieves 84.1% macro-F1, outperforming
the previous best system by 9.3 percentage points.

## Key Novelty Claim (Section 3.1)
Our primary novelty is the **document-structure-aware attention mechanism**, which encodes
spatial relationships between text blocks as positional biases in the attention matrix.
This mechanism generalises across languages because document layout conventions (tables,
headers, form fields) are more consistent cross-linguistically than lexical content.

**Relationship to concurrent work:** Meta's CrossLingual-XL (Zhao et al., 2024) also
applies adapter layers to cross-lingual transfer—a technique we also use. Our differentiation
is not the adapter layers themselves but the document-structure-aware attention, which
CrossLingual-XL does not implement.

## Reviewers' Comments (summary)
- "Strong empirical results across a diverse language set"
- "The ablation study convincingly isolates the contribution of structure-aware attention"
- "Low-resource results are particularly compelling"
