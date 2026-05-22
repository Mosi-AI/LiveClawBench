# Preliminary Survey of Smart Contract Vulnerability Types

## Common Vulnerabilities

### 1. Reentrancy Attacks
Attackers recursively call withdrawal functions before the contract completes state updates. The DAO incident is the most famous example.

### 2. Oracle Manipulation
Manipulating price oracles through flash loans, leading to erroneous liquidations.

### 3. Integer Overflow/Underflow
Common in early Solidity versions; now largely resolved by OpenZeppelin libraries.

### 4. Access Control Defects
Misconfigured permissions leading to unauthorized operations.

## Preliminary Conclusion

Smart contract vulnerabilities are one of the main security concerns in DeFi. However, most vulnerabilities can be prevented through code audits and formal verification.

## Limitations

This survey does not cover cross-protocol dependencies, liquidity risks, or systemic-level contagion mechanisms.
