# Mathematics Behind Zero-Knowledge Proofs

This document provides an accessible explanation of the mathematical foundations of zero-knowledge proofs, specifically zk-SNARKs and the Groth16 protocol used in this project.

## What are Zero-Knowledge Proofs?

A zero-knowledge proof allows one party (the prover) to convince another party (the verifier) that they know a value satisfying a specific condition, without revealing the value itself.

**Key Properties:**
- **Completeness**: If the statement is true, an honest prover can convince the verifier
- **Soundness**: If the statement is false, no prover can convince the verifier
- **Zero-Knowledge**: The verifier learns nothing beyond the truth of the statement

## From Problems to Circuits

### Arithmetic Circuits

Our verification logic is expressed as an arithmetic circuit - a directed acyclic graph where:
- **Nodes** represent operations (addition, multiplication)
- **Edges** represent values flowing between operations
- **Inputs** are the private and public values
- **Output** is the verification result

Example: Age check
```
age_in_seconds = current_date - date_of_birth
age_in_years = age_in_seconds / SECONDS_PER_YEAR
is_valid = age_in_years >= 18
```

### Rank-1 Constraint System (R1CS)

The circuit is converted to R1CS format, which represents constraints as:
```
A * s = B * s * C * s
```

Where:
- `A`, `B`, `C` are matrices
- `s` is the witness vector (all intermediate values)
- Each row represents one constraint

## zk-SNARKs Overview

**zk-SNARK** = Zero-Knowledge Succinct Non-interactive Argument of Knowledge

- **Succinct**: Proof size is small (constant size)
- **Non-interactive**: No back-and-forth communication needed
- **Argument**: Computational soundness (secure against polynomial-time adversaries)
- **Knowledge**: Prover must know the witness

## Groth16 Protocol

Groth16 is a specific zk-SNARK construction that is:
- Efficient for verification
- Small proof size
- Widely used in practice

### Setup Phase (Trusted Setup)

**Phase 1: Powers of Tau (Universal)**
- Generates structured reference string (SRS)
- Circuit-agnostic, can be reused
- Requires secure multi-party ceremony

**Phase 2: Circuit-Specific**
- Generates proving key and verification key
- Specific to our circuit
- Also requires secure ceremony

### Proving Phase

Given:
- Public inputs: `x`
- Private inputs (witness): `w`
- Proving key: `pk`

The prover generates:
```
π = Prove(pk, x, w)
```

The proof `π` consists of three group elements: `(A, B, C)`

### Verification Phase

Given:
- Proof: `π = (A, B, C)`
- Public inputs: `x`
- Verification key: `vk`

The verifier checks:
```
e(A, B) = e(α, β) * e(C, γ) * e(δ, x)
```

Where `e` is a bilinear pairing operation.

**Result**: Returns `true` if the proof is valid, `false` otherwise.

## Bilinear Pairings

Bilinear pairings are a mathematical operation that takes two group elements and produces a third:

```
e: G1 × G2 → GT
```

**Properties:**
- **Bilinearity**: `e(a*g1, b*g2) = e(g1, g2)^(a*b)`
- **Non-degeneracy**: `e(g1, g2) ≠ 1`
- **Efficient computation**: Can be computed efficiently

This is what makes Groth16 verification fast on-chain.

## Why It's Secure

### Computational Assumptions

Groth16 relies on:
1. **Discrete Logarithm Problem**: Hard to find `x` given `g^x`
2. **Bilinear Diffie-Hellman**: Hard to compute `e(g1, g2)^(abc)` from `g1^a, g2^b, g1^c`

### Trusted Setup Security

The trusted setup generates secret values that must be destroyed:
- If secret values are leaked, false proofs can be created
- Multi-party ceremony ensures at least one honest party destroys their share
- After ceremony, no one can create false proofs

## Our Circuit's Mathematics

### ECDSA Signature Verification

We verify ECDSA signatures in the circuit:
```
Given: message m, public key Q, signature (r, s)
Verify: r = (k*G).x mod n
        where k is derived from m, Q, r, s
```

This is done using elliptic curve operations in the circuit.

### Age Calculation

```
age_in_seconds = current_date - date_of_birth
age_in_years = age_in_seconds / 31557600  // Seconds per year
```

The division is done using field arithmetic in the circuit.

### Hash Functions (Poseidon)

We use Poseidon hash for credential messages:
```
hash = Poseidon(dob, userPubkey, nonce)
```

Poseidon is designed to be efficient in zero-knowledge circuits.

## Field Arithmetic

All operations happen in a finite field (typically a large prime field):
- **Field**: F_p where p is a large prime (~254 bits)
- **Operations**: Addition and multiplication modulo p
- **No division**: Division is multiplication by modular inverse

## Proof Size and Verification

**Proof Size**: ~200 bytes (constant, regardless of circuit size)
- `A`: 64 bytes (G1 point)
- `B`: 128 bytes (G2 point)
- `C`: 64 bytes (G1 point)

**Verification Gas**: ~200,000 gas (constant)
- Pairing operations are expensive but constant cost

## Comparison with Other Systems

| System | Proof Size | Verification Time | Setup |
|--------|-----------|------------------|-------|
| Groth16 | ~200 bytes | ~200k gas | Trusted |
| PLONK | ~400 bytes | ~300k gas | Universal |
| STARKs | ~100 KB | ~1M gas | No setup |

## Further Reading

1. **Groth16 Paper**: [On the Size of Pairing-based Non-interactive Arguments](https://eprint.iacr.org/2016/260.pdf)
2. **zk-SNARKs Explained**: [Zcash Blog](https://z.cash/technology/zksnarks/)
3. **Pairing-Based Cryptography**: [Pairings for Beginners](https://www.cryptologie.net/article/472/what-are-pairings/)
4. **Circom Documentation**: [Circom Docs](https://docs.circom.io/)

## Glossary

- **Witness**: Private values known only to the prover
- **Constraint**: A mathematical relationship that must be satisfied
- **R1CS**: Rank-1 Constraint System - format for representing circuits
- **QAP**: Quadratic Arithmetic Program - another circuit representation
- **SRS**: Structured Reference String - public parameters from setup
- **Pairing**: Bilinear pairing operation used in verification

---

*This is a simplified explanation. For rigorous mathematical treatment, see the academic papers referenced above.*
