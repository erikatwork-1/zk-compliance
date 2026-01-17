# Step-by-Step Tutorial

This tutorial will walk you through the complete process of using the zero-knowledge identity verification system, from setup to submitting a proof on-chain.

## Prerequisites

Before starting, ensure you have:

- Node.js v18+ installed
- Foundry installed ([installation guide](https://book.getfoundry.sh/getting-started/installation))
- **Circom 2 compiler** (official Rust version - see below)
- A code editor (VS Code recommended)
- Basic familiarity with command line

### Installing Circom 2 (Official Compiler)

**IMPORTANT**: Do NOT use `npm install -g circom` - that's the deprecated Node.js version!

Install the official Rust-based Circom 2 compiler:

```bash
# 1. Install Rust (if not already installed)
curl --proto '=https' --tlsv1.2 https://sh.rustup.rs -sSf | sh
source "$HOME/.cargo/env"

# 2. Clone and build Circom
git clone https://github.com/iden3/circom.git
cd circom
cargo build --release
cargo install --path circom
cd ..

# 3. Verify installation
circom --version  # Should show "circom compiler 2.x.x"
which circom      # Should show ~/.cargo/bin/circom
```

## Step 0: Prerequisites

Before starting the tutorial, ensure you have completed all prerequisites listed in the frontend's Step 0 screen:

1. **Start Ganache**: `ganache -d -g 1`
2. **Compile Circuit**: `npm run compile:circuit`
3. **Run Trusted Setup**: `npm run setup`
4. **Deploy Contracts**: `npm run deploy:ganache`
5. **Register Issuers**: Register issuer public keys on-chain
6. **Optional - Copy Artifacts**: Copy artifacts to `frontend/public/artifacts/` for auto-load

## Step 1: Installation

### 1.1 Clone and Install

```bash
# Clone the repository
git clone https://github.com/yourusername/zk-identity-proof.git
cd zk-identity-proof

# Install Node.js dependencies
npm install

# Verify Foundry installation
forge --version
```

### 1.2 Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your settings
# For local development, you can use default values
# For Sepolia testnet, add your RPC URL and private key
```

## Step 2: Circuit Setup

### 2.1 Compile the Circuit

```bash
npm run compile:circuit
```

This will:
- Compile the Circom circuit to R1CS format
- Generate WASM witness calculator
- Create symbol file for debugging

**Expected Output:**
```
🔧 Compiling Circom circuit...
📦 Step 1: Compiling circuit to R1CS...
template instances: 150
non-linear constraints: 1274
linear constraints: 1711
public inputs: 9
private inputs: 8
✅ Circuit compiled successfully!
   - R1CS file: build/age_citizenship.r1cs
   - WASM file: build/age_citizenship.wasm
   - Symbol file: build/age_citizenship.sym

📊 Circuit Information:
# of Constraints: 2985
# of Private Inputs: 8
# of Public Inputs: 9
```

**Note**: The circuit now has 9 public inputs (added `subject_wallet` for wallet binding).

### 2.2 Run Trusted Setup

```bash
npm run setup
```

**⚠️ Important**: This demo uses a single-party setup. For production, you MUST use a multi-party ceremony.

This will:
- Generate Powers of Tau (Phase 1)
- Generate circuit-specific keys (Phase 2)
- Export verification key
- Generate Solidity verifier contract

**Expected Time**: 5-10 minutes depending on your hardware

**Expected Output:**
```
🚀 Starting Trusted Setup Ceremony
🔐 Phase 1: Powers of Tau Ceremony
🔐 Phase 2: Circuit-Specific Setup
✅ Trusted Setup Complete!
```

## Step 3: Issue Credentials

### 3.1 Issue DOB Credential

```bash
npm run issuer:a
```

This simulates Issuer A (DMV) issuing a date of birth credential.

**Ganache -d default**: If no `.issuer_a_key.json` exists, Issuer A is derived from Ganache
account **#1 (index 1)** by default (second address). To override, set
`ISSUER_KEYS_RANDOM=true` or `GANACHE_MNEMONIC=...`.

**For Wallet Binding**: If you want to bind credentials to a specific wallet address:
```bash
SUBJECT_WALLET=0xYourWalletAddress npm run issuer:a
```

**Expected Output:**
```
🏛️  Issuer A - DOB Credential Issuance
✅ Generated new Issuer A key pair
📋 Issuer A Public Key:
   X: 1234...
   Y: 5678...
🔏 Signing credential...
✅ Credential issued and saved!
📁 Location: credentials/dob_credential.json
```

### 3.2 Issue Citizenship Credential

```bash
npm run issuer:b
```

This simulates Issuer B (Immigration) issuing a citizenship credential.

**Ganache -d default**: If no `.issuer_b_key.json` exists, Issuer B is derived from Ganache
account **#2 (index 2)** by default (third address). To override, set
`ISSUER_KEYS_RANDOM=true` or `GANACHE_MNEMONIC=...`.

**For Wallet Binding**: Use the same wallet address:
```bash
SUBJECT_WALLET=0xYourWalletAddress npm run issuer:b
```

**Expected Output:**
```
🏛️  Issuer B - Citizenship Credential Issuance
✅ Generated new Issuer B key pair
🔏 Signing credential...
✅ Credential issued and saved!
📁 Location: credentials/citizenship_credential.json
```

### 3.3 Verify Credentials

Check that credentials were created:

```bash
ls -la credentials/
cat credentials/dob_credential.json
cat credentials/citizenship_credential.json
```

**Important**: Both credentials must use the same `userPubkey` (wallet address) for the proof to be valid.

## Step 4: Generate Proof

### 4.1 Generate Zero-Knowledge Proof

```bash
npm run generate:proof
```

**For Wallet Binding**: If you used `SUBJECT_WALLET` when issuing credentials:
```bash
SUBJECT_WALLET=0xYourWalletAddress npm run generate:proof
```

This will:
- Load both credentials
- Calculate current age
- Include wallet address as public input
- Generate witness
- Create zk-SNARK proof

**Expected Time**: 5-10 seconds

**Expected Output:**
```
🎫 Zero-Knowledge Proof Generation
✅ Credentials loaded
🔐 Generating Zero-Knowledge Proof...
📋 Proof Inputs:
   Date of Birth: 2000-01-01T00:00:00.000Z
   Current Date: 2024-01-01T00:00:00.000Z
   Age: 24.00 years
   Citizenship: US
   Min Age Required: 18
🔧 Computing witness...
✅ Proof generated successfully!
📁 Proof saved to: credentials/proof.json
```

### 4.2 Inspect Proof

```bash
cat credentials/proof.json | jq '.proof'
```

The proof contains:
- `a`: G1 point (64 bytes)
- `b`: G2 point (128 bytes)
- `c`: G1 point (64 bytes)
- `publicSignals`: 9 public values (includes `subject_wallet`)

**Public Signals Order**:
1. `current_date`
2. `min_age`
3. `required_citizenship`
4. `issuer_a_pubkey_x`
5. `issuer_a_pubkey_y`
6. `issuer_b_pubkey_x`
7. `issuer_b_pubkey_y`
8. `user_pubkey`
9. `subject_wallet` (new - wallet address bound to proof)

## Step 5: Deploy Smart Contracts

### 5.1 Start Local Node (Optional)

For local testing:

```bash
# In a new terminal
anvil
```

This starts a local Ethereum node on `http://127.0.0.1:8545`

### 5.2 Deploy Contracts

```bash
# For local network
npm run deploy:local

# Or for Sepolia testnet
npm run deploy:sepolia
```

This will:
- Deploy Verifier contract
- Deploy AgeVerification contract
- Register issuer public keys
- Save deployment addresses

**Expected Output:**
```
🚀 Deploying Contracts
📦 Deploying Verifier...
✅ Verifier deployed at: 0x...
📦 Deploying AgeVerification...
✅ AgeVerification deployed at: 0x...
📋 Registering issuers...
✅ Setup complete!
```

### 5.3 Register Issuer Public Keys

After deployment, you must register the issuer public keys on-chain. Get the keys from `.issuer_a_key.json` and `.issuer_b_key.json`:

```bash
# Read issuer keys
cat .issuer_a_key.json | jq '.publicKey'
cat .issuer_b_key.json | jq '.publicKey'
```

Then register them using `cast send`:

```bash
# Replace with your actual contract address and issuer keys
cast send <AgeVerificationAddress> \
  "addTrustedIssuerA(uint256,uint256)" <issuerA_pubkey_x> <issuerA_pubkey_y> \
  --rpc-url http://127.0.0.1:8545 \
  --private-key <GANACHE_PRIVATE_KEY>

cast send <AgeVerificationAddress> \
  "addTrustedIssuerB(uint256,uint256)" <issuerB_pubkey_x> <issuerB_pubkey_y> \
  --rpc-url http://127.0.0.1:8545 \
  --private-key <GANACHE_PRIVATE_KEY>
```

### 5.4 Save Contract Address

Note the AgeVerification contract address - you'll need it for submitting proofs.

### 5.5 Optional: Prepare Artifacts for Auto-Load

To enable auto-load in the frontend:

```bash
mkdir -p frontend/public/artifacts/age_citizenship_js
cp build/age_citizenship_js/age_citizenship.wasm frontend/public/artifacts/age_citizenship_js/
cp build/age_citizenship_final.zkey frontend/public/artifacts/
```

## Step 6: Submit Proof

### 6.1 Using the Frontend

```bash
cd frontend
npm install
npm run dev
```

Visit `http://localhost:3000` and follow the 4-step flow:

1. **Step 0: Prerequisites** - Review and confirm all setup steps are complete
2. **Step 1: Request Credentials**:
   - Connect your MetaMask wallet (required for wallet binding)
   - Enter Date of Birth (test different dates to see validation)
   - Enter Citizenship (test "US" vs other countries)
   - Request both credentials
3. **Step 2: Generate Proof**:
   - Auto-load artifacts (if copied to `frontend/public/artifacts/`) OR
   - Manually select `.wasm` and `.zkey` files
   - Generate the zk-proof (bound to your wallet address)
4. **Step 3: Submit Proof**: 
   - Connect MetaMask (must match wallet from Step 1)
   - Enter contract address
   - Submit proof (contract verifies wallet binding)

**Testing Scenarios**:
- Try DOB that makes age < 18 → Proof generation will fail
- Try citizenship != "US" → Proof generation will fail
- Use "Restart Demo" button to test different scenarios
- Test wallet binding: Try submitting with different wallet → Will fail

**Auto-Load Artifacts**:
- If you copied artifacts to `frontend/public/artifacts/`, click "Auto-load from /artifacts" in Step 2
- Otherwise, manually select the `.wasm` and `.zkey` files from `build/`

### 6.2 Using Scripts (Alternative)

You can also submit proofs programmatically using ethers.js:

```javascript
const { ethers } = require('ethers');
const proof = require('./credentials/proof.json');

// Connect to network
const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
const signer = await provider.getSigner();

// IMPORTANT: The signer's address must match the subject_wallet in the proof
const signerAddress = await signer.getAddress();
const subjectWalletFromProof = proof.publicSignals[8]; // Last public signal
if (BigInt(signerAddress) !== BigInt(subjectWalletFromProof)) {
  throw new Error('Wallet address mismatch - proof is bound to different address');
}

// Load contract
const contract = new ethers.Contract(
  '0x...', // AgeVerification address
  ABI,
  signer
);

// Submit proof (now expects 9 public signals)
const tx = await contract.verifyProof(
  proof.proof.a,
  proof.proof.b,
  proof.proof.c,
  proof.publicSignals // Array of 9 values
);

await tx.wait();
console.log('Proof verified!');
```

**Note**: The contract now enforces that `msg.sender == subject_wallet` from the proof, preventing proof reuse across different wallets.

## Step 7: Verify Result (Stateless)

The contract does **not** store a registry of verified addresses. To check
verification, call `verifyProof(...)` and read the boolean result.

```javascript
const result = await contract.verifyProof(
  proof.proof.a,
  proof.proof.b,
  proof.proof.c,
  proof.publicSignals
);
console.log('Verified:', result);
```

## Troubleshooting

### Issue: Circuit compilation fails

**Check 1: Verify you have the correct Circom compiler**
```bash
which circom        # Should show ~/.cargo/bin/circom
circom --version    # Should show "circom compiler 2.x.x"
```

If it shows `node_modules/.bin/circom`, you have the wrong (deprecated) version. Follow the Circom installation instructions above.

**Check 2: "illegal expression" error with `signal public input`**

Circom 2.0 changed the syntax. Use:
```circom
signal input mySignal;  // NOT "signal public input"
component main {public [mySignal]} = MyTemplate();
```

**Check 3: "file not found" error for circomlib**

The compile command needs the include path:
```bash
circom circuit.circom --r1cs --wasm --sym -o build -l node_modules
```

**Check 4: "Non quadratic constraints are not allowed"**

Circom only allows degree-2 constraints. Split multiplications:
```circom
// BAD: degree 4
result <== a * b * c * d;

// GOOD: degree 2
signal temp1;
signal temp2;
temp1 <== a * b;
temp2 <== c * d;
result <== temp1 * temp2;
```

### Issue: Trusted setup takes too long

**Solution:**
- This is normal for first run
- Subsequent runs are faster (cached)
- Consider using pre-generated Powers of Tau

### Issue: Proof generation fails

**Solution:**
- Verify credentials exist and are valid
- Check that circuit is compiled
- Ensure trusted setup completed
- Verify age >= 18

### Issue: Contract deployment fails

**Solution:**
- Check network configuration
- Verify private key has funds (for testnet)
- Check RPC URL is correct
- Ensure Foundry is properly configured

### Issue: Proof verification fails on-chain

**Solution:**
- Verify contract address is correct
- Check issuer keys are registered
- Ensure public signals match (now 9 values, not 8)
- Verify proof format is correct
- **Check wallet binding**: The wallet submitting the proof must match the `subject_wallet` in the proof
- Ensure you're using the same wallet that was used to generate the proof

## Next Steps

1. **Explore the Code**: Read through the circuit and contract code
2. **Test Different Scenarios**: Use the rerunnable flow to test underage, non-US citizenship
3. **Modify the Circuit**: Try adding new constraints
4. **Customize Credentials**: Add more credential types
5. **Deploy to Testnet**: Test on Sepolia
6. **Read Documentation**: Check other docs in `docs/` folder

## Key Features to Explore

- **Wallet Binding**: Notice how proofs are bound to specific wallet addresses
- **Dynamic Inputs**: Test validation by entering invalid DOB or citizenship
- **Auto-Load**: Use the auto-load feature for faster iteration
- **Rerunnable Flow**: Reset and test multiple scenarios without reloading

## Additional Resources

- [Circom Documentation](https://docs.circom.io/)
- [Foundry Book](https://book.getfoundry.sh/)
- [snarkjs Guide](https://github.com/iden3/snarkjs)
- [Ethers.js Documentation](https://docs.ethers.org/)

## Getting Help

- Open an issue on GitHub
- Check existing issues for solutions
- Review the documentation
- Ask questions in discussions

---

**Happy proving! 🔐**
