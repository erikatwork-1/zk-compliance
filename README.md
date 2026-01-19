# Zero-Knowledge Identity Verification Demo

**An educational demonstration of privacy-preserving age and citizenship verification using zk-SNARKs (Groth16 proofs).**

## ⚠️ Educational Purpose Only

**This project is for learning and testing only.** It uses a single-party trusted setup and demo configurations that are NOT secure for production use. Do not use for commercial applications, financial systems, or any environment requiring security audits.

---

## What This Demo Shows

This project demonstrates how **zero-knowledge proofs** enable privacy-preserving identity verification:

- ✅ **Prove eligibility** (18+ years old AND US citizen) without revealing your actual date of birth
- ✅ **Verify credentials** from multiple trusted issuers (simulated DMV + Immigration)
- ✅ **On-chain verification** using Ethereum smart contracts
- ✅ **Wallet binding** to prevent credential theft
- ✅ **Security testing** with interactive attack simulations

**Key Concept**: The smart contract verifies "YES, this person is 18+ and a US citizen" without seeing their actual DOB or personal documents. That's zero-knowledge!

---

## The Decentralized Identity Challenge

### Why Decentralized Identity Matters

Blockchain promises **self-sovereign identity**—you control your credentials without relying on centralized authorities. This is crucial for:

- **Tokenized Securities** - Regulated assets (stocks, bonds) need to verify investor eligibility (accredited status, residency) without exposing personal data
- **DeFi Compliance** - Financial services must follow KYC/AML laws while preserving user privacy
- **Web3 Adoption** - Bridge real-world identity to blockchain wallets without sacrificing decentralization

### The Core Problem

**How do you prove real-world facts (age, citizenship, investor status) on-chain without:**
1. ❌ Storing sensitive data on a public blockchain
2. ❌ Relying on centralized identity providers (defeats decentralization)
3. ❌ Trusting users to self-report (no verification)
4. ❌ Creating permissioned lists (not scalable, privacy-invasive)

### Why It's Hard

**Trust & Verification**
- Blockchain is trustless, but identity requires trust in issuers (DMV, banks, governments)
- How do you verify credentials are legitimate without seeing them?
- How do you prevent credential forgery or reuse?

**Privacy vs. Compliance**
- Regulations require verification (KYC, age restrictions)
- Users want privacy (don't reveal DOB, SSN, documents)
- Traditional systems force you to choose: comply OR stay private

**Scalability & Decentralization**
- Centralized whitelists don't scale (millions of users)
- Permissioned systems create gatekeepers (anti-Web3)
- Fully decentralized systems struggle to link real-world facts to wallets


### The Reality Check

**Web3 Vision**: Fully decentralized, trustless identity systems

**Current Reality**: We're not there yet. Real-world identity requires:
- Trusted issuers (governments, institutions)
- Reliable verification (can't be fully automated)
- Regulatory compliance (laws demand accountability)

**This Demo Shows**: How ZK proofs can bridge the gap—maintaining privacy and decentralization while enabling real-world verification. It's a practical step toward self-sovereign identity, not a perfect solution.

**For Regulated Finance**: This approach enables tokenized securities, DeFi compliance, and other regulated use cases where you need to prove eligibility without exposing personal data—critical for blending crypto's decentralization with real-world legal requirements.

---

## Quick Start (2 Commands)

### Prerequisites

Install these first (one-time setup):
- **Node.js 18+** - [Download](https://nodejs.org/)
- **Foundry** - Run: `curl -L https://foundry.paradigm.xyz | bash && foundryup`
- **Circom 2** - Install from [official Rust source](https://docs.circom.io/getting-started/installation/)
- **Ganache** - Run: `npm install -g ganache`

### Start Demo

```bash
# Terminal 1: Start local blockchain
ganache -d -g 1

# Terminal 2: Install and run setup
npm install
npm run setup:demo

# Terminal 3: Start frontend
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 and follow the 4-step UI workflow!

**Setup time**: ~3-5 minutes  
**What it does**: Compiles circuits, runs trusted setup, deploys contracts, registers issuers, issues credentials

---

## How It Works

### System Architecture

```
[Issuer A: DMV] ──signs DOB credential──┐
                                         │
                                         ├──> [User] ──generates zk-proof──> [Smart Contract]
                                         │                                         │
[Issuer B: Immigration] ──signs citizenship──┘                                     │
                                                                                    ▼
                                                                              [Returns: YES/NO]
                                                                     (without seeing private data!)
```

### 4-Step UI Flow

1. **Request Credentials** - Get signed credentials from Issuer A (DOB) and Issuer B (citizenship)
2. **Generate Proof** - Create zero-knowledge proof using Circom circuit (choose hard/soft constraints)
3. **Submit Proof** - Send to smart contract for on-chain verification
4. **View Results** - See verification result with detailed explanations

**Security Testing**: Toggle options to simulate attacks (untrusted issuer, malicious circuit, credential theft) and see how the system defends against them.

---

## Tech Stack

- **ZK Circuits**: Circom 2, snarkjs, Groth16 proofs
- **Smart Contracts**: Solidity 0.8.20, Foundry
- **Frontend**: React, Vite, ethers.js v6
- **Blockchain**: Ganache (local), Ethereum-compatible networks
- **Cryptography**: ECDSA (secp256k1), Poseidon hash, BN254 elliptic curve


---

## Agent Information

**Keywords**: zero-knowledge proof, zk-SNARK, Groth16, privacy-preserving identity, age verification, Circom, Solidity, zkp, credential verification, anonymous credentials, selective disclosure, wallet binding, ECDSA signature verification, trusted setup, R1CS constraints

**Core Functionality**:
- ZK proof generation for age/citizenship verification
- In-circuit ECDSA signature verification
- On-chain Groth16 proof verification
- Dual-mode circuits (hard/soft constraints)
- Interactive security testing interface
- Educational ZK-SNARK demonstration

**Technology Stack**: Circom, snarkjs, Solidity, Foundry, React, ethers.js, Ganache, Groth16, BN254 curve

**Use Case**: Educational demonstration of zero-knowledge identity proofs with privacy preservation

---

## Contributing

This is an educational project. Contributions welcome:
- Bug fixes and improvements
- Additional test cases
- Documentation enhancements
- Educational content

Please open issues or PRs on GitHub.

---

## License

MIT License - See [LICENSE](LICENSE) for details.

---

## Acknowledgments

- [Circom](https://github.com/iden3/circom) - Circuit compiler by iden3
- [snarkjs](https://github.com/iden3/snarkjs) - ZK-SNARK JavaScript implementation
- [Foundry](https://github.com/foundry-rs/foundry) - Ethereum development framework
- [circomlib](https://github.com/iden3/circomlib) - Circuit component library

---

## Learn More

- [What are zk-SNARKs?](https://z.cash/technology/zksnarks/)
- [Circom Documentation](https://docs.circom.io/)
- [Groth16 Paper](https://eprint.iacr.org/2016/260.pdf)
- [Zero-Knowledge Proofs Explained](https://blog.chain.link/what-is-a-zero-knowledge-proof-zkp/)

---

**Questions?** Open an issue or check the [documentation](docs/).

**Built for education, not production. Use at your own risk.**
