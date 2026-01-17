# Zero-Knowledge Age and Citizenship Verification System

A complete educational demonstration of how zero-knowledge proofs (zk-SNARKs) enable privacy-preserving identity verification. This system allows users to prove they are 18+ years old AND a US citizen without revealing their actual date of birth or other personal information.

## 🎯 What is This?

This project is a **working implementation** of a zero-knowledge proof system that demonstrates:

- **Privacy Preservation**: Prove eligibility without revealing sensitive data
- **Multiple Credential Sources**: Combine credentials from different trusted issuers (e.g., DMV + Immigration)
- **On-Chain Verification**: Smart contracts verify proofs on Ethereum with zero-knowledge guarantees
- **Educational Focus**: Well-documented code designed for learning about zk-SNARKs

---

## ⚠️ IMPORTANT DISCLAIMER

**THIS IS A RESEARCH AND TESTING PROJECT FOR EDUCATIONAL PURPOSES ONLY.**

### ⛔ NOT FOR PRODUCTION OR COMMERCIAL USE

- ❌ **DO NOT USE** this code in production environments
- ❌ **DO NOT USE** this code for commercial purposes
- ❌ **DO NOT USE** this code for any compliance or regulatory requirements
- ❌ **DO NOT USE** this code for any real-world identity verification systems

### 🎓 Intended Purpose

This project is intended **solely for**:
- ✅ Educational purposes and learning about zero-knowledge proofs
- ✅ Research and experimentation
- ✅ Testing and development in controlled environments
- ✅ Fun and exploration of zk-SNARK technology

### ⚖️ No Warranties or Liability

**THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND**, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose and noninfringement. **IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE** for any claim, damages or other liability, whether in an action of contract, tort or otherwise, arising from, out of or in connection with the software or the use or other dealings in the software.

**USE AT YOUR OWN RISK.** The authors assume no responsibility for any consequences arising from the use of this software.

---

## 📋 Table of Contents

- [What is This?](#-what-is-this)
- [⚠️ Important Disclaimer](#️-important-disclaimer)
- [Features](#-features)
- [Prerequisites](#-prerequisites)
- [Quick Start](#-quick-start-plug-and-play)
- [Project Structure](#-project-structure)
- [Documentation](#-documentation)
- [Testing](#-testing)
- [Deployment](#-deployment)
- [Security](#-security-considerations)
- [Troubleshooting](#-troubleshooting)
- [Learn More](#-learn-more)

---

## ✨ Features

### Core Capabilities
- ✅ **Groth16 zk-SNARKs** - Efficient zero-knowledge proof system
- ✅ **Circom Circuits** - Custom circuits for age and citizenship verification
- ✅ **ECDSA Signature Verification** - In-circuit verification of issuer signatures
- ✅ **Wallet Binding** - Proofs cryptographically bound to submitting wallet address
- ✅ **Smart Contract Verification** - Solidity contracts using Foundry
- ✅ **Rerunnable Flow** - Reset and test different scenarios multiple times

### Advanced Features
- 🔄 **Dual Circuit Modes**
  - **Hard Constraints** (default): Proof generation fails with invalid inputs
  - **Soft Constraints** (advanced): Proof always generates, verification catches invalidity
- 🎮 **Interactive Security Testing** - Built-in attack simulations:
  - 🔒 **Untrusted Issuer Attack** (Step 1) - Test credential forgery attempts
  - ⚠️ **Malicious Circuit Attack** (Step 2) - Understand circuit integrity risks
  - 🔓 **Credential Theft Attack** (Step 3) - Test wallet binding with simulated theft
- 🧪 **Comprehensive Test Suite** - 14 E2E tests covering all UI scenarios
- 📊 **Diagnostics Panel** - Detailed verification failure analysis

### User Experience
- 🖥️ **4-Step Interactive UI** - React frontend with clear workflow
- 🎨 **Dynamic Testing Inputs** - Custom DOB, citizenship, and security scenarios
- 📦 **Auto-Loading Artifacts** - Seamless circuit artifact management
- 🔄 **Complete Reset** - "Restart Demo" button for multiple test runs

---

## 🏗️ System Architecture

```
┌─────────────┐      ┌─────────────┐
│ Issuer A    │      │ Issuer B    │
│ (DMV)       │      │ (Immigration)│
│             │      │             │
│ Signs DOB   │      │ Signs       │
│ Credential  │      │ Citizenship │
└──────┬──────┘      └──────┬──────┘
       │                     │
       └──────────┬──────────┘
                  │
                  ▼
         ┌─────────────────┐
         │   User (Alice)   │
         │                  │
         │ • Receives       │
         │   Credentials    │
         │ • Generates      │
         │   zk-Proof       │
         └────────┬─────────┘
                  │
                  ▼
         ┌─────────────────┐
         │ Smart Contract   │
         │ (Verifier)       │
         │                  │
         │ • Verifies Proof │
         │ • Returns YES/NO │
         └─────────────────┘
```

**What Makes It Zero-Knowledge?**
- ✅ Contract verifies: "User is 18+ AND a US citizen"
- ❌ Contract does NOT see: actual date of birth, citizenship document, or personal details
- 🔐 Mathematical proof guarantees validity without revealing data

---

## 🔧 Prerequisites

Before running the setup, you need to install these tools. The setup script will automatically check if they're installed and guide you if anything is missing.

### Required Software

1. **Node.js v18+**
   ```bash
   node --version  # Should be 18.0.0 or higher
   ```
   Download from [nodejs.org](https://nodejs.org/) or use `nvm install 18`

2. **Foundry** (Smart Contract Framework)
   ```bash
   curl -L https://foundry.paradigm.xyz | bash
   foundryup
   ```

3. **Circom 2** (Circuit Compiler)
   
   ⚠️ **IMPORTANT**: Do NOT use `npm install -g circom` - that's a deprecated package!
   
   ```bash
   # Install Rust toolchain (if not already installed)
   curl --proto '=https' --tlsv1.2 https://sh.rustup.rs -sSf | sh
   source "$HOME/.cargo/env"
   
   # Install Circom using the official installer
   curl -Ls https://raw.githubusercontent.com/iden3/circom/master/install.sh | bash
   
   # Or use the provided script
   bash scripts/setup/install_circom.sh
   
   # Verify installation
   circom --version  # Should show "circom compiler 2.x.x"
   ```

4. **snarkjs** (Proof Generation)
   ```bash
   npm install -g snarkjs
   ```

5. **Ganache** (Local Ethereum Network)
   ```bash
   npm install -g ganache
   ```

### Quick Prerequisite Check

You can verify all prerequisites are installed by running:
```bash
npm run check:prerequisites
```

Or directly:
```bash
bash scripts/setup/check_prerequisites.sh
```

This will check if everything is installed and provide installation instructions for any missing tools.

---

## 🚀 Quick Start (Plug and Play!)

### Step 1: Clone and Install Dependencies

```bash
git clone <repository-url>
cd zk-compliance

# Initialize submodules (includes circom source code)
git submodule update --init --recursive

npm install
```

### Step 2: Start Local Blockchain

Open a terminal and keep it running:
```bash
ganache -d -g 1
```

The `-d` flag uses deterministic accounts for consistent demo experience.

### Step 3: Run Automated Setup

Open a **second terminal** (keep Ganache running in the first):
```bash
npm run setup:demo
```

This single command automatically:
- ✅ **Checks all prerequisites** - Verifies all required tools are installed
- ✅ **Checks Ganache is running** - Ensures blockchain is available
- ✅ **Downloads Powers of Tau** - Automatically downloads the ~18MB ptau file if needed
- ✅ **Compiles both circuit versions** - Hard + soft constraint circuits
- ✅ **Runs trusted setup ceremony** - Generates proving/verification keys for both circuits
- ✅ **Deploys smart contracts** - Deploys to Ganache
- ✅ **Registers Issuer A/B public keys** - Sets up on-chain issuer registry
- ✅ **Issues demo credentials** - Creates sample DOB + citizenship credentials
- ✅ **Copies artifacts to frontend** - Makes circuit files available for the UI

⏱️ Takes about **2-3 minutes** to complete (plus ~30 seconds for ptau download on first run).

⚠️ **Security Note**: This demo uses a single-party trusted setup which is NOT secure for production. Real systems require multi-party ceremonies.

### Step 4: Launch Frontend

In the same terminal (or a new one):
```bash
cd frontend
npm install
npm run dev
```

Visit `http://localhost:5173` and follow the 4-step UI workflow!

**That's it!** The system is now ready to use. 🎉

---

### For Developers: Manual Setup

If you want granular control over each step:

```bash
# 0. Check prerequisites (optional but recommended)
bash scripts/setup/check_prerequisites.sh

# 1. Start Ganache (in a separate terminal)
ganache -d -g 1

# 2. Download Powers of Tau (if not already downloaded)
bash scripts/setup/download_ptau.sh

# 3. Compile circuits (hard + soft)
npm run compile:circuit

# 4. Run trusted setup for both circuits
npm run setup

# 5. Deploy contracts
npm run deploy:ganache

# 6. Register issuer public keys
npm run register:issuers

# 7. Issue demo credentials
npm run issuer:a && npm run issuer:b

# 8. Copy artifacts to frontend
npm run copy:artifacts
```

See [TUTORIAL.md](docs/TUTORIAL.md) for detailed explanations of each step.

---

## 🖥️ Frontend Workflow

### Step 0: Prerequisites Check
- ✅ Ganache running
- ✅ Circuit compiled
- ✅ Trusted setup complete
- ✅ Contracts deployed
- ✅ Issuers registered

### Step 1: Request Credentials
- Connect to Ganache wallet (auto-connected)
- Enter custom DOB and citizenship for testing
- **Security Testing**: Toggle "Untrusted Issuer" to simulate attack
- Request credentials from Issuer A (DOB) and Issuer B (Citizenship)

### Step 2: Generate Proof
- Auto-load circuit artifacts (or manually upload)
- **Circuit Mode Selector**:
  - 🔒 Hard Constraints - Blocks invalid proof generation
  - 🔓 Soft Constraints - Allows invalid proof generation (fails at verification)
- Generate zk-proof from credentials
- **Security Info**: Malicious circuit attack explanation

### Step 3: Submit Proof
- Enter contract address
- **Security Testing**: Toggle "Bob's Wallet" to simulate credential theft
- Submit proof to smart contract
- View verification result (YES/NO)
- **Run Diagnostics** for detailed failure analysis

### Step 4: Summary
- Complete flow recap
- Educational explanations
- Links to learn more

---

## 📁 Project Structure

```
zk-identity-proof/
├── README.md                     # This file
├── package.json                  # Node.js dependencies and scripts
├── foundry.toml                  # Foundry configuration
│
├── circuits/                     # Circom circuits
│   ├── age_citizenship.circom         # Hard constraint circuit
│   ├── age_citizenship_soft.circom    # Soft constraint circuit
│   └── utils/
│       └── ecdsa_verify.circom        # ECDSA signature verification
│
├── src/                          # Solidity contracts
│   ├── AgeVerification.sol            # Main verification contract
│   └── Verifier.sol                   # Groth16 verifier (auto-generated)
│
├── test/                         # Tests
│   ├── AgeVerification.t.sol          # Foundry contract tests
│   └── e2e/
│       └── full_flow.test.js          # E2E tests (14 scenarios)
│
├── script/                       # Deployment scripts
│   └── Deploy.s.sol                   # Foundry deployment script
│
├── scripts/                      # Node.js automation
│   ├── setup/                         # Setup automation
│   │   ├── compile_circuit.sh         # Circuit compilation
│   │   ├── trusted_setup.js           # Trusted setup ceremony
│   │   ├── setup_demo.sh              # One-command setup
│   │   └── copy_artifacts.js          # Artifact management
│   ├── issuers/                       # Credential issuance
│   │   ├── issuer_a_sign.js           # DOB credential
│   │   └── issuer_b_sign.js           # Citizenship credential
│   ├── user/                          # User operations
│   │   └── generate_proof.js          # Proof generation
│   └── deploy/                        # Deployment helpers
│       └── register_issuers.js        # On-chain registration
│
├── frontend/                     # React frontend
│   └── src/
│       ├── components/                # UI components
│       │   ├── Prerequisites.jsx      # Step 0
│       │   ├── RequestCredential.jsx  # Step 1
│       │   ├── GenerateProof.jsx      # Step 2
│       │   ├── SubmitProof.jsx        # Step 3
│       │   └── VerificationSummary.jsx# Step 4
│       └── utils/
│           └── proof_utils.js         # Frontend proof helpers
│
└── docs/                         # Documentation
    ├── ARCHITECTURE.md                # System design
    ├── MATH_BEHIND_ZK.md              # zk-SNARK mathematics
    ├── SECURITY.md                    # Security analysis
    ├── SECURITY_TESTING.md            # Attack simulations guide
    ├── SOFT_CONSTRAINTS.md            # Soft circuit guide
    ├── TUTORIAL.md                    # Step-by-step tutorial
    ├── COMPARISON.md                  # vs. other projects
    └── FLOW_DIAGRAM.md                # Visual flow diagrams
```

---

## 📚 Documentation

Comprehensive guides available in the `docs/` directory:

### Getting Started
- 📖 **[TUTORIAL.md](docs/TUTORIAL.md)** - Detailed step-by-step guide for beginners
- 🏗️ **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** - System design and component interactions

### Deep Dives
- 🔬 **[MATH_BEHIND_ZK.md](docs/MATH_BEHIND_ZK.md)** - Mathematical foundations of zk-SNARKs
- 🔐 **[SECURITY.md](docs/SECURITY.md)** - Threat model and security considerations
- 🎮 **[SECURITY_TESTING.md](docs/SECURITY_TESTING.md)** - Interactive attack simulations explained

### Advanced Topics
- 🧪 **[SOFT_CONSTRAINTS.md](docs/SOFT_CONSTRAINTS.md)** - Testing with soft constraint circuits
- ⚖️ **[COMPARISON.md](docs/COMPARISON.md)** - Comparison with other zk-identity projects
- 📊 **[FLOW_DIAGRAM.md](docs/FLOW_DIAGRAM.md)** - Visual system flow diagrams

---

## 🧪 Testing

### End-to-End Tests (14 Scenarios)

```bash
# Ensure Ganache is running and setup is complete
npm run test:e2e
```

**Test Coverage:**
- **Hard Constraint Tests (8 tests)**
  - ✅ Happy Path - Valid 18+ US citizen
  - ❌ Underage (17) - Blocks proof generation
  - ❌ Wrong citizenship (CA) - Blocks proof generation
  - ❌ Wrong wallet - Proof valid but wrong submitter
  - ❌ Untrusted issuer - Proof valid but issuer not registered
  - ✅ Boundary - Exactly 18 years old
  - ✅ Contract State - Remove issuer
  - ✅ Access Control - Only owner can add issuers

- **Soft Constraint Tests (6 tests)**
  - ✅ Happy Path - Valid 25+ US citizen
  - ✅ Boundary - Exactly 18 years old
  - ❌ Underage (17) - Proof generates, verification fails
  - ❌ Wrong citizenship (CA) - Proof generates, verification fails
  - ❌ Wrong wallet - Valid proof, wrong submitter
  - ❌ Untrusted issuer - Valid data, unregistered issuer

All tests mirror UI capabilities and attack simulations.

### Smart Contract Tests

```bash
forge test -vv
```

Tests include:
- Groth16 proof verification
- Issuer registry management
- Wallet binding enforcement
- Access control

### Circuit Tests

```bash
npm run test:circuit
```

---

## 🚢 Deployment

### Local Development (Ganache - Recommended)

```bash
# Terminal 1: Start Ganache
ganache -d -g 1

# Terminal 2: Deploy
npm run deploy:ganache
```

### Local Development (Anvil)

```bash
# Terminal 1: Start Anvil
anvil

# Terminal 2: Deploy
npm run deploy:local
```

### Testnet (Sepolia)

1. Configure `.env`:
   ```env
   SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
   PRIVATE_KEY=0x...
   ```

2. Deploy:
   ```bash
   npm run deploy:sepolia
   ```

---

## 🔒 Security Considerations

⚠️ **THIS IS AN EDUCATIONAL/RESEARCH PROJECT** - **NOT FOR PRODUCTION OR COMMERCIAL USE.**

This project is intended for testing, research, and educational purposes only. It is **NOT** suitable for production environments, commercial use, or any compliance-related applications.

### For Production Use, You MUST:

1. **Trusted Setup Ceremony**
   - Current: Single-party demo setup (INSECURE)
   - Required: Multi-party computation ceremony (MPC)
   - See: [Trusted Setup Best Practices](https://github.com/iden3/snarkjs#7-prepare-phase-2)

2. **Issuer Key Management**
   - Current: Keys stored in plaintext for demo
   - Required: Hardware security modules (HSM) or key management service (KMS)
   - Never expose private keys in production

3. **Circuit Auditing**
   - Current: Educational circuit, not audited
   - Required: Professional security audit by zk-SNARK experts
   - Check for underconstraint bugs and soundness issues

4. **Smart Contract Auditing**
   - Current: Basic contract, not audited
   - Required: Professional security audit
   - Focus on: access control, reentrancy, signature verification

5. **Circuit Distribution**
   - Current: Artifacts loaded from local files
   - Required: Pinned IPFS hashes or content-addressed storage
   - Users must verify circuit integrity (see SECURITY_TESTING.md)

### Attack Vectors Demonstrated

This project includes interactive simulations of common attacks:
- ✅ **Untrusted Issuer** - Why forged credentials fail (Step 1)
- ✅ **Malicious Circuit** - Why tampered circuits can't fool on-chain verification (Step 2)
- ✅ **Credential Theft** - Why stolen credentials fail wallet binding (Step 3)

See [SECURITY_TESTING.md](docs/SECURITY_TESTING.md) for detailed explanations.

---

## 🐛 Troubleshooting

### Common Issues

**0. Prerequisites not installed**
```bash
# Check what's missing
npm run check:prerequisites

# Follow the installation instructions provided
```

**1. Circuit compilation fails**
```bash
# Check Circom version (must be 2.x)
circom --version

# If wrong version, reinstall from source
# See Prerequisites section above
```

**2. Trusted setup fails: "Powers of Tau file not found"**
```bash
# Download the ptau file (automatically done by setup:demo)
npm run download:ptau

# Or manually:
bash scripts/setup/download_ptau.sh
```

**3. Trusted setup hangs or fails**
```bash
# Check disk space (needs ~500MB)
df -h

# Clear old build artifacts
rm -rf build/*.zkey

# Retry setup
npm run setup
```

**4. Proof generation fails: "Invalid witness length"**
```bash
# Circuit was recompiled but setup not regenerated
npm run setup           # Regenerate zkeys
npm run copy:artifacts  # Update frontend artifacts

# If in browser, hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+F5 (Windows)
```

**5. Contract deployment fails**
```bash
# Check Ganache is running
curl http://127.0.0.1:8545

# Check private key has funds
cast balance 0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1 --rpc-url http://127.0.0.1:8545
```

**6. Verification returns NO unexpectedly**
```bash
# Run diagnostics in UI to check:
# - Issuer registered?
# - Wallet binding correct?
# - Public signals match contract?

# Common issue: Using proof from different wallet
# Solution: Regenerate proof with correct wallet
```

**7. "Artifacts not found" in frontend**
```bash
# Copy artifacts to frontend
npm run copy:artifacts

# Verify files exist
ls frontend/public/artifacts/
# Should show: age_citizenship.wasm, age_citizenship_final.zkey,
#              age_citizenship_soft.wasm, age_citizenship_soft_final.zkey
```

### Still Stuck?

1. Check [TUTORIAL.md](docs/TUTORIAL.md) for detailed setup steps
2. Run E2E tests to verify system: `npm run test:e2e`
3. Open an issue with:
   - Error message
   - Steps to reproduce
   - Your environment (OS, Node version, etc.)

---

## 📖 Learn More

### Zero-Knowledge Proofs
- [What is a zk-SNARK?](https://z.cash/technology/zksnarks/) - High-level explanation
- [zk-SNARKs in a Nutshell](https://chriseth.github.io/notes/articles/zksnarks/zksnarks.pdf) - Technical overview
- [Groth16 Paper](https://eprint.iacr.org/2016/260.pdf) - Original research paper

### Tools and Frameworks
- [Circom Documentation](https://docs.circom.io/) - Circuit language
- [snarkjs Documentation](https://github.com/iden3/snarkjs) - Proof generation
- [Foundry Book](https://book.getfoundry.sh/) - Smart contract development

### Related Projects
- [Semaphore](https://github.com/semaphore-protocol/semaphore) - Anonymous signaling
- [ZK Email](https://github.com/zkemail) - Email-based identity
- [iden3](https://iden3.io/) - Decentralized identity

---

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes with clear commit messages
4. Add tests if applicable
5. Update documentation
6. Submit a pull request

### Development Guidelines
- Follow existing code style
- Add comments for complex logic
- Update relevant documentation
- Ensure tests pass before submitting

---

## ⚠️ Breaking Changes

**v2.0 - Wallet Binding Update**

The circuit now includes `subject_wallet` as a public input (9 total signals).

**This means:**
- ❌ Old proofs will NOT work with new contracts
- ✅ You must recompile circuit: `npm run compile:circuit`
- ✅ You must rerun setup: `npm run setup`
- ✅ You must redeploy contracts: `npm run deploy:ganache`
- ✅ Frontend requires wallet connection in Step 1

**Migration**: Delete `build/` folder and run `npm run setup:demo`

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

**IMPORTANT**: This license does NOT grant permission for production or commercial use. This software is provided for research, testing, and educational purposes only. See the [Disclaimer](#-important-disclaimer) section above.

---

## 🙏 Acknowledgments

Built with amazing open-source tools:
- [Circom](https://github.com/iden3/circom) - Circuit compiler by iden3
- [snarkjs](https://github.com/iden3/snarkjs) - zk-SNARK implementation
- [Foundry](https://github.com/foundry-rs/foundry) - Smart contract framework
- [circomlib](https://github.com/iden3/circomlib) - Circom component library

---

**Built with ❤️ for research, testing, and education**

*⚠️ This is a research/testing project - NOT for production or commercial use. See [Disclaimer](#️-important-disclaimer) above.*

*Questions? Open an issue or discussion!*
