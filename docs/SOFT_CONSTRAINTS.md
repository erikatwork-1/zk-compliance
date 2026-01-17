# Soft Constraints Circuit Guide

This guide explains how to use the soft constraints version of the circuit for testing failure scenarios.

## What are Soft Constraints?

### Hard Constraints (Default Circuit)
- Uses assertions (`===`) that enforce all requirements must be met
- Final assertion: `all_checks_passed === 1;`
- Proof generation **fails** if age < 18 or citizenship != US
- Error: `Assert Failed. Error in template AgeAndCitizenshipVerifier_149`
- **9 public signals**
- **Use case**: Production systems where you only want valid proofs

### Soft Constraints (Alternative Circuit)
- **Removes the final assertion** (`all_checks_passed === 1;`)
- Proof generation **always succeeds**, even with invalid inputs
- **Same 9 public signals** as hard circuit (identical structure)
- **Groth16 cryptographic verification fails** on-chain for invalid proofs
- **Use case**: Testing, demos, and understanding how invalid proofs are rejected

## Key Difference

**Hard Circuit:**
```circom
all_checks_passed <== sig_checks * age_cit_checks;
all_checks_passed === 1;  // ← ASSERTION: Blocks invalid witness generation
```

**Soft Circuit:**
```circom
all_checks_passed <== sig_checks * age_cit_checks;
// (no assertion - witness can be generated with all_checks_passed = 0 or 1)
```

## Why Use Soft Constraints?

With soft constraints, you can:
1. ✅ Generate proofs with underage inputs (15 years old)
2. ✅ Generate proofs with non-US citizenship
3. ✅ See Groth16 verification failures on-chain instead of circuit errors
4. ✅ Test the complete flow including rejection scenarios
5. ✅ Understand how invalid proofs are mathematically rejected

## How It Works

When you use soft constraints with invalid inputs:

1. **Proof Generation**: Succeeds (circuit computes `all_checks_passed = 0`)
2. **Proof Structure**: Valid Groth16 proof (π_a, π_b, π_c) + 9 public signals
3. **On-Chain Verification**: The verifier contract runs Groth16 pairing checks
4. **Mathematical Failure**: The pairing equations don't balance because the proof "proves" that constraints were NOT satisfied
5. **Result**: `verifyProof()` returns `false`

**Important:** The rejection happens during **cryptographic verification**, not by checking an output flag.

## How to Enable Soft Constraints

> **Note**: The frontend includes a circuit mode selector in Step 2! Once you complete the setup below, you can toggle between hard and soft constraints directly in the UI.

### Step 1: Compile the Soft Circuit

The soft constraint circuit is already included at `circuits/age_citizenship_soft.circom`.

```bash
# Compile both circuits
npm run compile:circuit
```

This will generate:
- `build/age_citizenship.r1cs` (hard constraints)
- `build/age_citizenship_soft.r1cs` (soft constraints)
- `build/age_citizenship_js/` (hard WASM)
- `build/age_citizenship_soft_js/` (soft WASM)

### Step 2: Run Trusted Setup

The automated setup now handles **both circuits**:

```bash
npm run setup
```

This will:
- Run Phase 1 (Powers of Tau) once
- Run Phase 2 for `age_citizenship` (hard circuit)
- Run Phase 2 for `age_citizenship_soft` (soft circuit)
- Generate verification keys for both
- Export `src/Verifier.sol` (works for both circuits)

Output:
```
✅ Trusted Setup Complete!
==========================
📁 Files generated:

   age_citizenship:
   - Proving key: build/age_citizenship_final.zkey
   - Verification key: build/age_citizenship_vkey.json

   age_citizenship_soft:
   - Proving key: build/age_citizenship_soft_final.zkey
   - Verification key: build/age_citizenship_soft_vkey.json

   - Verifier contract: src/Verifier.sol (for main circuit)

🎉 You can now generate proofs with both hard and soft constraint circuits!
```

### Step 3: Copy Artifacts to Frontend

```bash
# The copy script automatically copies both circuits
npm run copy:artifacts
```

This will copy:
- Hard constraint artifacts (always)
- Soft constraint artifacts (if available)

You'll see output like:
```
📦 Copying circuit artifacts...

Hard Constraint Circuit:
✅ Hard constraint artifacts copied
   - frontend/public/artifacts/age_citizenship_js/age_citizenship.wasm
   - frontend/public/artifacts/age_citizenship_final.zkey

Soft Constraint Circuit:
✅ Soft constraint artifacts copied
   - frontend/public/artifacts/age_citizenship_soft_js/age_citizenship_soft.wasm
   - frontend/public/artifacts/age_citizenship_soft_final.zkey

✅ Artifact copy complete!
```

### Step 4: Use the Frontend Selector

That's it! The frontend now includes a **Circuit Mode Selector** in Step 2. You can toggle between:
- 🔒 **Hard Constraints** (default) - Proof generation fails with invalid inputs
- 🔓 **Soft Constraints** (advanced) - Proof always generates, Groth16 verification fails on-chain

Simply select "Soft Constraints" and the frontend will automatically load the correct artifacts.

### Step 5: No Separate Contract Needed!

**Important Change:** Because both circuits have **identical public signal structures** (9 signals), you use the **same AgeVerification.sol contract** for both!

The existing contract's `verifyProof()` function works perfectly:
```solidity
function verifyProof(
    uint[2] memory a,
    uint[2][2] memory b,
    uint[2] memory c,
    uint[9] memory input  // Same 9 inputs for both circuits!
) external view returns (bool) {
    // Groth16 pairing check
    if (!verifier.verifyProof(a, b, c, input)) {
        return false;  // ← This is where invalid soft constraint proofs fail
    }
    
    // ... issuer checks, policy checks, wallet binding ...
    return true;
}
```

## Test Cases with Soft Constraints

### Test 1: Underage User (17 years old)

**Hard Constraints:**
```
❌ Proof generation fails: Assert Failed
```

**Soft Constraints:**
```
✅ Proof generation succeeds
✅ Proof submitted to contract
❌ Groth16 verification fails (returns false)
```

### Test 2: Wrong Citizenship (Canadian)

**Hard Constraints:**
```
❌ Proof generation fails: Assert Failed
```

**Soft Constraints:**
```
✅ Proof generation succeeds
✅ Proof submitted to contract
❌ Groth16 verification fails (returns false)
```

### Test 3: Valid User (18+ and US)

**Both Circuits:**
```
✅ Proof generation succeeds
✅ Proof submitted to contract
✅ Verification passes
```

## Understanding Why Invalid Proofs Fail

### The Mathematical Reason

Groth16 proofs rely on pairing equations:
```
e(π_A, π_B) = e(α, β) · e(∑ᵢ aᵢ·Gᵢ, γ) · e(π_C, δ)
```

When you generate a proof with soft constraints and invalid inputs:
1. The circuit computes `all_checks_passed = 0` (not 1)
2. The proof structure encodes this fact cryptographically
3. On-chain, the pairing equations won't balance
4. The verifier returns `false`

**Key Insight:** The proof is mathematically proving that "the constraints were satisfied with these inputs." If the constraints weren't satisfied (age < 18), the proof proves that fact, and the verifier correctly rejects it.

## Key Differences Summary

| Aspect | Hard Constraints | Soft Constraints |
|--------|-----------------|------------------|
| Final Assertion | `all_checks_passed === 1;` | No assertion (removed) |
| Proof Generation | Fails with invalid inputs | Always succeeds |
| Public Signals | 9 signals | 9 signals (identical!) |
| Contract | AgeVerification.sol | AgeVerification.sol (same!) |
| Failure Location | Circuit (witness generation) | Contract (Groth16 verification) |
| Testing | Can't test failures | Can test all scenarios |

## Running E2E Tests

The test suite includes soft constraint tests:

```bash
npm run test:e2e
```

Tests include:
- `Soft - Underage Generates Proof but Fails Verification`
- `Soft - Wrong Citizenship Generates Proof but Fails Verification`
- `Soft - Untrusted Issuer (Valid Data, Unregistered Key)`

These tests demonstrate that proofs generate successfully but fail during on-chain Groth16 verification.

## Troubleshooting

### "Artifacts not found" error in UI

If you see this error when selecting soft constraints:
1. Make sure you ran: `npm run compile:circuit`
2. Make sure you ran: `npm run setup` (runs trusted setup for both circuits)
3. Make sure you ran: `npm run copy:artifacts`

Or just run the complete setup:
```bash
npm run setup:demo
```

### "Assert Failed" error with soft circuit

If soft constraints still fail during proof generation, check:
1. Verify you're loading the correct WASM: `age_citizenship_soft.wasm`
2. Check the circuit file doesn't have assertions
3. Recompile: `npm run compile:circuit`

## Best Practices

### For Learning and Testing
- ✅ Use soft constraints to understand how invalid proofs fail
- ✅ Test with various invalid inputs (underage, wrong country)
- ✅ Observe Groth16 verification failures on-chain

### For Production
- ✅ Use hard constraints to prevent invalid proof generation
- ✅ Simpler mental model (fails early at proof generation)
- ✅ Less gas consumption (invalid proofs never reach chain)

## Next Steps

1. Run `npm run setup:demo` to compile and setup both circuits
2. Start the frontend and go to Step 2
3. Toggle between Hard and Soft constraint modes
4. Test with invalid inputs to see the difference
5. Run diagnostics to understand which checks fail

Remember: **Both circuits have identical structures - the only difference is one assertion!**
