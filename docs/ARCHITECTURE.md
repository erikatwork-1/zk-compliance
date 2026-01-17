# System Architecture

This document describes the architecture of the zero-knowledge age and citizenship verification system.

## Overview

The system consists of five main components:

1. **Identity Issuers**: Trusted authorities that issue signed credentials
2. **Zero-Knowledge Circuit**: Proves eligibility without revealing sensitive data
3. **Smart Contract**: On-chain verifier that accepts and validates proofs with wallet binding
4. **Frontend (React)**: 4-step UI with prerequisites, credential request, proof generation, and on-chain submission
5. **Users**: Individuals who receive credentials and generate proofs via the frontend

## Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Identity Issuers                          │
├──────────────────────┬──────────────────────────────────────┤
│   Issuer A (DMV)     │    Issuer B (Immigration)            │
│                      │                                       │
│  - Issues DOB        │  - Issues Citizenship                │
│    Credentials       │    Credentials                        │
│  - Signs with ECDSA  │  - Signs with ECDSA                  │
└──────────┬───────────┴──────────────┬────────────────────────┘
           │                           │
           │ Credentials               │ Credentials
           │                           │
           └───────────┬───────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React)                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   Step 0          Step 1              Step 2              Step 3
│  ┌─────────┐    ┌─────────┐        ┌─────────┐        ┌─────────┐
│  │Prereqs  │──▶ │Request  │   ──▶  │Generate │   ──▶  │ Submit  │
│  │Checklist│    │Creds    │        │ Proof   │        │On-Chain │
│  └─────────┘    └─────────┘        └─────────┘        └─────────┘
│                                                              │
│  Shows:          Shows:              Shows:              Shows:  │
│  - Setup steps   - Wallet connect    - Private inputs    - Proof data
│  - Prerequisites - DOB/Cit input     - Public inputs     - TX details
│                  - Credential         - Proof output      - Verified status
│                    structure         - Auto-load         - Wallet binding
│                  - Signatures          artifacts           verification
│                                                              │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          │ zk-Proof + MetaMask TX
                          │
                          ▼
           ┌───────────────────────┐
           │   Smart Contract        │
           │   (AgeVerification)     │
           │                        │
           │  - Verifies Proof      │
           │  - Checks Issuers       │
           │  - Updates Registry    │
           └───────────────────────┘
```

## Data Flow

### 1. Credential Issuance

```
User Request → Issuer A/B → Verify Identity → Sign Credential → Return to User
```

**Credential Structure:**
```json
{
  "credentialType": "date_of_birth",
  "dateOfBirth": "946684800",  // Unix timestamp
  "userPubkey": "0x...",
  "nonce": "1234567890",
  "signature": {
    "r": "...",
    "s": "..."
  },
  "issuerPubkey": {
    "x": "...",
    "y": "..."
  }
}
```

### 2. Proof Generation

```
Credentials → Circuit Inputs → Witness Generation → zk-Proof → Public Signals
```

**Circuit Inputs:**
- **Private**: DOB, citizenship, signatures, nonces
- **Public**: Current date, min age, required citizenship, issuer keys, user pubkey, subject_wallet

**Proof Output:**
- Groth16 proof (a, b, c)
- Public signals (9 values, including subject_wallet for wallet binding)

### 3. On-Chain Verification

```
Proof + Public Signals → Verifier Contract → AgeVerification Contract → Registry Update
```

## Circuit Design

### Circuit Template: `AgeAndCitizenshipVerifier`

The circuit verifies:

1. **Issuer A Signature**: Validates DOB credential signature
2. **Issuer B Signature**: Validates citizenship credential signature
3. **Age Check**: Calculates age and verifies >= 18
4. **Citizenship Check**: Verifies citizenship == "US"
5. **User Binding**: Ensures both credentials belong to same user
6. **Wallet Binding**: Ensures user_pubkey == subject_wallet (binds proof to wallet address)

### Circuit Constraints

```circom
// Verify Issuer A signature
verify_a.valid === 1

// Verify Issuer B signature
verify_b.valid === 1

// Age >= min_age
age_in_years >= min_age

// Citizenship matches
citizenship === required_citizenship

// All checks pass
all_checks_passed === 1
```

### Public Inputs (9 values)

1. `current_date` - Unix timestamp
2. `min_age` - Minimum age requirement (18)
3. `required_citizenship` - Required citizenship ("US" encoded)
4. `issuer_a_pubkey_x` - Issuer A public key X
5. `issuer_a_pubkey_y` - Issuer A public key Y
6. `issuer_b_pubkey_x` - Issuer B public key X
7. `issuer_b_pubkey_y` - Issuer B public key Y
8. `user_pubkey` - User's public key (from credentials)
9. `subject_wallet` - Wallet address (uint160) bound to the proof

## Smart Contract Architecture

### Verifier Contract

Auto-generated from the circuit, implements Groth16 verification:

```solidity
function verifyProof(
    uint[2] memory a,
    uint[2][2] memory b,
    uint[2] memory c,
    uint[9] memory input  // Now 9 values (added subject_wallet)
) external view returns (bool);
```

### AgeVerification Contract

Main application contract with:

**State Variables:**
- `verifier`: Reference to Verifier contract
- `trustedIssuerA`: Registry of trusted DOB issuers
- `trustedIssuerB`: Registry of trusted citizenship issuers

**Key Functions:**
- `verifyProof()`: Accepts proof and verifies it (enforces wallet binding)
- `addTrustedIssuerA/B()`: Admin function to add issuers
- `verifyProof()`: Stateless verification returning true/false

**Wallet Binding Enforcement:**
- Contract requires `subject_wallet == uint160(msg.sender)`
- Prevents proof reuse across different wallets
- Ensures only the wallet that generated the proof can use it

## Frontend Architecture

The frontend is a React application that guides users through a 4-step verification process, clearly displaying inputs and outputs at each stage for educational purposes. The flow is fully rerunnable, allowing users to test different scenarios (e.g., underage, non-US citizenship).

### Technology Stack

- **React 18**: UI framework
- **Vite**: Build tool and dev server
- **ethers.js v6**: Ethereum interaction
- **snarkjs**: Client-side proof generation

### 4-Step Wizard Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FRONTEND UI FLOW                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────┐ │
│  │   STEP 0     │  │   STEP 1     │  │   STEP 2     │  │ STEP 3   │ │
│  │ Prerequisites│─▶│   Request    │─▶│   Generate   │─▶│ Submit   │ │
│  │  Checklist   │  │  Credentials │  │    Proof     │  │On-Chain  │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────┘ │
│                                                                      │
│  Shows:          Output:             Input/Output:      Input:      │
│  - Setup steps   - Wallet connect    - Private inputs  - Proof    │
│  - Prerequisites - DOB/Cit input     - Public inputs    - Signals  │
│                  - DOB credential     - Proof output     Output:    │
│                  - Citizenship        - Auto-load       - TX hash  │
│                    credential          artifacts         - Status   │
│                  - Signatures          - Wallet binding              │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Structure

```
frontend/src/
├── App.jsx                 # Main app with step state management & reset
├── components/
│   ├── Prerequisites.jsx       # Step 0: Prerequisites checklist
│   ├── RequestCredential.jsx   # Step 1: Wallet connect, input DOB/Cit, request credentials
│   ├── GenerateProof.jsx       # Step 2: Show inputs, auto-load/select artifacts, generate proof
│   └── SubmitProof.jsx         # Step 3: Submit to blockchain with wallet binding check
└── utils/
    └── proof_utils.js      # Credential issuance & proof generation (with wallet binding)
```

### Step 0: Prerequisites (`Prerequisites.jsx`)

**Purpose**: Display checklist of required setup steps before starting

**Shows**:
- Ganache startup command
- Circuit compilation step
- Trusted setup step
- Contract deployment step
- Issuer registration step
- Artifact preparation (optional for auto-load)

**Action**: User confirms prerequisites are complete and proceeds to Step 1

### Step 1: Request Credentials (`RequestCredential.jsx`)

**Purpose**: Connect wallet, input DOB/citizenship, and request credentials from trusted issuers

**Displays**:
- Wallet connection interface (MetaMask required)
- Date of Birth input (date picker)
- Citizenship input (text field)
- Credential structure (DOB, citizenship, nonces)
- Issuer signatures (r, s components)
- Issuer public keys (x, y coordinates)
- Explanation of each field's purpose

**Features**:
- Dynamic DOB/citizenship inputs (test underage/non-US scenarios)
- Wallet binding (credentials tied to connected wallet address)
- Validation feedback for invalid inputs

**Output**: Two signed credentials stored in component state, bound to wallet address

### Step 2: Generate Proof (`GenerateProof.jsx`)

**Purpose**: Generate zero-knowledge proof from credentials with wallet binding

**Displays**:
- **Artifact Selection**: Auto-load from `/artifacts` or manual file selection
- **Private Inputs** (red-themed): Values hidden in proof
  - `date_of_birth`, `citizenship`
  - `signature_a_r`, `signature_a_s`, `signature_b_r`, `signature_b_s`
  - `nonce_a`, `nonce_b`

- **Public Inputs** (green-themed): Values visible to verifier
  - `current_date`, `min_age`, `required_citizenship`
  - Issuer public keys (x, y for both issuers)
  - `user_pubkey`
  - `subject_wallet` (new - wallet address bound to proof)

- **Proof Output** (blue-themed): Generated proof components
  - Groth16 proof (pi_a, pi_b, pi_c)
  - 9 public signals (includes subject_wallet)
  - Generation time and proof size
  - Wallet address binding confirmation

**Key Educational Points**: 
- Shows that private data (DOB, citizenship) is NOT in the output
- Demonstrates wallet binding (proof tied to specific wallet address)

### Step 3: Submit Proof (`SubmitProof.jsx`)

**Purpose**: Submit proof to smart contract for on-chain verification with wallet binding check

**Displays**:
- Wallet connection status (must match proof's subject_wallet)
- Contract address input
- Exact data being sent to `verifyProof()` function:
  - `a` (uint[2]) - G1 point
  - `b` (uint[2][2]) - G2 point
  - `c` (uint[2]) - G1 point
  - `input` (uint[9]) - Public signals (includes subject_wallet)
- Wallet binding verification (checks connected wallet matches proof)
- Transaction details (hash, block, gas used)
- Verification success confirmation

**Security Feature**: Prevents submission if connected wallet doesn't match the proof's bound wallet address

### Data Flow in Frontend

```
Step 0          Step 1                    Step 2                    Step 3
───────          ───────                   ───────                   ───────
Check           Connect wallet        ───▶ Load credentials    ───▶ Format proof for
prerequisites   Request DOB                Prepare circuit          Solidity
                (with DOB input)           inputs (with wallet)     (9 public signals)
                Request Citizenship        Auto-load/select
                (with Cit input)            artifacts
                Store in state       ───▶ Generate witness    ───▶ Verify wallet match
                (bound to wallet)          Create Groth16           Call contract.
                                            proof (with wallet)      verifyProof()
                                            binding
                Display credential   ───▶ Display private     ───▶ Display TX result
                structure                 vs public inputs         & verification result
                (wallet address)          (wallet binding)         (wallet binding OK)
```

## Security Model

### Trust Assumptions

1. **Issuers are Trusted**: Issuers must be legitimate authorities
2. **Issuer Keys are Secure**: Private keys must be protected
3. **Trusted Setup is Secure**: Multi-party ceremony required
4. **Smart Contract is Correct**: Contract must be audited

### Threat Model

**Potential Attacks:**
1. **Forged Credentials**: Mitigated by ECDSA signature verification
2. **Replay Attacks**: Mitigated by nonces and timestamps
3. **Untrusted Issuers**: Mitigated by issuer registry
4. **Circuit Vulnerabilities**: Mitigated by circuit audit

## Performance Considerations

### Proof Generation Time
- **Circuit Size**: ~3,000 constraints (simplified signature verification)
- **Generation Time**: ~2-5 seconds (depends on hardware)
- **Proof Size**: ~200 bytes

> **Note**: This project uses a simplified signature verification for educational purposes. Full ECDSA (secp256k1) verification would add ~1.5M constraints using libraries like [circom-ecdsa](https://github.com/0xPARC/circom-ecdsa).

### Gas Costs
- **Verification**: ~200,000 gas
- **Storage Update**: ~20,000 gas
- **Total per Verification**: ~220,000 gas

## Recent Enhancements

1. **Wallet Binding**: Proofs are cryptographically bound to wallet addresses
2. **Dynamic Inputs**: Frontend allows testing different DOB/citizenship values
3. **Auto-Load Artifacts**: Option to auto-load circuit artifacts from `/artifacts`
4. **Rerunnable Flow**: Complete demo can be reset and rerun multiple times
5. **Step 0 Prerequisites**: Clear checklist of required setup steps

## Future Improvements

1. **Credential Revocation**: Add revocation lists
2. **Multi-Citizenship**: Support multiple countries
3. **Age Ranges**: Support different age requirements
4. **Batch Verification**: Verify multiple proofs at once
5. **Privacy Enhancements**: Add additional privacy features
6. **Multi-Wallet Support**: Allow users to generate proofs for different wallets

## References

- [Circom Documentation](https://docs.circom.io/)
- [Groth16 Paper](https://eprint.iacr.org/2016/260.pdf)
- [ECDSA Specification](https://en.wikipedia.org/wiki/Elliptic_Curve_Digital_Signature_Algorithm)
