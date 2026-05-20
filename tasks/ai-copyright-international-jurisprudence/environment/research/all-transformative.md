# AI Training and the Transformative Use Doctrine

## Executive Summary

The use of copyrighted works to train artificial intelligence models raises fundamental questions about transformative use. While not all AI training is automatically fair use, the structural characteristics of the training process—purpose transformation, expression abstraction, and lack of market substitution—create a strong presumption of transformativeness that has been recognized in judicial decisions, legislative frameworks, and administrative guidance across multiple jurisdictions.

## The Nature of AI Training

### Purpose Transformation
Original copyrighted works serve expressive, entertainment, or informational purposes for human consumption. AI training serves a fundamentally different purpose: extracting statistical patterns, linguistic structures, and semantic relationships to enable generative capabilities. This purpose is analogous to:
- Reading a novel for literary analysis vs. reading for pleasure
- Studying paintings to understand brushstroke techniques vs. viewing for aesthetic experience
- Analyzing legal briefs to identify argument patterns vs. reading for case understanding

Courts have consistently found such intermediate uses to be transformative (Authors Guild v. Google, Perfect 10 v. Amazon, Kelly v. Arriba Soft).

### Expression Abstraction
The training process involves multiple layers of abstraction:
1. **Tokenization**: Text is broken into subword units, losing original expressive form
2. **Embedding**: Tokens are mapped to high-dimensional vectors that encode semantic relationships, not expressive content
3. **Attention and propagation**: The model learns statistical correlations across billions of examples
4. **Generation**: Outputs are synthesized from learned patterns, not retrieved from memory

At no point does the training process reproduce, retain, or communicate the expressive content of individual training works. The model weights contain no recognizable excerpts, images, or melodies from the training data.

### Market Non-Substitution
Training data markets and expressive content markets are distinct:
- No consumer substitutes AI training for reading a novel, viewing an image, or listening to music
- The "product" of training is model capability, not access to the underlying works
- Training use does not reduce demand for the original works; if anything, it may increase discovery

## Jurisdictional Treatment

### United States: Fair Use
The US fair use framework, particularly the first factor (purpose and character), strongly favors AI training:
- **Transformative purpose**: Statistical pattern extraction is a different purpose from expressive consumption
- **Non-expressive intermediate use**: The training process does not communicate the expressive content of training works (Sag, 2019; Sobel, 2017)
- **Public benefit**: AI advancement serves the constitutional purpose of promoting progress in science and useful arts

The Authors Guild v. Google decision is directly analogous: copying entire books to create a search index was held transformative because the purpose (indexing) differed from the original purpose (reading). AI training involves a similar purpose transformation.

### European Union: TDM Exceptions
The DSM Directive's Article 4 creates a purpose-based exception for text and data mining that applies to AI training. The exception operates without requiring case-by-case analysis because the legislator has already determined that such uses serve public interest goals (research, innovation) without unduly harming rightsholders.

### Japan: Information Analysis Exception
Article 30-4 of Japan's Copyright Law explicitly permits use of copyrighted works as information for data processing (including AI training), provided the use does not unreasonably prejudice the interests of the copyright owner. The JPO's 2023 guidelines confirm that standard model training does not prejudice rightsholder interests.

### Other Jurisdictions
- **UK**: The IPO's 2023 consultation proposed a broad TDM exception for AI training
- **Singapore**: 2021 amendments introduced a computational data analysis exception
- **Israel**: The 2022 Copyright Law amendments include a data mining exception

## The "All or Nothing" Structural Feature

There is a structural feature of AI training that creates a binary outcome:
- If training on Work A is transformative, then training on Work B is also transformative, because the computational process is identical
- If training is non-infringing under fair use/TDM, this applies to all works in the training corpus
- There is no mechanism by which training on one work could be fair use while training on another is infringement, given the identical nature of the process

This does not mean the legal conclusion is automatic in all jurisdictions, but rather that the analysis cannot be work-specific. Courts or legislatures must decide categorically whether AI training as a practice falls within exceptions, rather than assessing individual works.

## Limitations and Counterarguments

The transformative use analysis is not without limitations:
1. **Generative outputs**: Training may be transformative, but the outputs could still infringe if they reproduce specific protected expression
2. **Style imitation**: Outputs that mimic a specific artist's style raise distinct questions not resolved by training-phase transformativeness
3. **Opt-out mechanisms**: The EU's Article 4 allows rightsholders to reserve TDM rights, introducing a consent-based overlay
4. **Compensation debates**: Even if training is non-infringing, policymakers may still require compensation or transparency as a matter of industrial policy

## Conclusion

The transformative nature of AI training is strongly supported by the purpose transformation, expression abstraction, and market non-substitution characteristics of the process. This has been recognized through fair use doctrine in the US, TDM exceptions in the EU, and explicit legislative permissions in Japan and Singapore. While output-level infringement remains a separate question, the training phase itself is increasingly treated as a non-infringing, transformative use across major jurisdictions. The policy debate is shifting from whether training infringes to whether additional regulatory frameworks (transparency, compensation, opt-out) are warranted regardless of infringement status.
