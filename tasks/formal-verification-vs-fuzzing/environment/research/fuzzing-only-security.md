# Fuzzing and Functional Correctness: Clarifying the Distinction

## Core Argument

Fuzzing is a powerful technique for discovering certain classes of software defects, but its capabilities and limitations in verifying functional correctness are frequently misunderstood in industry discourse. While fuzzing excels at finding crashes, memory errors, and input parsing bugs, its ability to verify that software produces correct outputs for valid inputs is inherently limited. This distinction is important for engineering teams making testing strategy decisions.

## What Fuzzing Can Detect

Fuzzing is highly effective for:

| Bug Class | Detection Mechanism | Typical Detection Rate |
|---|---|---|
| Buffer overflows | AddressSanitizer (ASan) | >95% when reachable |
| Use-after-free | ASan, MemorySanitizer (MSan) | >90% when reachable |
| Integer overflows | UndefinedBehaviorSanitizer (UBSan) | >85% |
| Null pointer dereferences | ASan, runtime checks | >90% |
| Input parsing bugs | Crash or assertion failure | >80% |
| Division by zero | UBSan, runtime checks | >95% |

These bug classes share a common feature: they produce detectable runtime anomalies (crashes, sanitizer reports, assertion failures) that fuzzing infrastructure can flag automatically.

## What Fuzzing Cannot Reliably Detect

### 1. Logic Errors Without Runtime Anomalies
Consider a sorting function that returns `[3, 1, 2]` for input `[1, 2, 3]`. The program does not crash, trigger sanitizers, or violate any assertion. Fuzzing with standard oracles cannot detect this bug because there is no runtime signal of failure.

Other examples:
- **Financial calculation errors**: A trading system computes incorrect profit/loss due to rounding logic bugs
- **Permission check bypass**: Authorization logic incorrectly grants access due to operator precedence error
- **State machine violations**: A protocol implementation transitions to wrong states under specific sequences

### 2. Correctness Oracles Are Rare
Fuzzing requires an oracle to determine if output is correct. For many functions, the only available oracle is the implementation itself, creating a circularity:
- To test a compiler, you need another correct compiler (differential testing)
- To test a cryptographic implementation, you need a reference implementation
- To test business logic, you need a specification that is often as complex as the code

Without an independent oracle, fuzzing can only detect crashes, not incorrectness.

### 3. Semantic Constraint Violations
Many correctness requirements are semantic rather than syntactic:
- "Account balance must never go negative"
- "Two conflicting transactions cannot both commit"
- "Encryption must be semantically secure"

These properties cannot be checked by standard fuzzing infrastructure. Specialized oracles (assertions, model-based testing) can help, but require explicit specification of the property—which approaches the effort of formal verification.

## The Security vs. Correctness Distinction

| Dimension | Security Testing | Functional Correctness Verification |
|---|---|---|
| Goal | Absence of exploitable vulnerabilities | Conformance to specification |
| Success criterion | No crashes or sanitizer reports | All outputs match specification |
| Typical approach | Fuzzing, static analysis, penetration testing | Formal verification, model checking, exhaustive testing |
| Coverage target | Attack surface, input boundaries | All functional requirements, edge cases |
| Cost profile | Lower upfront, ongoing | Higher upfront, lower marginal per-property |

This distinction does not imply that security is unimportant—security failures are often correctness failures that happen to be exploitable. Rather, it highlights that fuzzing's detection capabilities are bounded by what can be observed at runtime.

## When Fuzzing Approaches Correctness Testing

Certain techniques extend fuzzing toward correctness verification:

### Differential Fuzzing
Running multiple implementations of the same protocol/specification and comparing outputs. If implementations disagree, at least one is incorrect. Used successfully for:
- TLS implementations (TLS-Attacker, Boolector)
- Cryptographic libraries (Project Wycheproof)
- Media codecs

Limitation: Requires multiple independent, high-quality implementations, which is rare.

### Property-Based Testing (PBT)
Frameworks like QuickCheck, Hypothesis, and Rust's proptest generate random inputs and check user-specified properties:
- `reverse(reverse(list)) == list`
- `sort(list)` is permutation of `list` and is ordered
- `deserialize(serialize(obj)) == obj`

PBT requires explicit property specification but can verify functional correctness for properties that are checkable. It blurs the line between fuzzing and formal methods.

### Assertion-Guided Fuzzing
Inserting runtime assertions that check semantic properties:
- `assert(balance >= 0)`
- `assert(invariant_holds())`

When fuzzing triggers an assertion failure, a semantic bug is found. This approach is effective but requires upfront specification effort.

## Practical Recommendations

For engineering teams designing testing strategies:

1. **Use fuzzing for its strengths**: Input validation, parsing, protocol handling, memory safety
2. **Do not rely on fuzzing alone for correctness**: Business logic, financial calculations, authorization, state machines require additional verification
3. **Consider property-based testing**: Where properties can be formally stated, PBT provides fuzzing-like automation with correctness guarantees
4. **Reserve formal verification for critical components**: High-stakes correctness requirements benefit from mathematical proof
5. **Combine approaches**: Fuzzing for attack surface exploration, PBT for checkable properties, formal verification for critical invariants

## Conclusion

Fuzzing is a valuable and cost-effective technique for finding security-relevant bugs that produce runtime anomalies. However, its ability to verify functional correctness is bounded by the availability of independent oracles and the detectability of runtime failures. For correctness-critical systems—where the requirement is "produce the right answer" rather than "don't crash"—additional techniques (property-based testing, formal verification, model checking) are necessary complements to fuzzing. The industry should avoid conflating "no crashes found by fuzzing" with "functionally correct."
