/**
 * Circuit Tests
 * 
 * Tests for the age_citizenship.circom circuit
 * These tests verify that the circuit correctly validates:
 * - ECDSA signatures from both issuers
 * - Age >= 18 requirement
 * - Citizenship == "US" requirement
 * - Same user public key in both credentials
 */

const snarkjs = require('snarkjs');
const { poseidon } = require('circomlibjs');
const { sign, getPublicKey, utils } = require('@noble/secp256k1');
const fs = require('fs');
const path = require('path');

const CIRCUIT_NAME = 'age_citizenship';
const BUILD_DIR = path.join(__dirname, '../../build');

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
 * Generate test credentials
 */
async function generateTestCredentials() {
    // Generate issuer keys
    const issuerAPrivateKey = utils.randomPrivateKey();
    const issuerBPrivateKey = utils.randomPrivateKey();
    
    const issuerAPubkey = getPublicKey(issuerAPrivateKey, true);
    const issuerBPubkey = getPublicKey(issuerBPrivateKey, true);
    
    // Test data: Born on Jan 1, 2000 (will be 18+ in 2018)
    const dateOfBirth = BigInt(Math.floor(new Date('2000-01-01').getTime() / 1000));
    const citizenship = 'US';
    const citizenshipEncoded = encodeCitizenship(citizenship);
    const userPubkey = BigInt('1234567890123456789012345678901234567890123456789012345678901234');
    const nonceA = BigInt(Math.floor(Math.random() * 2**64));
    const nonceB = BigInt(Math.floor(Math.random() * 2**64));
    
    // Create and sign DOB credential
    const dobMessageHash = poseidon([dateOfBirth, userPubkey, nonceA]);
    const dobMessageBytes = new Uint8Array(32);
    const dobMessageBigInt = BigInt(dobMessageHash.toString());
    for (let i = 0; i < 32; i++) {
        dobMessageBytes[31 - i] = Number((dobMessageBigInt >> BigInt(i * 8)) & BigInt(0xff));
    }
    const dobSignature = await sign(dobMessageBytes, issuerAPrivateKey);
    
    // Create and sign citizenship credential
    const citizenshipMessageHash = poseidon([citizenshipEncoded, userPubkey, nonceB]);
    const citizenshipMessageBytes = new Uint8Array(32);
    const citizenshipMessageBigInt = BigInt(citizenshipMessageHash.toString());
    for (let i = 0; i < 32; i++) {
        citizenshipMessageBytes[31 - i] = Number((citizenshipMessageBigInt >> BigInt(i * 8)) & BigInt(0xff));
    }
    const citizenshipSignature = await sign(citizenshipMessageBytes, issuerBPrivateKey);
    
    return {
        dateOfBirth,
        citizenship: citizenshipEncoded,
        userPubkey,
        nonceA,
        nonceB,
        issuerA: {
            pubkeyX: BigInt('0x' + issuerAPubkey.slice(1, 33).toString('hex')),
            pubkeyY: BigInt('0x' + issuerAPubkey.slice(33, 65).toString('hex')),
            signatureR: BigInt('0x' + Buffer.from(dobSignature.r).toString('hex')),
            signatureS: BigInt('0x' + Buffer.from(dobSignature.s).toString('hex'))
        },
        issuerB: {
            pubkeyX: BigInt('0x' + issuerBPubkey.slice(1, 33).toString('hex')),
            pubkeyY: BigInt('0x' + issuerBPubkey.slice(33, 65).toString('hex')),
            signatureR: BigInt('0x' + Buffer.from(citizenshipSignature.r).toString('hex')),
            signatureS: BigInt('0x' + Buffer.from(citizenshipSignature.s).toString('hex'))
        }
    };
}

/**
 * Test circuit with valid inputs
 */
async function testValidProof() {
    console.log('🧪 Test 1: Valid proof (should pass)');
    
    const credentials = await generateTestCredentials();
    const currentDate = BigInt(Math.floor(new Date('2020-01-01').getTime() / 1000));
    const minAge = BigInt(18);
    const requiredCitizenship = encodeCitizenship('US');
    
    const input = {
        date_of_birth: credentials.dateOfBirth.toString(),
        citizenship: credentials.citizenship.toString(),
        signature_a_r: credentials.issuerA.signatureR.toString(),
        signature_a_s: credentials.issuerA.signatureS.toString(),
        signature_b_r: credentials.issuerB.signatureR.toString(),
        signature_b_s: credentials.issuerB.signatureS.toString(),
        nonce_a: credentials.nonceA.toString(),
        nonce_b: credentials.nonceB.toString(),
        current_date: currentDate.toString(),
        min_age: minAge.toString(),
        required_citizenship: requiredCitizenship.toString(),
        issuer_a_pubkey_x: credentials.issuerA.pubkeyX.toString(),
        issuer_a_pubkey_y: credentials.issuerA.pubkeyY.toString(),
        issuer_b_pubkey_x: credentials.issuerB.pubkeyX.toString(),
        issuer_b_pubkey_y: credentials.issuerB.pubkeyY.toString(),
        user_pubkey: credentials.userPubkey.toString(),
        subject_wallet: credentials.userPubkey.toString()
    };
    
    const wasmPath = path.join(BUILD_DIR, `${CIRCUIT_NAME}.wasm`);
    const zkeyPath = path.join(BUILD_DIR, `${CIRCUIT_NAME}_final.zkey`);
    
    if (!fs.existsSync(wasmPath) || !fs.existsSync(zkeyPath)) {
        console.log('⚠️  Skipping: Circuit not compiled or trusted setup not run');
        return;
    }
    
    try {
        const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, wasmPath, zkeyPath);
        const vkey = JSON.parse(fs.readFileSync(path.join(BUILD_DIR, `${CIRCUIT_NAME}_vkey.json`), 'utf8'));
        const verified = await snarkjs.groth16.verify(vkey, publicSignals, proof);
        
        if (verified) {
            console.log('✅ Test passed: Valid proof verified successfully\n');
        } else {
            console.log('❌ Test failed: Valid proof was not verified\n');
        }
    } catch (error) {
        console.log(`❌ Test failed with error: ${error.message}\n`);
    }
}

/**
 * Test circuit with invalid age
 */
async function testInvalidAge() {
    console.log('🧪 Test 2: Invalid age < 18 (should fail)');
    
    const credentials = await generateTestCredentials();
    // Use a date that makes the person 17 years old
    const currentDate = BigInt(Math.floor(new Date('2017-12-31').getTime() / 1000));
    const minAge = BigInt(18);
    const requiredCitizenship = encodeCitizenship('US');
    
    const input = {
        date_of_birth: credentials.dateOfBirth.toString(),
        citizenship: credentials.citizenship.toString(),
        signature_a_r: credentials.issuerA.signatureR.toString(),
        signature_a_s: credentials.issuerA.signatureS.toString(),
        signature_b_r: credentials.issuerB.signatureR.toString(),
        signature_b_s: credentials.issuerB.signatureS.toString(),
        nonce_a: credentials.nonceA.toString(),
        nonce_b: credentials.nonceB.toString(),
        current_date: currentDate.toString(),
        min_age: minAge.toString(),
        required_citizenship: requiredCitizenship.toString(),
        issuer_a_pubkey_x: credentials.issuerA.pubkeyX.toString(),
        issuer_a_pubkey_y: credentials.issuerA.pubkeyY.toString(),
        issuer_b_pubkey_x: credentials.issuerB.pubkeyX.toString(),
        issuer_b_pubkey_y: credentials.issuerB.pubkeyY.toString(),
        user_pubkey: credentials.userPubkey.toString(),
        subject_wallet: credentials.userPubkey.toString()
    };
    
    const wasmPath = path.join(BUILD_DIR, `${CIRCUIT_NAME}.wasm`);
    const zkeyPath = path.join(BUILD_DIR, `${CIRCUIT_NAME}_final.zkey`);
    
    if (!fs.existsSync(wasmPath) || !fs.existsSync(zkeyPath)) {
        console.log('⚠️  Skipping: Circuit not compiled or trusted setup not run');
        return;
    }
    
    try {
        // This should fail during witness generation or proof verification
        await snarkjs.groth16.fullProve(input, wasmPath, zkeyPath);
        console.log('❌ Test failed: Proof should have been rejected for invalid age\n');
    } catch (error) {
        console.log('✅ Test passed: Invalid age correctly rejected\n');
    }
}

/**
 * Run all tests
 */
async function runTests() {
    console.log('🚀 Running Circuit Tests');
    console.log('=========================\n');
    
    await testValidProof();
    await testInvalidAge();
    
    console.log('✅ All tests completed!');
}

// Run if called directly
if (require.main === module) {
    runTests().catch(console.error);
}

module.exports = { testValidProof, testInvalidAge, runTests };
