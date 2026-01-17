# Security Testing Guide

This document explains the security testing features built into the ZK Identity Proof system. These features allow you to simulate common attack scenarios and understand why they fail.

## Overview

The system includes three major security testing modes:

1. **Untrusted Issuer Attack** (Step 1) - Testing credential forgery
2. **Malicious Circuit Attack** (Step 2) - Understanding circuit integrity
3. **Wallet Binding Attack** (Step 3) - Testing credential theft

## 1. Untrusted Issuer Attack

### Location
**Step 1: Request Credentials**

### Attack Scenario
An attacker tries to create valid credentials by signing them with an unregistered issuer (not in the contract's trusted registry).

### How to Test
1. In Step 1, enable the "🔒 Security Testing: Untrusted Issuer Attack" toggle
2. Request DOB or Citizenship credentials
3. The credentials will be signed by a random, unregistered private key
4. Continue to Step 2 and generate a proof (requires soft constraint circuit)
5. In Step 3, submit the proof - it will fail verification

### Why This Attack Fails

#### The Defense Mechanism
```
┌─────────────────────────────────────────────────────────┐
│ Attack Flow                                              │
├─────────────────────────────────────────────────────────┤
│ 1. Attacker generates random private key                │
│ 2. Signs credentials with this key                       │
│ 3. Creates valid ECDSA signatures                        │
│ 4. Generates ZK proof (signature verification passes)    │
│ 5. Submits proof to contract                             │
│                                                           │
│ Contract Check:                                           │
│ - Extracts issuer public key from proof                  │
│ - Checks: trustedIssuerA[hash(pubkey)] == true?         │
│ - Result: FALSE (not in registry)                        │
│ - Verification FAILS                                      │
└─────────────────────────────────────────────────────────┘
```

#### Key Principles

1. **Public vs Private Keys**
   - The contract stores only public keys (X, Y coordinates)
   - Private keys never leave the issuer's system
   - Cannot derive private key from public key (ECDSA security)

2. **Registry Check**
   - Contract maintains a mapping: `pubkeyHash => bool`
   - Only registered issuers' public keys return `true`
   - Random/unregistered keys fail this check

3. **Two-Layer Verification**
   - Circuit verifies: "Was this signed by someone with private key?"
   - Contract verifies: "Is that public key in our trusted list?"

### The Critical Security Question

**Q: Can an attacker observe `addTrustedIssuerA()` transactions and extract the private key?**

**A: NO - Absolutely not.**

Here's why:
- Transaction data contains: `addTrustedIssuerA(pubkey_x, pubkey_y)`
- These are public key coordinates (points on elliptic curve)
- Private key is NEVER transmitted or stored on-chain
- Deriving private key from public key requires breaking ECDSA (computationally infeasible)

**Analogy:** It's like observing someone's house address (public) and trying to get their safe combination (private). They're mathematically related but one cannot be derived from the other.

### E2E Test
```javascript
npm run test:e2e
// Test: "Soft - Untrusted Issuer (Valid Data, Unregistered Key)"
```

---

## 2. Malicious Circuit Attack

### Location
**Step 2: Generate Proof**

### Attack Scenario
A malicious developer modifies the circuit to remove or bypass verification checks, attempting to generate "valid" proofs for invalid data.

### Example Attack
```circom
// Original circuit (secure)
signal age_check <== LessThan(121)([age_in_years, min_age]);
age_check === 0;  // Assertion: age_in_years >= min_age

// Malicious modification (insecure)
signal age_check <-- 1;  // Just set to 1, no computation!
age_check === 1;  // Always passes
```

With this malicious circuit, even a 10-year-old could generate a proof claiming they're 18+!

### Why This Attack Fails

#### The Defense Mechanism

```
┌─────────────────────────────────────────────────────────┐
│ Trusted Setup Binds Circuit to Verifier                 │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  Circuit A (legitimate)                                   │
│      ↓                                                    │
│  R1CS Constraints A                                       │
│      ↓                                                    │
│  Trusted Setup                                            │
│      ↓                                                    │
│  Proving Keys A + Verifier Contract A                    │
│                                                           │
│  Circuit B (malicious, different constraints)            │
│      ↓                                                    │
│  R1CS Constraints B (DIFFERENT)                          │
│      ↓                                                    │
│  Trusted Setup                                            │
│      ↓                                                    │
│  Proving Keys B + Verifier Contract B (DIFFERENT)        │
│                                                           │
│  Result:                                                  │
│  - Proof from Circuit B cannot verify with Verifier A    │
│  - Verifier A is deployed on-chain (immutable)           │
│  - Attacker cannot replace Verifier A                    │
└─────────────────────────────────────────────────────────┘
```

#### Key Principles

1. **Cryptographic Binding**
   - Verification keys are derived from the circuit's constraint system
   - Different constraints = different verification keys
   - Verification key is embedded in the deployed Solidity contract

2. **Immutable Deployment**
   - Once deployed, the verifier contract cannot be changed
   - Contract address is known and fixed
   - Attacker cannot deploy their own verifier at the same address

3. **Cross-Verification Impossible**
   - Proof A (from Circuit A) + Verifier B (from Circuit B) = FAIL
   - The pairing equations in Groth16 won't balance
   - Cryptographic verification returns `false`

### Best Practices for Production

To prevent malicious circuit modifications in production systems:

1. **Open Source Circuit Code**
   - Publish circuit code on GitHub
   - Allow community review and auditing
   - Use version control to track changes

2. **Circuit Audits**
   - Have the circuit reviewed by ZK experts
   - Security firms specializing in zero-knowledge proofs
   - Check for logic errors and constraint gaps

3. **Trusted Setup Ceremony**
   - Use Multi-Party Computation (MPC) for setup
   - Many participants contribute randomness
   - Only one needs to be honest for security

4. **Verifier Contract Audits**
   - Audit the generated Solidity verifier
   - Ensure correct Groth16 implementation
   - Check gas optimization doesn't break security

5. **Circuit-Verifier Verification**
   - Prove that the deployed verifier corresponds to the published circuit
   - Use deterministic builds
   - Publish circuit hash and verifier address together

### Related Concept: Trusted Setup Toxicity

**What if the trusted setup is compromised?**

If someone retains the "toxic waste" (randomness used in setup), they could:
- Generate fake proofs for any statement
- Bypass all circuit constraints

**Solution:** Use Multi-Party Computation (MPC):
- Many parties contribute randomness
- Only ONE needs to delete their secret for security
- "1-of-N" trust assumption

---

## 3. Wallet Binding Attack (Credential Theft)

### Location
**Step 3: Submit Proof**

### Attack Scenario
Bob tries to steal Alice's proof and submit it to pretend he's 18+. This simulates credential theft or replay attacks.

### How to Test
1. Generate a proof in Step 2 (proof is bound to Alice's wallet: Ganache Account #3)
2. In Step 3, enable "🔒 Security Testing: Wallet Binding Attack"
3. The system will attempt to submit from Bob's wallet (Ganache Account #4)
4. Verification will fail

### Why This Attack Fails

#### The Defense Mechanism

```
┌─────────────────────────────────────────────────────────┐
│ Wallet Binding Flow                                      │
├─────────────────────────────────────────────────────────┤
│                                                           │
│ Step 1: Credential Issuance                              │
│   Issuer signs: hash(DOB, Alice_address, nonce)         │
│                                                           │
│ Step 2: Proof Generation                                 │
│   Circuit enforces: user_pubkey === subject_wallet      │
│   Public signal: subject_wallet = Alice_address         │
│                                                           │
│ Step 3: On-Chain Verification                            │
│   Contract checks: publicSignals[8] == msg.sender       │
│                                                           │
│   If Bob submits:                                         │
│     publicSignals[8] = Alice_address (from proof)        │
│     msg.sender = Bob_address (transaction sender)        │
│     Alice_address != Bob_address → FAIL                  │
└─────────────────────────────────────────────────────────┘
```

#### Key Principles

1. **Cryptographic Binding in Circuit**
   - The proof includes `subject_wallet` as a public input
   - Circuit enforces: credentials were issued for this wallet
   - Cannot change this value without invalidating the proof

2. **Transaction Sender Check**
   - `msg.sender` is a built-in Solidity variable
   - Always reflects the actual transaction sender
   - Cannot be faked or spoofed (blockchain enforced)

3. **Immutable Public Signals**
   - Public signals are part of the proof's cryptographic structure
   - Changing any public signal invalidates the proof
   - The pairing check would fail

### Attack Variations (All Fail)

**Variant 1: Bob copies Alice's proof**
- Result: FAIL (msg.sender != Alice_address)

**Variant 2: Bob generates new proof with Alice's credentials**
- Result: FAIL (circuit enforces user_pubkey === Bob's wallet, but credentials are for Alice)

**Variant 3: Bob tries to modify publicSignals[8]**
- Result: FAIL (proof verification fails, cryptographic check doesn't pass)

### E2E Test
```javascript
npm run test:e2e
// Test: "Failure - Wrong Wallet Submission"
```

---

## Security Model Summary

### Trust Assumptions

This system requires trust in:

1. **Circuit Code**
   - Logic correctly implements age/citizenship checks
   - No constraint gaps or bypass routes
   - Audited and open-sourced

2. **Trusted Setup**
   - "Toxic waste" was properly destroyed
   - Use MPC setup to minimize trust
   - Only one participant needs to be honest

3. **Deployed Verifier**
   - Contract correctly corresponds to circuit
   - Deployed at correct address
   - Contract is immutable (or upgrade mechanism is secure)

4. **Blockchain Security**
   - Ethereum/blockchain is secure
   - `msg.sender` cannot be spoofed
   - Transactions are ordered correctly

### What Is NOT Trusted

1. **Users** - Can try to cheat, system prevents it
2. **Unregistered Issuers** - Registry prevents acceptance
3. **Credential Holders** - Can't transfer proofs to others
4. **Network Observers** - Can see public signals but not private inputs

---

## Testing All Security Features

### Complete Security Test Flow

```bash
# 1. Start Ganache
ganache -d -g 1

# 2. Setup system (includes soft circuit compilation)
npm run setup:demo

# 3. Compile soft constraint circuit (if not done)
npm run compile:circuit
# Then run trusted setup for soft circuit (see docs/SOFT_CONSTRAINTS.md)

# 4. Run E2E tests (includes all security tests)
npm run test:e2e

# 5. Test in UI
npm run dev
```

### UI Testing Steps

1. **Untrusted Issuer** (Step 1)
   - ✅ Enable "Untrusted Issuer Attack" toggle
   - Request credentials
   - Continue to Step 2 (select soft constraints)
   - Generate proof (succeeds)
   - Step 3: Submit proof (fails with issuer registry error)

2. **Malicious Circuit** (Step 2)
   - Read the "Security Note: Circuit Integrity" section
   - Understand why modifying the circuit doesn't help attackers
   - The deployed verifier only accepts proofs from the legitimate circuit

3. **Wallet Binding** (Step 3)
   - Generate a normal proof
   - ✅ Enable "Wallet Binding Attack" toggle
   - Submit proof from wrong wallet
   - Verification fails with wallet mismatch error

---

## Common Questions

### Q: If the circuit is open source, can't attackers study it to find exploits?

**A:** Yes, attackers can study the circuit, but:
- Security through obscurity is NOT the goal
- Open source allows community audits to find bugs BEFORE attackers
- The cryptographic binding (circuit → verifier) prevents using modified circuits
- Knowing the algorithm doesn't mean you can bypass cryptographic verification

### Q: What if an attacker generates millions of proofs hoping one works?

**A:** Doesn't help because:
- Each proof is deterministic based on inputs
- Invalid inputs → invalid proof (soft constraints) or no proof (hard constraints)
- The verifier checks specific cryptographic properties
- Random guessing doesn't satisfy pairing equations
- Computationally infeasible (like guessing private keys)

### Q: Can quantum computers break this system?

**A:** Partially:
- ECDSA (credential signatures) is vulnerable to quantum attacks
  - Solution: Use quantum-resistant signatures (e.g., Falcon, Dilithium)
- Groth16 ZK proofs are believed to be quantum-resistant
  - Rely on pairing-based cryptography over elliptic curves
  - Post-quantum alternatives exist (STARKs, lattice-based SNARKs)

### Q: What if the blockchain gets reorganized and the order of transactions changes?

**A:** The system handles this:
- Verifier contract is stateless (no stored verification results)
- Each `verifyProof()` call is independent
- Proofs include `current_date` which is checked against block timestamp
- Only freshness matters, not transaction ordering

---

## Additional Resources

- [TUTORIAL.md](./TUTORIAL.md) - Full system walkthrough
- [SOFT_CONSTRAINTS.md](./SOFT_CONSTRAINTS.md) - Soft constraint circuit setup
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture
- [SECURITY.md](./SECURITY.md) - Comprehensive security analysis

## Next Steps

After understanding these security concepts:

1. Run the E2E test suite to see all scenarios
2. Try the UI security toggles yourself
3. Review the circuit code to understand constraints
4. Study the verifier contract to see on-chain checks
5. Consider: How would you attack this system? Why would it fail?

Remember: **The best security comes from understanding why attacks fail, not just knowing that they do.**
