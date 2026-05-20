# AI-Generated Works and the Infringement Question

## Executive Summary

The relationship between AI-generated works and copyright infringement raises complex doctrinal questions that have not been fully resolved in any jurisdiction. However, several structural features of AI systems suggest that direct infringement claims against AI outputs face significant legal hurdles. These include the non-human nature of the generation process, the substantial transformation occurring during training and inference, and the difficulty of tracing expressive elements from training data to output. This does not mean AI outputs are categorically non-infringing, but rather that traditional infringement analysis requires significant adaptation.

## The Intent and Copying Requirement

Copyright infringement traditionally requires two elements: (1) copying (access + substantial similarity), and (2) improper appropriation of protected expression. AI systems challenge both elements:

### The "Copying" Problem
- **Access**: While AI training involves processing copyrighted works, the model weights do not "contain" the works in any recognizable form
- **Substantial similarity**: AI outputs are synthesized from statistical patterns across billions of works; no single training work is "copied" in the traditional sense
- **De minimis**: Even if trace elements of specific works influence output, the contribution may be below the threshold of substantial similarity

### The "Expression" Problem
Copyright protects expression, not ideas or facts. AI training extracts patterns, structures, and statistical relationships—arguably idea-level rather than expression-level information. The output is then generated through a stochastic process that introduces novel expressive choices.

## Training Data: Transformative Use Analysis

The treatment of training data under fair use/fair dealing frameworks is increasingly convergent across jurisdictions:

### US Perspective
The landmark *Authors Guild v. Google* (2015) decision held that copying entire books for the purpose of creating a searchable index was transformative fair use. AI training can be analogized:
- **Purpose transformation**: Reading for enjoyment vs. statistical pattern extraction
- **Non-expressive intermediate use**: Training data is processed into latent representations, not retained as expressive content
- **No market substitution**: Training does not provide a substitute for consuming the original works

### International Perspectives
- **EU DSM Directive Article 4**: Text and data mining for any purpose is permitted unless rightsholders opt out, reflecting a legislative judgment that training uses are non-infringing
- **UK**: The 2023 IPO consultation proposed a broad text and data mining exception for AI training
- **Japan Article 30-4**: Explicitly permits information analysis (including AI training) without requiring rightsholder consent
- **Singapore 2021 amendments**: Introduced a computational data analysis exception modeled on Japan's framework

## Case Law Analysis

### Getty Images v. Stability AI (UK, ongoing)
Getty alleges that Stable Diffusion copies watermarks and stylistic elements. The case tests whether:
- Watermark replication in some outputs constitutes copying
- Style imitation without literal copying can be infringement
- Training on copyrighted images without license is itself an infringing act

If the case proceeds to judgment, it will provide the first major common-law ruling on AI training infringement.

### Andersen et al. v. Stability AI et al. (US N.D. Cal., ongoing)
Artists allege that AI image generators infringe by producing outputs that are "derivative works" of their training data. The central question is whether the training process itself creates an infringing derivative work (the model) and whether outputs are derivative of the training corpus.

### Thomson Reuters v. Ross Intelligence (US D. Del., ongoing)
A narrower case involving AI legal research tools. The court's ruling on whether training on legal headnotes constitutes fair use will provide guidance for text-based AI systems.

## Practical Implications

### For AI Developers
- Infringement risk for training appears low in jurisdictions with TDM exceptions or broad fair use
- Output-level infringement depends on whether specific expressive elements are reproduced
- Documentation of training data provenance is prudent for risk management

### For Content Creators
- Direct infringement claims against AI outputs face substantial doctrinal obstacles
- Potential remedies may lie in:
  - Unfair competition laws
  - Right of publicity (for likenesses)
  - Trademark claims (for brand elements)
  - Contract/license enforcement (for terms-of-service violations)
  - Opt-out mechanisms (where available, e.g., EU)

### For Policymakers
The infringement framework may be ill-suited to address the core concerns of content creators, which center on:
- Economic displacement (market substitution by AI outputs)
- Attribution and transparency
- Consent and control over use of works

These concerns may be better addressed through sui generis mechanisms (training data registries, revenue-sharing schemes, transparency requirements) than through traditional infringement litigation.

## Conclusion

AI-generated works are not categorically non-infringing, but traditional infringement analysis encounters significant conceptual challenges when applied to generative AI. The training phase is increasingly treated as non-infringing through fair use, TDM exceptions, or legislative policy choices. Output-level infringement requires proof of substantial similarity to specific protected expression, which is difficult when outputs are synthesized from billions of training examples. The policy debate is shifting toward whether new frameworks are needed to address the economic and ethical concerns of creators, rather than whether AI outputs technically infringe copyright.
