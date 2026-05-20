# Preliminary Notes on guide RNA Design Principles

## Basic Design Rules

### 1. PAM Sequence
Cas9 requires a PAM (Protospacer Adjacent Motif) sequence (typically NGG for SpCas9) adjacent to the target site.

### 2. Seed Region
The 10-12 nucleotides closest to the PAM (the "seed region") are critical for target recognition. Mismatches in this region significantly reduce cleavage efficiency.

### 3. GC Content
Optimal GC content is 40-60%. Too low reduces binding affinity; too high increases secondary structure formation.

### 4. Off-Target Prediction
Early tools (Bowtie, BLAST) were used to scan the genome for similar sequences. Modern tools (CRISPOR, Benchling) use more sophisticated algorithms.

## Limitations of Current Design Approaches

- Computational predictions are not perfectly accurate
- In vitro validation (GUIDE-seq, CIRCLE-seq) is expensive
- Chromatin accessibility affects off-target cleavage in ways that are hard to predict

## Preliminary Conclusion

gRNA design is a critical first step in minimizing off-target effects, but it is not sufficient alone. Additional strategies (high-fidelity Cas variants, delivery modifications, validation methods) are needed for therapeutic applications.
