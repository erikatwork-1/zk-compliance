#!/usr/bin/env node

/**
 * End-to-End Test Suite for ZK Age & Citizenship Verification
 *
 * This test suite verifies the complete flow:
 * 1. Deploy contracts (Verifier + AgeVerification)
 * 2. Register trusted issuers
 * 3. Issue credentials from issuers
 * 4. Generate ZK proofs
 * 5. Submit and verify proofs on-chain
 *
 * Test Coverage (aligned with UI flow):
 * 
 * HARD CONSTRAINT TESTS (8 tests):
 * - Happy Path: Valid 18+ US citizen
 * - Failure Cases:
 *   • Underage (17 years) - circuit blocks proof generation
 *   • Wrong citizenship (CA) - circuit blocks proof generation
 *   • Wrong wallet - proof valid but submitted from different wallet
 *   • Untrusted issuer - proof valid but issuer not registered
 * - Boundary: Exactly 18 years old
 * - Contract State: Remove issuer
 * - Access Control: Only owner can add issuers
 * 
 * SOFT CONSTRAINT TESTS (6 tests):
 * - Happy Path: Valid 25+ US citizen (confirms soft circuit works)
 * - Boundary: Exactly 18 years old
 * - Failure Cases (proof generates but verification fails):
 *   • Underage (17 years) - Groth16 verification fails
 *   • Wrong citizenship (CA) - Groth16 verification fails
 *   • Wrong wallet - valid proof, wrong submitter
 *   • Untrusted issuer - valid data, unregistered issuer
 * 
 * The soft constraint tests mirror UI capabilities where users can:
 * - Step 1: Choose trusted/untrusted issuer, set custom DOB/citizenship
 * - Step 2: Select hard/soft circuit
 * - Step 3: Submit with normal/Bob's wallet (credential theft simulation)
 *
 * Prerequisites:
 * - Compiled circuit (npm run compile:circuit)
 * - Trusted setup completed (npm run setup)
 * - Local blockchain running (ganache -d or anvil)
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Import project modules
const { issueDOBCredential } = require('../../scripts/issuers/issuer_a_sign');
const { issueCitizenshipCredential, encodeCitizenship } = require('../../scripts/issuers/issuer_b_sign');
const { generateProof } = require('../../scripts/user/generate_proof');

// Paths
const ROOT_DIR = path.join(__dirname, '../..');
const BUILD_DIR = path.join(ROOT_DIR, 'build');
const OUT_DIR = path.join(ROOT_DIR, 'out');

// Test configuration
const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8545';
const GANACHE_MNEMONIC = 'myth like bonus scare over problem client lizard pioneer submit female collect';

// BN254 scalar field size - the circuit reduces all values mod this
const BN254_SCALAR_FIELD = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');

/**
 * Reduce a value to be within the BN254 scalar field
 * This ensures consistency between circuit inputs and smart contract values
 */
function reduceModR(value) {
    const bigValue = BigInt(value);
    return bigValue % BN254_SCALAR_FIELD;
}

// Test state
let provider;
let deployer;
let deployerNonceManager;
let userWallet;
let otherWallet;
let verifierContract;
let verifierAddress;
let ageVerificationContract;
let ageVerificationAddress;
let issuerAPrivateKey;
let issuerBPrivateKey;

// Test results tracking
const testResults = {
    passed: 0,
    failed: 0,
    errors: []
};

/**
 * Test assertion helper
 */
function assert(condition, message) {
    if (!condition) {
        throw new Error(`Assertion failed: ${message}`);
    }
}

/**
 * Run a single test case
 */
async function runTest(name, testFn) {
    process.stdout.write(`  ${name}... `);
    try {
        await testFn();
        console.log('\x1b[32mPASSED\x1b[0m');
        testResults.passed++;
        return true;
    } catch (error) {
        console.log('\x1b[31mFAILED\x1b[0m');
        console.log(`    Error: ${error.message}`);
        testResults.failed++;
        testResults.errors.push({ name, error: error.message });
        return false;
    }
}

/**
 * Load contract artifacts from Foundry output
 */
function loadContractArtifact(solFileName, contractName) {
    const artifactPath = path.join(OUT_DIR, `${solFileName}.sol`, `${contractName}.json`);
    if (!fs.existsSync(artifactPath)) {
        throw new Error(`Contract artifact not found: ${artifactPath}\nPlease run: forge build`);
    }
    return JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
}

/**
 * Setup test environment
 */
async function setup() {
    console.log('\n========================================');
    console.log('  ZK Identity Verification E2E Tests');
    console.log('========================================\n');

    console.log('Setting up test environment...\n');

    // Connect to local blockchain
    provider = new ethers.JsonRpcProvider(RPC_URL);

    // Derive wallets from Ganache mnemonic
    const hdNode = ethers.HDNodeWallet.fromPhrase(GANACHE_MNEMONIC, undefined, "m/44'/60'/0'/0");
    deployer = hdNode.derivePath('0').connect(provider);
    deployerNonceManager = new ethers.NonceManager(deployer);
    userWallet = hdNode.derivePath('3').connect(provider); // Use account #3 as user
    otherWallet = hdNode.derivePath('4').connect(provider); // Use account #4 for wrong wallet tests

    // Derive issuer keys from Ganache accounts #1 and #2
    const issuerAHdWallet = hdNode.derivePath('1');
    const issuerBHdWallet = hdNode.derivePath('2');
    issuerAPrivateKey = new Uint8Array(Buffer.from(issuerAHdWallet.privateKey.slice(2), 'hex'));
    issuerBPrivateKey = new Uint8Array(Buffer.from(issuerBHdWallet.privateKey.slice(2), 'hex'));

    console.log(`  Provider: ${RPC_URL}`);
    console.log(`  Deployer: ${deployer.address}`);
    console.log(`  User Wallet: ${userWallet.address}`);
    console.log(`  Other Wallet: ${otherWallet.address}`);

    // Check circuit artifacts exist
    const wasmPath = path.join(BUILD_DIR, 'age_citizenship_js', 'age_citizenship.wasm');
    const zkeyPath = path.join(BUILD_DIR, 'age_citizenship_final.zkey');

    if (!fs.existsSync(wasmPath)) {
        throw new Error(`Circuit WASM not found. Run: npm run compile:circuit`);
    }
    if (!fs.existsSync(zkeyPath)) {
        throw new Error(`ZKey not found. Run: npm run setup`);
    }

    console.log('  Circuit artifacts: Found');
    
    // Check if soft constraint circuit exists (optional)
    const wasmPathSoft = path.join(BUILD_DIR, 'age_citizenship_soft_js', 'age_citizenship_soft.wasm');
    const zkeyPathSoft = path.join(BUILD_DIR, 'age_citizenship_soft_final.zkey');
    const softCircuitExists = fs.existsSync(wasmPathSoft) && fs.existsSync(zkeyPathSoft);
    
    if (softCircuitExists) {
        console.log('  Soft constraint circuit: Found (will test soft constraints)\n');
    } else {
        console.log('  Soft constraint circuit: Not found (skipping soft constraint tests)\n');
    }
    
    return { softCircuitExists };
}

/**
 * Deploy contracts
 */
async function deployContracts() {
    console.log('Deploying contracts...\n');

    // Load artifacts (solFileName, contractName)
    const verifierArtifact = loadContractArtifact('Verifier', 'Groth16Verifier');
    const ageVerificationArtifact = loadContractArtifact('AgeVerification', 'AgeVerification');

    // Deploy Verifier
    const VerifierFactory = new ethers.ContractFactory(
        verifierArtifact.abi,
        verifierArtifact.bytecode.object,
        deployerNonceManager
    );
    console.log('  Deploying Verifier...');
    const verifierDeployed = await VerifierFactory.deploy();
    await verifierDeployed.waitForDeployment();
    verifierAddress = await verifierDeployed.getAddress();
    verifierContract = new ethers.Contract(verifierAddress, verifierArtifact.abi, deployerNonceManager);
    console.log(`  Verifier deployed: ${verifierAddress}`);

    // Deploy AgeVerification
    const minAge = 18;
    const requiredCitizenship = encodeCitizenship('US');

    const AgeVerificationFactory = new ethers.ContractFactory(
        ageVerificationArtifact.abi,
        ageVerificationArtifact.bytecode.object,
        deployerNonceManager
    );
    console.log(`  Deploying AgeVerification...`);
    const ageVerificationDeployed = await AgeVerificationFactory.deploy(
        verifierAddress,
        minAge,
        requiredCitizenship
    );
    await ageVerificationDeployed.waitForDeployment();
    ageVerificationAddress = await ageVerificationDeployed.getAddress();
    ageVerificationContract = new ethers.Contract(ageVerificationAddress, ageVerificationArtifact.abi, deployerNonceManager);
    console.log(`  AgeVerification deployed: ${ageVerificationAddress}`);

    // Verify addresses are different
    if (verifierAddress === ageVerificationAddress) {
        throw new Error(`Contract deployment error: both contracts have same address ${verifierAddress}`);
    }

    console.log('  Contracts deployed successfully\n');
}

// Store registered issuer keys for debugging
let registeredIssuerAX, registeredIssuerAY, registeredIssuerBX, registeredIssuerBY;

/**
 * Register trusted issuers
 *
 * IMPORTANT: We must register the REDUCED issuer keys (mod BN254 scalar field)
 * because the circuit reduces all values mod r, and the smart contract must
 * check against the same reduced values that appear in the proof's public signals.
 */
async function registerIssuers() {
    console.log('Registering trusted issuers...\n');

    const secp256k1 = require('@noble/secp256k1');

    // Get issuer public keys (raw from secp256k1)
    const issuerAPubkey = secp256k1.getPublicKey(issuerAPrivateKey, false);
    const issuerBPubkey = secp256k1.getPublicKey(issuerBPrivateKey, false);

    const rawIssuerAX = BigInt('0x' + Buffer.from(issuerAPubkey.slice(1, 33)).toString('hex'));
    const rawIssuerAY = BigInt('0x' + Buffer.from(issuerAPubkey.slice(33, 65)).toString('hex'));
    const rawIssuerBX = BigInt('0x' + Buffer.from(issuerBPubkey.slice(1, 33)).toString('hex'));
    const rawIssuerBY = BigInt('0x' + Buffer.from(issuerBPubkey.slice(33, 65)).toString('hex'));

    // Reduce to BN254 scalar field - this matches what the circuit does
    registeredIssuerAX = reduceModR(rawIssuerAX);
    registeredIssuerAY = reduceModR(rawIssuerAY);
    registeredIssuerBX = reduceModR(rawIssuerBX);
    registeredIssuerBY = reduceModR(rawIssuerBY);

    console.log(`  Registering Issuer A: X=${registeredIssuerAX} (reduced from ${rawIssuerAX})`);
    console.log(`  Registering Issuer B: X=${registeredIssuerBX} (reduced from ${rawIssuerBX})`);

    // Register Issuer A
    const txA = await ageVerificationContract.addTrustedIssuerA(registeredIssuerAX, registeredIssuerAY);
    await txA.wait();
    console.log(`  Issuer A registered`);

    // Register Issuer B
    const txB = await ageVerificationContract.addTrustedIssuerB(registeredIssuerBX, registeredIssuerBY);
    await txB.wait();
    console.log(`  Issuer B registered\n`);
}

/**
 * Issue credentials for a user
 *
 * Layman view:
 * - The issuer "signs" your data so anyone can verify it came from them.
 * - This uses a cryptographic signature, NOT encryption.
 * - Signing proves authenticity; encryption would hide data (we do NOT encrypt here).
 *
 * Under the hood:
 * - Each issuer hashes the credential fields with Poseidon (inside issuer scripts),
 *   then signs the hash with their private key (ECDSA).
 * - The circuit later recomputes the same hash and verifies the signature.
 */
async function issueCredentials(dateOfBirth, citizenship, userAddress) {
    const secp256k1 = require('@noble/secp256k1');

    const userPubkey = BigInt(userAddress);
    const nonceA = BigInt(Math.floor(Math.random() * 2**48));
    const nonceB = BigInt(Math.floor(Math.random() * 2**48));

    // Verify our private key matches what we expect
    const expectedAPubkey = secp256k1.getPublicKey(issuerAPrivateKey, false);
    const expectedAPubkeyX = BigInt('0x' + Buffer.from(expectedAPubkey.slice(1, 33)).toString('hex'));

    console.log('\n  [Credential Issuance]');
    console.log('  Encryption: none (this flow uses signatures, not encryption).');
    console.log(`  Data being signed by Issuer A: DOB=${dateOfBirth}, userPubkey=${userPubkey}, nonceA=${nonceA}`);
    console.log(`  Data being signed by Issuer B: citizenship=${citizenship}, userPubkey=${userPubkey}, nonceB=${nonceB}`);

    // Issuer A signs (DOB, userPubkey, nonceA) using ECDSA.
    // This is the authenticity proof that the circuit will verify later.
    const dobCredential = await issueDOBCredential(
        dateOfBirth,
        userPubkey,
        nonceA,
        issuerAPrivateKey
    );

    // Verify credential's issuer key matches what we registered on-chain.
    // This is a sanity check that the proof will pass issuer registry checks.
    const credentialIssuerX = BigInt(dobCredential.issuerPubkey.x);
    const reducedCredentialIssuerX = reduceModR(credentialIssuerX);
    const reducedExpectedPubkeyX = reduceModR(expectedAPubkeyX);
    console.log(`\n    Comparing issuer A pubkey (reduced vs reduced):`);
    console.log(`      Credential Issuer A X (raw):     ${credentialIssuerX}`);
    console.log(`      Credential Issuer A X (reduced): ${reducedCredentialIssuerX}`);
    console.log(`      Registered Issuer A X (reduced): ${registeredIssuerAX}`);
    console.log(`      Expected from privkey (raw):     ${expectedAPubkeyX}`);
    console.log(`      Expected from privkey (reduced): ${reducedExpectedPubkeyX}`);
    console.log(`      Keys match (reduced): ${reducedCredentialIssuerX === registeredIssuerAX}`);

    if (reducedCredentialIssuerX !== registeredIssuerAX) {
        console.log(`    WARNING: Issuer key mismatch!`);
    }

    // Also print the issuer key in the format generateProof would use
    console.log(`    As string for input:    "${dobCredential.issuerPubkey.x}"`);

    // Issuer B signs (citizenship, userPubkey, nonceB) using ECDSA.
    const citizenshipCredential = await issueCitizenshipCredential(
        citizenship,
        userPubkey,
        nonceB,
        issuerBPrivateKey
    );

    return { dobCredential, citizenshipCredential };
}

/**
 * Generate proof using soft constraint circuit
 *
 * Soft constraints allow proof generation with invalid inputs (underage, wrong citizenship).
 * The proof will always generate, but invalid proofs will fail verification on-chain.
 */
async function generateProofSoft(dobCredential, citizenshipCredential, wallet) {
    const snarkjs = require('snarkjs');
    
    // Set SUBJECT_WALLET environment variable
    const originalSubjectWallet = process.env.SUBJECT_WALLET;
    process.env.SUBJECT_WALLET = wallet.address;
    
    try {
        const currentDate = new Date();
        const current_timestamp = BigInt(Math.floor(currentDate.getTime() / 1000));
        const min_age = BigInt(18);
        const required_citizenship = BigInt(encodeCitizenship('US'));
        
        // Prepare circuit inputs (same structure as hard constraint circuit)
        const input = {
            date_of_birth: dobCredential.dateOfBirth.toString(),
            citizenship: citizenshipCredential.citizenship.toString(), // Use citizenship from citizenship credential
            current_date: current_timestamp.toString(),
            min_age: min_age.toString(),
            required_citizenship: required_citizenship.toString(),
            issuer_a_pubkey_x: dobCredential.issuerPubkey.x.toString(),
            issuer_a_pubkey_y: dobCredential.issuerPubkey.y.toString(),
            issuer_b_pubkey_x: citizenshipCredential.issuerPubkey.x.toString(),
            issuer_b_pubkey_y: citizenshipCredential.issuerPubkey.y.toString(),
            sig_a_r: dobCredential.signature.r.toString(),
            sig_a_s: dobCredential.signature.s.toString(),
            sig_b_r: citizenshipCredential.signature.r.toString(),
            sig_b_s: citizenshipCredential.signature.s.toString(),
            nonce_a: dobCredential.nonce.toString(),
            nonce_b: citizenshipCredential.nonce.toString(),
            user_pubkey: dobCredential.userPubkey.toString(),
            subject_wallet: BigInt(wallet.address).toString()
        };
        
        // Generate proof with soft constraint circuit
        const wasmPath = path.join(BUILD_DIR, 'age_citizenship_soft_js', 'age_citizenship_soft.wasm');
        const zkeyPath = path.join(BUILD_DIR, 'age_citizenship_soft_final.zkey');
        
        const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, wasmPath, zkeyPath);
        
        // Format proof for Solidity verifier
        const proofData = {
            proof: {
                a: [proof.pi_a[0], proof.pi_a[1]],
                b: [[proof.pi_b[0][1], proof.pi_b[0][0]], [proof.pi_b[1][1], proof.pi_b[1][0]]],
                c: [proof.pi_c[0], proof.pi_c[1]]
            },
            publicSignals: publicSignals
        };
        
        return proofData;
    } finally {
        if (originalSubjectWallet !== undefined) {
            process.env.SUBJECT_WALLET = originalSubjectWallet;
        } else {
            delete process.env.SUBJECT_WALLET;
        }
    }
}

/**
 * Generate and submit proof
 *
 * Layman view:
 * - We prove "I am 18+ and US" without revealing DOB or citizenship string.
 * - The proof also binds to the wallet address that submits it.
 *
 * Under the hood:
 * - The circuit hashes inputs and verifies issuer signatures in zero-knowledge.
 * - The output "public signals" are the values everyone can see
 *   (current_date, issuer pubkeys, required citizenship, etc).
 * - The contract checks these public signals against its own config.
 */
async function generateAndSubmitProof(dobCredential, citizenshipCredential, wallet) {
    // Set SUBJECT_WALLET environment variable for proof generation
    const originalSubjectWallet = process.env.SUBJECT_WALLET;
    process.env.SUBJECT_WALLET = wallet.address;

    try {
        const currentDate = new Date();
        console.log('\n  [Proof Generation]');
        console.log('  Encryption: none (proof hides private inputs without encrypting them).');
        console.log('  Private inputs (hidden): DOB, citizenship, signatures, nonces.');
        console.log('  Public signals (visible): current_date, min_age, required_citizenship, issuer keys, user_pubkey, subject_wallet.');

        // Generate Groth16 proof from credentials + policy parameters.
        // This produces (a, b, c) + publicSignals.
        const proofData = await generateProof(
            dobCredential,
            citizenshipCredential,
            currentDate,
            18
        );

        // Get the current_date from the proof's public signals.
        // The contract rejects proofs that are too old/new, so we align block time.
        const proofTimestamp = BigInt(proofData.publicSignals[0]);

        // Warp Ganache's block timestamp to match the proof's current_date
        // Use evm_mine with timestamp (Ganache v7+) or evm_increaseTime as fallback
        try {
            await provider.send('evm_mine', [Number(proofTimestamp)]);
        } catch {
            // For older Ganache versions, use evm_increaseTime
            const currentBlock = await provider.getBlock('latest');
            const timeDiff = Number(proofTimestamp) - currentBlock.timestamp;
            if (timeDiff > 0) {
                await provider.send('evm_increaseTime', [timeDiff]);
                await provider.send('evm_mine', []);
            }
        }

        console.log('\n  [On-chain Verification]');
        console.log(`  Comparing subject_wallet (proof) vs msg.sender: ${proofData.publicSignals[8]} vs ${wallet.address}`);
        console.log(`  Comparing issuer keys (proof) vs registry:`);
        console.log(`    Issuer A X: proof=${proofData.publicSignals[3]} registry=${registeredIssuerAX}`);
        console.log(`    Issuer A Y: proof=${proofData.publicSignals[4]} registry=${registeredIssuerAY}`);
        console.log(`    Issuer B X: proof=${proofData.publicSignals[5]} registry=${registeredIssuerBX}`);
        console.log(`    Issuer B Y: proof=${proofData.publicSignals[6]} registry=${registeredIssuerBY}`);

        // Submit proof from the specified wallet.
        // The contract checks that subject_wallet == msg.sender.
        const contractWithWallet = ageVerificationContract.connect(wallet);

        const result = await contractWithWallet.verifyProof(
            proofData.proof.a,
            proofData.proof.b,
            proofData.proof.c,
            proofData.publicSignals.map(s => BigInt(s))
        );

        return { result, proofData };
    } finally {
        // Restore original environment
        if (originalSubjectWallet !== undefined) {
            process.env.SUBJECT_WALLET = originalSubjectWallet;
        } else {
            delete process.env.SUBJECT_WALLET;
        }
    }
}

// ============================================
// TEST CASES
// ============================================

/**
 * Test 1: Happy Path - Valid 18+ US Citizen
 *
 * Expectation:
 * - Proof verifies on-chain (returns true).
 * - Public signals match the issuer keys registered in the contract.
 */
async function testHappyPath() {
    // Create a user who is 25 years old and US citizen
    const dateOfBirth = BigInt(Math.floor(new Date('2000-01-01').getTime() / 1000));
    const citizenship = 'US';

    const { dobCredential, citizenshipCredential } = await issueCredentials(
        dateOfBirth,
        citizenship,
        userWallet.address
    );

    const { result, proofData } = await generateAndSubmitProof(
        dobCredential,
        citizenshipCredential,
        userWallet
    );

    if (result !== true) {
        // Debug: check what's in the public signals
        const signals = proofData.publicSignals;
        console.log('\n    Debug - Public Signals:');
        console.log(`      [0] current_date: ${signals[0]}`);
        console.log(`      [1] min_age: ${signals[1]}`);
        console.log(`      [2] required_citizenship: ${signals[2]} (expected: ${encodeCitizenship('US')})`);
        console.log(`      [3] issuer_a_pubkey_x: ${signals[3]}`);
        console.log(`      [4] issuer_a_pubkey_y: ${signals[4]}`);
        console.log(`      [5] issuer_b_pubkey_x: ${signals[5]}`);
        console.log(`      [6] issuer_b_pubkey_y: ${signals[6]}`);
        console.log(`      [7] user_pubkey: ${signals[7]}`);
        console.log(`      [8] subject_wallet: ${signals[8]}`);
        console.log(`      msg.sender (userWallet): ${userWallet.address}`);
        console.log(`      msg.sender as BigInt: ${BigInt(userWallet.address)}`);

        // Compare issuer keys (public signals vs on-chain registry)
        console.log(`      Issuer A X match: ${signals[3] === registeredIssuerAX.toString()}`);
        console.log(`      Issuer A Y match: ${signals[4] === registeredIssuerAY.toString()}`);
        console.log(`      Issuer B X match: ${signals[5] === registeredIssuerBX.toString()}`);
        console.log(`      Issuer B Y match: ${signals[6] === registeredIssuerBY.toString()}`);
        console.log(`      Registered A X: ${registeredIssuerAX}`);
        console.log(`      Registered B X: ${registeredIssuerBX}`);

        // Check block timestamp
        const block = await provider.getBlock('latest');
        console.log(`      Block timestamp: ${block.timestamp}`);
    }

    assert(result === true, 'Expected proof to verify successfully');
}

/**
 * Test 2: Failure - Underage User (17 years old)
 *
 * The circuit enforces age >= 18, so proof generation should fail.
 */
async function testUnderageUser() {
    // Create a user who is 17 years old
    const now = new Date();
    const seventeenYearsAgo = new Date(now.getFullYear() - 17, now.getMonth(), now.getDate());
    const dateOfBirth = BigInt(Math.floor(seventeenYearsAgo.getTime() / 1000));
    const citizenship = 'US';

    const { dobCredential, citizenshipCredential } = await issueCredentials(
        dateOfBirth,
        citizenship,
        userWallet.address
    );

    // Should fail during proof generation (circuit constraint violation)
    let errorThrown = false;
    try {
        await generateAndSubmitProof(
            dobCredential,
            citizenshipCredential,
            userWallet
        );
    } catch (error) {
        errorThrown = true;
        assert(
            error.message.includes('years old') || error.message.includes('Assert Failed'),
            `Expected age-related error, got: ${error.message}`
        );
    }

    assert(errorThrown, 'Expected proof generation to fail for underage user');
}

/**
 * Test 3: Failure - Wrong Citizenship (CA instead of US)
 *
 * The circuit enforces required_citizenship == "US", so proof generation should fail.
 */
async function testWrongCitizenship() {
    const dateOfBirth = BigInt(Math.floor(new Date('2000-01-01').getTime() / 1000));
    const citizenship = 'CA'; // Canadian instead of US

    const { dobCredential, citizenshipCredential } = await issueCredentials(
        dateOfBirth,
        citizenship,
        userWallet.address
    );

    // Should fail during proof generation (circuit constraint violation)
    let errorThrown = false;
    try {
        await generateAndSubmitProof(
            dobCredential,
            citizenshipCredential,
            userWallet
        );
    } catch (error) {
        errorThrown = true;
        // Circuit will fail because citizenship doesn't match required_citizenship
    }

    assert(errorThrown, 'Expected proof generation to fail for wrong citizenship');
}

/**
 * Test 4: Failure - Wrong Wallet Submitting Proof
 */
async function testWrongWalletSubmission() {
    const dateOfBirth = BigInt(Math.floor(new Date('2000-01-01').getTime() / 1000));
    const citizenship = 'US';

    // Issue credentials bound to userWallet
    const { dobCredential, citizenshipCredential } = await issueCredentials(
        dateOfBirth,
        citizenship,
        userWallet.address
    );

    // Generate proof for userWallet
    const originalSubjectWallet = process.env.SUBJECT_WALLET;
    process.env.SUBJECT_WALLET = userWallet.address;

    try {
        const currentDate = new Date();
        const proofData = await generateProof(
            dobCredential,
            citizenshipCredential,
            currentDate,
            18
        );

        // Try to submit from otherWallet (should fail wallet binding check)
        const contractWithOtherWallet = ageVerificationContract.connect(otherWallet);

        const result = await contractWithOtherWallet.verifyProof(
            proofData.proof.a,
            proofData.proof.b,
            proofData.proof.c,
            proofData.publicSignals.map(s => BigInt(s))
        );

        assert(result === false, 'Expected verification to fail for wrong wallet');
    } finally {
        if (originalSubjectWallet !== undefined) {
            process.env.SUBJECT_WALLET = originalSubjectWallet;
        } else {
            delete process.env.SUBJECT_WALLET;
        }
    }
}

/**
 * Test 5: Failure - Untrusted Issuer
 */
async function testUntrustedIssuer() {
    const dateOfBirth = BigInt(Math.floor(new Date('2000-01-01').getTime() / 1000));
    const citizenship = 'US';

    // Generate random issuer keys (not registered)
    const secp256k1 = require('@noble/secp256k1');
    const untrustedIssuerKey = secp256k1.utils.randomPrivateKey();

    const userPubkey = BigInt(userWallet.address);
    const nonceA = BigInt(Math.floor(Math.random() * 2**48));
    const nonceB = BigInt(Math.floor(Math.random() * 2**48));

    // Issue DOB credential from untrusted issuer
    const dobCredential = await issueDOBCredential(
        dateOfBirth,
        userPubkey,
        nonceA,
        untrustedIssuerKey // Untrusted issuer
    );

    // Issue citizenship credential from trusted issuer
    const citizenshipCredential = await issueCitizenshipCredential(
        citizenship,
        userPubkey,
        nonceB,
        issuerBPrivateKey
    );

    // Generate and submit proof
    const originalSubjectWallet = process.env.SUBJECT_WALLET;
    process.env.SUBJECT_WALLET = userWallet.address;

    try {
        const currentDate = new Date();
        const proofData = await generateProof(
            dobCredential,
            citizenshipCredential,
            currentDate,
            18
        );

        // Warp block timestamp to match proof
        const proofTimestamp = BigInt(proofData.publicSignals[0]);
        try {
            await provider.send('evm_mine', [Number(proofTimestamp)]);
        } catch {
            const currentBlock = await provider.getBlock('latest');
            const timeDiff = Number(proofTimestamp) - currentBlock.timestamp;
            if (timeDiff > 0) {
                await provider.send('evm_increaseTime', [timeDiff]);
                await provider.send('evm_mine', []);
            }
        }

        const contractWithWallet = ageVerificationContract.connect(userWallet);

        const result = await contractWithWallet.verifyProof(
            proofData.proof.a,
            proofData.proof.b,
            proofData.proof.c,
            proofData.publicSignals.map(s => BigInt(s))
        );

        assert(result === false, 'Expected verification to fail for untrusted issuer');
    } finally {
        if (originalSubjectWallet !== undefined) {
            process.env.SUBJECT_WALLET = originalSubjectWallet;
        } else {
            delete process.env.SUBJECT_WALLET;
        }
    }
}

/**
 * Test 6: Boundary - Exactly 18 Years Old Today
 */
async function testExactly18YearsOld() {
    // Create a user who turned exactly 18 today
    const now = new Date();
    const exactlyEighteenYearsAgo = new Date(now.getFullYear() - 18, now.getMonth(), now.getDate());
    const dateOfBirth = BigInt(Math.floor(exactlyEighteenYearsAgo.getTime() / 1000));
    const citizenship = 'US';

    const { dobCredential, citizenshipCredential } = await issueCredentials(
        dateOfBirth,
        citizenship,
        userWallet.address
    );

    const { result } = await generateAndSubmitProof(
        dobCredential,
        citizenshipCredential,
        userWallet
    );

    assert(result === true, 'Expected proof to verify for user who is exactly 18');
}

/**
 * Test 7: Contract State - Remove Issuer After Registration
 */
async function testRemoveIssuer() {
    const secp256k1 = require('@noble/secp256k1');

    // Generate a new issuer key pair
    const tempIssuerKey = secp256k1.utils.randomPrivateKey();
    const tempIssuerPubkey = secp256k1.getPublicKey(tempIssuerKey, false);
    const rawTempIssuerPubkeyX = BigInt('0x' + Buffer.from(tempIssuerPubkey.slice(1, 33)).toString('hex'));
    const rawTempIssuerPubkeyY = BigInt('0x' + Buffer.from(tempIssuerPubkey.slice(33, 65)).toString('hex'));

    // Reduce to BN254 scalar field - must match what circuit produces
    const tempIssuerPubkeyX = reduceModR(rawTempIssuerPubkeyX);
    const tempIssuerPubkeyY = reduceModR(rawTempIssuerPubkeyY);

    // Add temporary issuer with reduced keys
    const txAdd = await ageVerificationContract.addTrustedIssuerA(tempIssuerPubkeyX, tempIssuerPubkeyY);
    await txAdd.wait();

    // Issue credential with temp issuer
    const dateOfBirth = BigInt(Math.floor(new Date('2000-01-01').getTime() / 1000));
    const userPubkey = BigInt(userWallet.address);
    const nonce = BigInt(Math.floor(Math.random() * 2**48));

    const dobCredential = await issueDOBCredential(
        dateOfBirth,
        userPubkey,
        nonce,
        tempIssuerKey
    );

    const citizenshipCredential = await issueCitizenshipCredential(
        'US',
        userPubkey,
        BigInt(Math.floor(Math.random() * 2**48)),
        issuerBPrivateKey
    );

    // Verify proof works with registered issuer
    const originalSubjectWallet = process.env.SUBJECT_WALLET;
    process.env.SUBJECT_WALLET = userWallet.address;

    try {
        const currentDate = new Date();
        const proofData = await generateProof(
            dobCredential,
            citizenshipCredential,
            currentDate,
            18
        );

        // Warp block timestamp to match proof
        const proofTimestamp = BigInt(proofData.publicSignals[0]);
        try {
            await provider.send('evm_mine', [Number(proofTimestamp)]);
        } catch {
            const currentBlock = await provider.getBlock('latest');
            const timeDiff = Number(proofTimestamp) - currentBlock.timestamp;
            if (timeDiff > 0) {
                await provider.send('evm_increaseTime', [timeDiff]);
                await provider.send('evm_mine', []);
            }
        }

        const contractWithWallet = ageVerificationContract.connect(userWallet);

        // Should pass initially
        const resultBefore = await contractWithWallet.verifyProof(
            proofData.proof.a,
            proofData.proof.b,
            proofData.proof.c,
            proofData.publicSignals.map(s => BigInt(s))
        );
        assert(resultBefore === true, 'Expected proof to verify with registered issuer');

        // Remove the issuer
        const txRemove = await ageVerificationContract.removeTrustedIssuerA(tempIssuerPubkeyX, tempIssuerPubkeyY);
        await txRemove.wait();
        const resultAfter = await contractWithWallet.verifyProof(
            proofData.proof.a,
            proofData.proof.b,
            proofData.proof.c,
            proofData.publicSignals.map(s => BigInt(s))
        );
        assert(resultAfter === false, 'Expected proof to fail after issuer removal');
    } finally {
        if (originalSubjectWallet !== undefined) {
            process.env.SUBJECT_WALLET = originalSubjectWallet;
        } else {
            delete process.env.SUBJECT_WALLET;
        }
    }
}

/**
 * Test 8: Access Control - Only Owner Can Add Issuers
 */
async function testOnlyOwnerCanAddIssuers() {
    const secp256k1 = require('@noble/secp256k1');

    const randomKey = secp256k1.utils.randomPrivateKey();
    const randomPubkey = secp256k1.getPublicKey(randomKey, false);
    const pubkeyX = BigInt('0x' + Buffer.from(randomPubkey.slice(1, 33)).toString('hex'));
    const pubkeyY = BigInt('0x' + Buffer.from(randomPubkey.slice(33, 65)).toString('hex'));

    // Try to add issuer from non-owner wallet
    const contractWithUser = ageVerificationContract.connect(userWallet);

    let errorThrown = false;
    try {
        const tx = await contractWithUser.addTrustedIssuerA(pubkeyX, pubkeyY);
        await tx.wait();
    } catch (error) {
        errorThrown = true;
        // Ganache may not return detailed error messages, just check that it failed
    }

    assert(errorThrown, 'Expected addTrustedIssuerA to revert for non-owner');
}

/**
 * Test 9: Soft Constraints - Invalid Data Generates Proof but Fails Verification
 * 
 * This test demonstrates the difference between hard and soft constraints:
 * - Hard constraints: Proof generation fails with invalid inputs (age < 18)
 * - Soft constraints: Proof generation succeeds, but verification fails on-chain
 * 
 * This requires the soft constraint circuit to be compiled and setup.
 */
async function testSoftConstraintsUnderageFailsVerification() {
    // Create an underage user (17 years old)
    const now = new Date();
    const seventeenYearsAgo = new Date(now.getFullYear() - 17, now.getMonth(), now.getDate());
    const dateOfBirth = BigInt(Math.floor(seventeenYearsAgo.getTime() / 1000));
    const citizenship = 'US';

    console.log('\n  [Soft Constraint Test]');
    console.log(`  Testing with underage user: 17 years old`);
    console.log(`  With hard constraints: proof generation would FAIL (Assert Failed)`);
    console.log(`  With soft constraints: proof generation SUCCEEDS, verification FAILS`);

    const { dobCredential, citizenshipCredential } = await issueCredentials(
        dateOfBirth,
        citizenship,
        userWallet.address
    );

    // Generate proof with soft constraints - should SUCCEED
    console.log(`  Generating proof with soft constraints...`);
    let proofData;
    try {
        proofData = await generateProofSoft(
            dobCredential,
            citizenshipCredential,
            userWallet
        );
        console.log(`  ✓ Proof generation succeeded (as expected with soft constraints)`);
    } catch (error) {
        throw new Error(`Proof generation failed unexpectedly with soft constraints: ${error.message}`);
    }

    // Verify the proof has the correct structure (same as hard circuit)
    assert(
        proofData.publicSignals.length === 9,
        `Expected 9 public signals (same as hard circuit), got ${proofData.publicSignals.length}`
    );

    // Warp block timestamp to match proof
    const proofTimestamp = BigInt(proofData.publicSignals[0]);
    try {
        await provider.send('evm_mine', [Number(proofTimestamp)]);
    } catch {
        const currentBlock = await provider.getBlock('latest');
        const timeDiff = Number(proofTimestamp) - currentBlock.timestamp;
        if (timeDiff > 0) {
            await provider.send('evm_increaseTime', [timeDiff]);
            await provider.send('evm_mine', []);
        }
    }

    // Submit proof - should FAIL verification on-chain
    // Note: Public signals are identical to hard circuit (9 signals)
    
    const contractWithWallet = ageVerificationContract.connect(userWallet);
    
    console.log(`  Submitting proof to contract...`);
    const result = await contractWithWallet.verifyProof(
        proofData.proof.a,
        proofData.proof.b,
        proofData.proof.c,
        proofData.publicSignals.map(s => BigInt(s))
    );

    console.log(`  Contract verification result: ${result} (false = rejected as expected)`);
    console.log(`  WHY IT FAILED: Groth16 proof verification mathematically fails`);
    console.log(`  The proof proves that constraints were NOT satisfied (age < 18)`);
    assert(
        result === false,
        'Expected on-chain verification to fail for underage user with soft constraints'
    );
}

/**
 * Test 10: Soft Constraints - Wrong Citizenship Generates Proof but Fails Verification
 */
async function testSoftConstraintsWrongCitizenshipFailsVerification() {
    // Create a user with wrong citizenship
    const dateOfBirth = BigInt(Math.floor(new Date('2000-01-01').getTime() / 1000));
    const citizenship = 'CA'; // Canadian instead of US

    console.log('\n  [Soft Constraint Test]');
    console.log(`  Testing with wrong citizenship: CA instead of US`);
    console.log(`  With hard constraints: proof generation would FAIL`);
    console.log(`  With soft constraints: proof generation SUCCEEDS, verification FAILS`);

    const { dobCredential, citizenshipCredential } = await issueCredentials(
        dateOfBirth,
        citizenship,
        userWallet.address
    );

    // Generate proof with soft constraints - should SUCCEED
    console.log(`  Generating proof with soft constraints...`);
    let proofData;
    try {
        proofData = await generateProofSoft(
            dobCredential,
            citizenshipCredential,
            userWallet
        );
        console.log(`  ✓ Proof generation succeeded (as expected with soft constraints)`);
    } catch (error) {
        throw new Error(`Proof generation failed unexpectedly with soft constraints: ${error.message}`);
    }

    // Verify proof structure (same as hard circuit - 9 signals)
    assert(
        proofData.publicSignals.length === 9,
        `Expected 9 public signals, got ${proofData.publicSignals.length}`
    );

    // Warp block timestamp
    const proofTimestamp = BigInt(proofData.publicSignals[0]);
    try {
        await provider.send('evm_mine', [Number(proofTimestamp)]);
    } catch {
        const currentBlock = await provider.getBlock('latest');
        const timeDiff = Number(proofTimestamp) - currentBlock.timestamp;
        if (timeDiff > 0) {
            await provider.send('evm_increaseTime', [timeDiff]);
            await provider.send('evm_mine', []);
        }
    }

    // Submit proof - should FAIL verification on-chain
    const contractWithWallet = ageVerificationContract.connect(userWallet);
    
    console.log(`  Submitting proof to contract...`);
    const result = await contractWithWallet.verifyProof(
        proofData.proof.a,
        proofData.proof.b,
        proofData.proof.c,
        proofData.publicSignals.map(s => BigInt(s))
    );

    console.log(`  Contract verification result: ${result} (false = rejected as expected)`);
    console.log(`  WHY IT FAILED: Groth16 proof verification mathematically fails`);
    console.log(`  The proof proves that constraints were NOT satisfied (citizenship != US)`);
    assert(
        result === false,
        'Expected on-chain verification to fail for wrong citizenship with soft constraints'
    );
}

/**
 * Test 11: Soft Constraints - Untrusted Issuer with Valid Data
 * 
 * This tests an attack where someone uses an unregistered issuer to sign credentials.
 * Even with valid age/citizenship data, the proof should fail because the issuer
 * is not in the trusted registry.
 * 
 * SECURITY QUESTION: Can an attacker reverse engineer the contract to forge credentials?
 * ANSWER: NO - The contract stores public keys, not private keys. You cannot derive
 * a private key from a public key (fundamental property of asymmetric cryptography).
 */
/**
 * Test soft constraints with valid data (happy path)
 * Proof should generate successfully AND pass on-chain verification
 * This confirms soft circuit works correctly for valid inputs
 */
async function testSoftConstraintsHappyPath() {
    // Valid user: 25 years old, US citizen
    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - 25);
    
    const dobCredential = await issueDOBCredential(
        Math.floor(dob.getTime() / 1000),
        issuerAPrivateKey,
        userWallet.address
    );
    
    const citizenshipCredential = await issueCitizenshipCredential(
        'US',
        issuerBPrivateKey,
        userWallet.address
    );
    
    // Generate proof with SOFT constraint circuit
    const proofData = await generateProofSoft(
        dobCredential,
        citizenshipCredential,
        userWallet
    );
    
    console.log(`  Generated soft constraint proof for valid user (25 years old, US)`);
    
    // Verify proof structure
    assert(
        proofData.publicSignals.length === 9,
        `Expected 9 public signals, got ${proofData.publicSignals.length}`
    );
    
    // Warp block timestamp
    const proofTimestamp = BigInt(proofData.publicSignals[0]);
    try {
        await provider.send('evm_mine', [Number(proofTimestamp)]);
    } catch {
        const currentBlock = await provider.getBlock('latest');
        const timeDiff = Number(proofTimestamp) - currentBlock.timestamp;
        if (timeDiff > 0) {
            await provider.send('evm_increaseTime', [timeDiff]);
            await provider.send('evm_mine', []);
        }
    }
    
    // Submit proof - should PASS verification
    const contractWithWallet = ageVerificationContract.connect(userWallet);
    
    console.log(`  Submitting proof to contract...`);
    const result = await contractWithWallet.verifyProof(
        proofData.proof.a,
        proofData.proof.b,
        proofData.proof.c,
        proofData.publicSignals.map(s => BigInt(s))
    );
    
    console.log(`  Contract verification result: ${result} (true = passed as expected)`);
    assert(
        result === true,
        'Expected on-chain verification to pass for valid user with soft constraints'
    );
}

/**
 * Test soft constraints with wrong wallet submission
 * Valid proof but submitted from wrong wallet address
 * Should fail because subject_wallet != msg.sender
 */
async function testSoftConstraintsWrongWallet() {
    // Valid user: 25 years old, US citizen, bound to userWallet
    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - 25);
    
    const dobCredential = await issueDOBCredential(
        Math.floor(dob.getTime() / 1000),
        issuerAPrivateKey,
        userWallet.address
    );
    
    const citizenshipCredential = await issueCitizenshipCredential(
        'US',
        issuerBPrivateKey,
        userWallet.address
    );
    
    // Generate proof with SOFT constraint circuit (bound to userWallet)
    const proofData = await generateProofSoft(
        dobCredential,
        citizenshipCredential,
        userWallet
    );
    
    console.log(`  Generated soft constraint proof bound to userWallet: ${userWallet.address}`);
    
    // Warp block timestamp
    const proofTimestamp = BigInt(proofData.publicSignals[0]);
    try {
        await provider.send('evm_mine', [Number(proofTimestamp)]);
    } catch {
        const currentBlock = await provider.getBlock('latest');
        const timeDiff = Number(proofTimestamp) - currentBlock.timestamp;
        if (timeDiff > 0) {
            await provider.send('evm_increaseTime', [timeDiff]);
            await provider.send('evm_mine', []);
        }
    }
    
    // Submit proof from DIFFERENT wallet (otherWallet instead of userWallet)
    const contractWithWrongWallet = ageVerificationContract.connect(otherWallet);
    
    console.log(`  Submitting proof from wrong wallet: ${otherWallet.address}`);
    const result = await contractWithWrongWallet.verifyProof(
        proofData.proof.a,
        proofData.proof.b,
        proofData.proof.c,
        proofData.publicSignals.map(s => BigInt(s))
    );
    
    console.log(`  Contract verification result: ${result} (false = rejected as expected)`);
    console.log(`  WHY IT FAILED: subject_wallet (${userWallet.address}) != msg.sender (${otherWallet.address})`);
    assert(
        result === false,
        'Expected on-chain verification to fail when submitting from wrong wallet'
    );
}

/**
 * Test soft constraints with exactly 18 years old (boundary case)
 * Should generate proof and pass verification
 */
async function testSoftConstraintsExactly18() {
    // User exactly 18 years old
    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - 18);
    
    const dobCredential = await issueDOBCredential(
        Math.floor(dob.getTime() / 1000),
        issuerAPrivateKey,
        userWallet.address
    );
    
    const citizenshipCredential = await issueCitizenshipCredential(
        'US',
        issuerBPrivateKey,
        userWallet.address
    );
    
    // Generate proof with SOFT constraint circuit
    const proofData = await generateProofSoft(
        dobCredential,
        citizenshipCredential,
        userWallet
    );
    
    console.log(`  Generated soft constraint proof for exactly 18 years old user`);
    
    // Warp block timestamp
    const proofTimestamp = BigInt(proofData.publicSignals[0]);
    try {
        await provider.send('evm_mine', [Number(proofTimestamp)]);
    } catch {
        const currentBlock = await provider.getBlock('latest');
        const timeDiff = Number(proofTimestamp) - currentBlock.timestamp;
        if (timeDiff > 0) {
            await provider.send('evm_increaseTime', [timeDiff]);
            await provider.send('evm_mine', []);
        }
    }
    
    // Submit proof - should PASS
    const contractWithWallet = ageVerificationContract.connect(userWallet);
    
    console.log(`  Submitting proof to contract...`);
    const result = await contractWithWallet.verifyProof(
        proofData.proof.a,
        proofData.proof.b,
        proofData.proof.c,
        proofData.publicSignals.map(s => BigInt(s))
    );
    
    console.log(`  Contract verification result: ${result} (true = passed as expected)`);
    assert(
        result === true,
        'Expected on-chain verification to pass for exactly 18 years old with soft constraints'
    );
}

async function testSoftConstraintsUntrustedIssuer() {
    const secp256k1 = require('@noble/secp256k1');
    
    // Create valid data (18+ and US)
    const dateOfBirth = BigInt(Math.floor(new Date('2000-01-01').getTime() / 1000));
    const citizenship = 'US';

    console.log('\n  [Untrusted Issuer Attack]');
    console.log(`  Testing with UNTRUSTED (unregistered) issuer signing VALID data`);
    console.log(`  Can attacker reverse engineer addTrustedIssuer() calls to forge credentials? NO!`);

    // Generate a random untrusted issuer key
    const untrustedIssuerKey = secp256k1.utils.randomPrivateKey();
    const untrustedPubkey = secp256k1.getPublicKey(untrustedIssuerKey, false);
    const untrustedPubkeyX = BigInt('0x' + Buffer.from(untrustedPubkey.slice(1, 33)).toString('hex'));
    
    console.log(`  Untrusted issuer X: ${untrustedPubkeyX.toString().slice(0, 20)}...`);
    console.log(`  This issuer is NOT registered on-chain`);

    const userPubkey = BigInt(userWallet.address);
    const nonceA = BigInt(Math.floor(Math.random() * 2**48));
    const nonceB = BigInt(Math.floor(Math.random() * 2**48));

    // Issue credentials from untrusted issuer
    const dobCredential = await issueDOBCredential(
        dateOfBirth,
        userPubkey,
        nonceA,
        untrustedIssuerKey // UNTRUSTED ISSUER
    );

    const citizenshipCredential = await issueCitizenshipCredential(
        citizenship,
        userPubkey,
        nonceB,
        issuerBPrivateKey // Keep issuerB trusted
    );

    // Generate proof with soft constraints - should SUCCEED
    console.log(`  Generating proof with untrusted issuer...`);
    let proofData;
    try {
        proofData = await generateProofSoft(
            dobCredential,
            citizenshipCredential,
            userWallet
        );
        console.log(`  ✓ Proof generation succeeded (circuit doesn't check registry)`);
    } catch (error) {
        throw new Error(`Proof generation failed: ${error.message}`);
    }

    // Warp block timestamp
    const proofTimestamp = BigInt(proofData.publicSignals[0]);
    try {
        await provider.send('evm_mine', [Number(proofTimestamp)]);
    } catch {
        const currentBlock = await provider.getBlock('latest');
        const timeDiff = Number(proofTimestamp) - currentBlock.timestamp;
        if (timeDiff > 0) {
            await provider.send('evm_increaseTime', [timeDiff]);
            await provider.send('evm_mine', []);
        }
    }

    // Verify proof structure (same as hard circuit - 9 signals)
    assert(
        proofData.publicSignals.length === 9,
        `Expected 9 public signals, got ${proofData.publicSignals.length}`
    );

    // Submit proof - should FAIL because issuer not in registry
    const contractWithWallet = ageVerificationContract.connect(userWallet);
    
    console.log(`  Submitting proof to contract...`);
    const result = await contractWithWallet.verifyProof(
        proofData.proof.a,
        proofData.proof.b,
        proofData.proof.c,
        proofData.publicSignals.map(s => BigInt(s))
    );

    console.log(`  Contract verification result: ${result} (false = rejected as expected)`);
    console.log(`  WHY IT FAILED: Contract checks issuer public key against registry`);
    console.log(`  Untrusted issuer's public key is not in trustedIssuerA mapping`);
    console.log(`  `);
    console.log(`  SECURITY NOTE: Can attacker observe addTrustedIssuerA() and extract private key?`);
    console.log(`  NO - Transaction only contains PUBLIC KEY (X, Y coordinates)`);
    console.log(`  Private key NEVER leaves issuer's system`);
    console.log(`  Deriving private key from public key is computationally infeasible (ECDSA security)`);
    
    assert(
        result === false,
        'Expected on-chain verification to fail for untrusted issuer'
    );
}

// ============================================
// MAIN TEST RUNNER
// ============================================

async function runAllTests() {
    try {
        // Setup
        const { softCircuitExists } = await setup();
        await deployContracts();
        await registerIssuers();

        console.log('Running tests...\n');

        // Run hard constraint test cases
        console.log('Hard Constraint Tests:\n');
        await runTest('Happy Path - Valid 18+ US Citizen', testHappyPath);
        await runTest('Failure - Underage User (17 years old)', testUnderageUser);
        await runTest('Failure - Wrong Citizenship (CA)', testWrongCitizenship);
        await runTest('Failure - Wrong Wallet Submission', testWrongWalletSubmission);
        await runTest('Failure - Untrusted Issuer', testUntrustedIssuer);
        await runTest('Boundary - Exactly 18 Years Old', testExactly18YearsOld);
        await runTest('Contract State - Remove Issuer', testRemoveIssuer);
        await runTest('Access Control - Only Owner Can Add Issuers', testOnlyOwnerCanAddIssuers);

        // Run soft constraint test cases (if available)
        if (softCircuitExists) {
            console.log('\nSoft Constraint Tests:\n');
            await runTest('Soft - Happy Path (Valid 25+ US Citizen)', testSoftConstraintsHappyPath);
            await runTest('Soft - Boundary (Exactly 18 Years Old)', testSoftConstraintsExactly18);
            await runTest('Soft - Failure: Underage Generates Proof but Fails Verification', testSoftConstraintsUnderageFailsVerification);
            await runTest('Soft - Failure: Wrong Citizenship Generates Proof but Fails Verification', testSoftConstraintsWrongCitizenshipFailsVerification);
            await runTest('Soft - Failure: Wrong Wallet Submission', testSoftConstraintsWrongWallet);
            await runTest('Soft - Failure: Untrusted Issuer (Valid Data, Unregistered Key)', testSoftConstraintsUntrustedIssuer);
        } else {
            console.log('\n⚠️  Skipping soft constraint tests (circuit not compiled)');
            console.log('   To enable: compile soft circuit and run trusted setup (see docs/SOFT_CONSTRAINTS.md)\n');
        }

        // Print summary
        console.log('\n========================================');
        console.log('            TEST SUMMARY');
        console.log('========================================\n');
        console.log(`  Total:  ${testResults.passed + testResults.failed}`);
        console.log(`  \x1b[32mPassed: ${testResults.passed}\x1b[0m`);
        console.log(`  \x1b[31mFailed: ${testResults.failed}\x1b[0m`);

        if (testResults.errors.length > 0) {
            console.log('\n  Failed Tests:');
            testResults.errors.forEach(({ name, error }) => {
                console.log(`    - ${name}`);
                console.log(`      ${error}`);
            });
        }

        console.log('\n========================================\n');

        process.exit(testResults.failed > 0 ? 1 : 0);

    } catch (error) {
        console.error('\n\x1b[31mTest suite setup failed:\x1b[0m');
        console.error(error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run tests
runAllTests();
