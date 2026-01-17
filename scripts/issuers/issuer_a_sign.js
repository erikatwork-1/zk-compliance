#!/usr/bin/env node

/**
 * Issuer A Script - DOB Credential Issuance
 * 
 * This script simulates Issuer A (e.g., DMV) issuing a date of birth credential.
 * In production, this would be done by a trusted authority with proper authentication.
 */

const secp256k1 = require('@noble/secp256k1');
const { hmac } = require('@noble/hashes/hmac');
const { sha256 } = require('@noble/hashes/sha256');
const { buildPoseidon } = require('circomlibjs');
const { HDNodeWallet } = require('ethers');
const fs = require('fs');
const path = require('path');

// Configure secp256k1 to use @noble/hashes for HMAC
secp256k1.etc.hmacSha256Sync = (k, ...m) => hmac(sha256, k, secp256k1.etc.concatBytes(...m));

const { sign, getPublicKey, utils } = secp256k1;

let poseidon = null;
const GANACHE_DETERMINISTIC_MNEMONIC =
    'myth like bonus scare over problem client lizard pioneer submit female collect';
const BN254_SCALAR_FIELD = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');

async function initPoseidon() {
    if (!poseidon) {
        poseidon = await buildPoseidon();
    }
    return poseidon;
}

function reduceModR(value) {
    return BigInt(value) % BN254_SCALAR_FIELD;
}

function getGanacheDeterministicPrivateKey(accountIndex) {
    const mnemonic = process.env.GANACHE_MNEMONIC || GANACHE_DETERMINISTIC_MNEMONIC;
    const hdNode = HDNodeWallet.fromPhrase(mnemonic, undefined, "m/44'/60'/0'/0");
    const wallet = hdNode.derivePath(String(accountIndex));
    return wallet.privateKey;
}

/**
 * Generate a credential for date of birth
 * @param {bigint} dateOfBirth - Unix timestamp of date of birth
 * @param {bigint} userPubkey - User's public key (field element)
 * @param {bigint} nonce - Random nonce for this credential
 * @param {Uint8Array} issuerPrivateKey - Issuer's private key
 * @returns {Object} Signed credential
 */
async function issueDOBCredential(dateOfBirth, userPubkey, nonce, issuerPrivateKey) {
    // Initialize poseidon
    const poseidonHash = await initPoseidon();

    // Create credential message: Poseidon hash of (dob, userPubkey, nonce)
    const messageHashBytes = poseidonHash([dateOfBirth, userPubkey, nonce]);
    const messageHash = poseidonHash.F.toString(messageHashBytes);
    
    // Sign the message hash using ECDSA
    const messageBytes = new Uint8Array(32);
    const messageBigInt = BigInt(messageHash.toString());
    for (let i = 0; i < 32; i++) {
        messageBytes[31 - i] = Number((messageBigInt >> BigInt(i * 8)) & BigInt(0xff));
    }
    
    const signature = await sign(messageBytes, issuerPrivateKey);
    // In @noble/secp256k1 v2.x, signature.r and signature.s are bigints
    const signatureR = signature.r;
    const signatureS = signature.s;

    // Get issuer's public key (uncompressed: 65 bytes, first byte is 0x04)
    const issuerPubkey = getPublicKey(issuerPrivateKey, false);
    const rawIssuerPubkeyX = BigInt('0x' + Buffer.from(issuerPubkey.slice(1, 33)).toString('hex'));
    const rawIssuerPubkeyY = BigInt('0x' + Buffer.from(issuerPubkey.slice(33, 65)).toString('hex'));
    const issuerPubkeyX = reduceModR(rawIssuerPubkeyX);
    const issuerPubkeyY = reduceModR(rawIssuerPubkeyY);
    
    return {
        credentialType: 'date_of_birth',
        dateOfBirth: dateOfBirth.toString(),
        userPubkey: userPubkey.toString(),
        nonce: nonce.toString(),
        signature: {
            r: signatureR.toString(),
            s: signatureS.toString()
        },
        issuerPubkey: {
            x: issuerPubkeyX.toString(),
            y: issuerPubkeyY.toString()
        },
        timestamp: Date.now(),
        issuer: 'Issuer A (DMV)'
    };
}

/**
 * Main function
 */
async function main() {
    console.log('🏛️  Issuer A - DOB Credential Issuance');
    console.log('=======================================\n');
    
    // Generate or load issuer private key
    const issuerKeyPath = path.join(__dirname, '../../.issuer_a_key.json');
    let issuerPrivateKey;
    let issuerKeyData;
    
    if (fs.existsSync(issuerKeyPath)) {
        issuerKeyData = JSON.parse(fs.readFileSync(issuerKeyPath, 'utf8'));
        issuerPrivateKey = new Uint8Array(Buffer.from(issuerKeyData.privateKey, 'hex'));
        console.log('✅ Loaded existing Issuer A key');
    } else {
        const useRandomKeys = process.env.ISSUER_KEYS_RANDOM === 'true';
        if (useRandomKeys) {
            // Generate new key pair
            issuerPrivateKey = utils.randomPrivateKey();
            console.log('✅ Generated new Issuer A key pair (random)');
        } else {
            // Default to Ganache deterministic account #1 (second address)
            const ganachePrivateKey = getGanacheDeterministicPrivateKey(1);
            issuerPrivateKey = new Uint8Array(Buffer.from(ganachePrivateKey.slice(2), 'hex'));
            console.log('✅ Derived Issuer A key from Ganache account #1 (index 1)');
        }
        const issuerPubkey = getPublicKey(issuerPrivateKey, false); // uncompressed (65 bytes)
        issuerKeyData = {
            privateKey: Buffer.from(issuerPrivateKey).toString('hex'),
            publicKey: {
                x: reduceModR(BigInt('0x' + Buffer.from(issuerPubkey.slice(1, 33)).toString('hex'))).toString(),
                y: reduceModR(BigInt('0x' + Buffer.from(issuerPubkey.slice(33, 65)).toString('hex'))).toString()
            }
        };
        fs.writeFileSync(issuerKeyPath, JSON.stringify(issuerKeyData, null, 2));
        console.log('⚠️  WARNING: Keep this key secure!');
    }
    
    console.log(`\n📋 Issuer A Public Key:`);
    console.log(`   X: ${issuerKeyData.publicKey.x}`);
    console.log(`   Y: ${issuerKeyData.publicKey.y}\n`);
    
    // Get user input (in production, this would come from authenticated user)
    const args = process.argv.slice(2);
    let dateOfBirth, userPubkey, nonce;
    
    if (args.length >= 3) {
        // Command line arguments provided
        dateOfBirth = BigInt(args[0]);
        userPubkey = BigInt(args[1]);
        nonce = BigInt(args[2]);
    } else {
        // Use example values for demo
        console.log('📝 Using example values for demo...\n');
        // Example: Born on Jan 1, 2000 (18+ years old)
        dateOfBirth = BigInt(Math.floor(new Date('2000-01-01').getTime() / 1000));
        if (process.env.SUBJECT_WALLET) {
            userPubkey = BigInt(process.env.SUBJECT_WALLET);
        } else {
            userPubkey = BigInt('1234567890123456789012345678901234567890123456789012345678901234');
        }
        nonce = BigInt(Math.floor(Math.random() * 2**64));
    }
    
    // Issue credential
    console.log('🔏 Signing credential...');
    const credential = await issueDOBCredential(
        dateOfBirth,
        userPubkey,
        nonce,
        issuerPrivateKey
    );
    
    // Save credential to file
    const credentialsDir = path.join(__dirname, '../../credentials');
    if (!fs.existsSync(credentialsDir)) {
        fs.mkdirSync(credentialsDir, { recursive: true });
    }
    
    const credentialPath = path.join(credentialsDir, 'dob_credential.json');
    fs.writeFileSync(credentialPath, JSON.stringify(credential, null, 2));
    
    console.log('✅ Credential issued and saved!');
    console.log(`📁 Location: ${credentialPath}\n`);
    console.log('📄 Credential Details:');
    console.log(JSON.stringify(credential, null, 2));
    
    return credential;
}

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { issueDOBCredential, main };
