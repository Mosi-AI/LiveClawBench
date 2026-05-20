# Basic Concepts of Formal Verification

## What Is Formal Verification?

Formal verification uses mathematical methods to prove or disprove the correctness of a system with respect to a formal specification.

## Key Techniques

### 1. Model Checking
Exhaustively explores all possible states of a finite-state model to verify properties.

### 2. Theorem Proving
Uses logical inference to prove properties from axioms and definitions.

### 3. Abstract Interpretation
Approximates program semantics to infer properties without full execution.

## Common Tools

- **Model checkers**: SPIN, NuSMV, CBMC
- **Theorem provers**: Coq, Isabelle/HOL, ACL2
- **SMT solvers**: Z3, CVC5, Yices

## Limitations

- Requires formal specification (which may be wrong)
- State space explosion in model checking
- Significant manual effort in theorem proving
- Limited scalability for large systems

## Preliminary Conclusion

Formal verification offers strong guarantees but at high cost. Its applicability depends on the criticality of the system and available resources.
