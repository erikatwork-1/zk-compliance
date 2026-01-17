#!/usr/bin/env node

/**
 * Proof Generation Script
 * 
 * This script generates a zero-knowledge proof that proves:
 * 1. The user has a valid DOB credential from Issuer A
 * 2. The user has a valid citizenship credential from Issuer B
 * 3. The user is 18+ years old
 * 4. The user is a US citizen
 * 
 * All without revealing the actual date of birth or other personal information.
 */

const snarkjs = require('snarkjs');
const fs = require('fs');
const path = require('path');

const CIRCUIT_NAME = 'age_citizenship';
const BUILD_DIR = path.join(__dirname, '../../build');
const CREDENTIALS_DIR = path.join(__dirname, '../../credentials');

/**
 * Encode citizenship string as a field element
 */
function encodeCitizenship(citizenship) {
    let encoded = BigInt(0);
    for (let i = 0; i < citizenship.length; i++) {
        encoded = encoded * BigInt(256) + BigInt(citizenship.charCodeAt(i));
    }
    return encoded;
}

/**
 * Generate zero-knowledge proof
 */
async function generateProof(dobCredential, citizenshipCredential, currentDate, minAge) {
    console.log('🔐 Generating Zero-Knowledge Proof...\n');
    
    // Check if circuit files exist
    // WASM is generated in a subdirectory by circom
    const wasmPath = path.join(BUILD_DIR, `${CIRCUIT_NAME}_js`, `${CIRCUIT_NAME}.wasm`);
    const zkeyPath = path.join(BUILD_DIR, `${CIRCUIT_NAME}_final.zkey`);
    
    if (!fs.existsSync(wasmPath)) {
        throw new Error(`WASM file not found: ${wasmPath}\nPlease compile the circuit first: npm run compile:circuit`);
    }
    
    if (!fs.existsSync(zkeyPath)) {
        throw new Error(`ZKey file not found: ${zkeyPath}\nPlease run trusted setup first: npm run setup`);
    }
    
    // Prepare private inputs
    const dateOfBirth = BigInt(dobCredential.dateOfBirth);
    const citizenship = encodeCitizenship(citizenshipCredential.citizenship);
    const signatureAR = BigInt(dobCredential.signature.r);
    const signatureAS = BigInt(dobCredential.signature.s);
    const signatureBR = BigInt(citizenshipCredential.signature.r);
    const signatureBS = BigInt(citizenshipCredential.signature.s);
    const nonceA = BigInt(dobCredential.nonce);
    const nonceB = BigInt(citizenshipCredential.nonce);
    
    // Verify that both credentials belong to the same user
    const userPubkey = BigInt(dobCredential.userPubkey);
    if (userPubkey.toString() !== citizenshipCredential.userPubkey) {
        throw new Error('Credentials do not belong to the same user!');
    }
    
    // Prepare public inputs
    const currentDateInput = BigInt(Math.floor(currentDate.getTime() / 1000));
    const minAgeInput = BigInt(minAge);
    const requiredCitizenship = encodeCitizenship('US');
    const issuerAPubkeyX = BigInt(dobCredential.issuerPubkey.x);
    const issuerAPubkeyY = BigInt(dobCredential.issuerPubkey.y);
    const issuerBPubkeyX = BigInt(citizenshipCredential.issuerPubkey.x);
    const issuerBPubkeyY = BigInt(citizenshipCredential.issuerPubkey.y);
    const subjectWalletEnv = process.env.SUBJECT_WALLET;
    const subjectWallet = subjectWalletEnv ? BigInt(subjectWalletEnv) : userPubkey;
    if (subjectWallet !== userPubkey) {
        throw new Error('SUBJECT_WALLET does not match credential userPubkey.');
    }
    const userPubkeyInput = userPubkey;
    
    // Calculate age to verify it's >= 18
    const ageInSeconds = currentDateInput - dateOfBirth;
    const ageInYears = Number(ageInSeconds) / 31557600; // Seconds in a year
    
    if (ageInYears < minAge) {
        throw new Error(`User is only ${ageInYears.toFixed(2)} years old, but minimum age is ${minAge}`);
    }
    
    console.log('📋 Proof Inputs:');
    console.log(`   Date of Birth: ${new Date(Number(dateOfBirth) * 1000).toISOString()}`);
    console.log(`   Current Date: ${currentDate.toISOString()}`);
    console.log(`   Age: ${ageInYears.toFixed(2)} years`);
    console.log(`   Citizenship: ${citizenshipCredential.citizenship}`);
    console.log(`   Min Age Required: ${minAge}\n`);
    
    // Prepare circuit inputs
    const input = {
        // Private inputs
        date_of_birth: dateOfBirth.toString(),
        citizenship: citizenship.toString(),
        signature_a_r: signatureAR.toString(),
        signature_a_s: signatureAS.toString(),
        signature_b_r: signatureBR.toString(),
        signature_b_s: signatureBS.toString(),
        nonce_a: nonceA.toString(),
        nonce_b: nonceB.toString(),
        
        // Public inputs
        current_date: currentDateInput.toString(),
        min_age: minAgeInput.toString(),
        required_citizenship: requiredCitizenship.toString(),
        issuer_a_pubkey_x: issuerAPubkeyX.toString(),
        issuer_a_pubkey_y: issuerAPubkeyY.toString(),
        issuer_b_pubkey_x: issuerBPubkeyX.toString(),
        issuer_b_pubkey_y: issuerBPubkeyY.toString(),
        user_pubkey: userPubkeyInput.toString(),
        subject_wallet: subjectWallet.toString()
    };
    
    console.log('🔧 Computing witness...');
    // Debug: print all input values
    console.log(`   DEBUG Input values:`);
    console.log(`     current_date:        ${input.current_date}`);
    console.log(`     issuer_a_pubkey_x:   ${input.issuer_a_pubkey_x}`);
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        input,
        wasmPath,
        zkeyPath
    );
    console.log(`   DEBUG Public signals:`);
    console.log(`     [0] current_date:    ${publicSignals[0]}`);
    console.log(`     [3] issuer_a_pubkey: ${publicSignals[3]}`);
    console.log(`   Match[0]: ${input.current_date === publicSignals[0]}`);
    console.log(`   Match[3]: ${input.issuer_a_pubkey_x === publicSignals[3]}`);
    
    console.log('✅ Proof generated successfully!\n');
    
    // Format proof for Solidity
    const calldata = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
    const calldataObj = JSON.parse('[' + calldata + ']');
    
    const formattedProof = {
        a: [proof.pi_a[0], proof.pi_a[1]],
        b: [[proof.pi_b[0][1], proof.pi_b[0][0]], [proof.pi_b[1][1], proof.pi_b[1][0]]],
        c: [proof.pi_c[0], proof.pi_c[1]],
        publicSignals: publicSignals.map(s => s.toString())
    };
    
    return {
        proof: formattedProof,
        publicSignals: publicSignals.map(s => s.toString()),
        calldata: calldataObj,
        input: input
    };
}

/**
 * Main function
 */
async function main() {
    console.log('🎫 Zero-Knowledge Proof Generation');
    console.log('===================================\n');
    
    // Load credentials
    const dobCredentialPath = path.join(CREDENTIALS_DIR, 'dob_credential.json');
    const citizenshipCredentialPath = path.join(CREDENTIALS_DIR, 'citizenship_credential.json');
    
    if (!fs.existsSync(dobCredentialPath)) {
        throw new Error(`DOB credential not found: ${dobCredentialPath}\nPlease issue a DOB credential first: npm run issuer:a`);
    }
    
    if (!fs.existsSync(citizenshipCredentialPath)) {
        throw new Error(`Citizenship credential not found: ${citizenshipCredentialPath}\nPlease issue a citizenship credential first: npm run issuer:b`);
    }
    
    const dobCredential = JSON.parse(fs.readFileSync(dobCredentialPath, 'utf8'));
    const citizenshipCredential = JSON.parse(fs.readFileSync(citizenshipCredentialPath, 'utf8'));
    
    console.log('✅ Credentials loaded\n');
    
    // Get current date and minimum age
    const currentDate = new Date();
    const minAge = 18;
    
    // Generate proof
    const proofData = await generateProof(
        dobCredential,
        citizenshipCredential,
        currentDate,
        minAge
    );
    
    // Save proof to file
    const proofPath = path.join(CREDENTIALS_DIR, 'proof.json');
    fs.writeFileSync(proofPath, JSON.stringify(proofData, null, 2));
    
    console.log('📁 Proof saved to:', proofPath);
    console.log('\n📊 Proof Summary:');
    console.log(`   Public Signals: ${proofData.publicSignals.length} values`);
    console.log(`   Proof Components: a, b, c`);
    console.log('\n✅ Ready to submit to smart contract!');
    
    return proofData;
}

// Run if called directly
if (require.main === module) {
    main().catch(error => {
        console.error('\n❌ Error:', error.message);
        process.exit(1);
    });
}

module.exports = { generateProof, encodeCitizenship, main };
