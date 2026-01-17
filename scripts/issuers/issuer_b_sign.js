#!/usr/bin/env node

/**
 * Issuer B Script - Citizenship Credential Issuance
 * 
 * This script simulates Issuer B (e.g., Immigration) issuing a citizenship credential.
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
 * Encode citizenship string as a field element
 * @param {string} citizenship - Citizenship string (e.g., "US")
 * @returns {bigint} Field element representation
 */
function encodeCitizenship(citizenship) {
    // Simple encoding: convert string to bigint
    // In production, use a more robust encoding scheme
    let encoded = BigInt(0);
    for (let i = 0; i < citizenship.length; i++) {
        encoded = encoded * BigInt(256) + BigInt(citizenship.charCodeAt(i));
    }
    return encoded;
}

/**
 * Generate a credential for citizenship
 * @param {string} citizenship - Citizenship string (e.g., "US")
 * @param {bigint} userPubkey - User's public key (field element)
 * @param {bigint} nonce - Random nonce for this credential
 * @param {Uint8Array} issuerPrivateKey - Issuer's private key
 * @returns {Object} Signed credential
 */
async function issueCitizenshipCredential(citizenship, userPubkey, nonce, issuerPrivateKey) {
    // Initialize poseidon
    const poseidonHash = await initPoseidon();

    // Encode citizenship as field element
    const citizenshipEncoded = encodeCitizenship(citizenship);

    // Create credential message: Poseidon hash of (citizenship, userPubkey, nonce)
    const messageHashBytes = poseidonHash([citizenshipEncoded, userPubkey, nonce]);
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
        credentialType: 'citizenship',
        citizenship: citizenship,
        citizenshipEncoded: citizenshipEncoded.toString(),
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
        issuer: 'Issuer B (Immigration)'
    };
}

/**
 * Main function
 */
async function main() {
    console.log('🏛️  Issuer B - Citizenship Credential Issuance');
    console.log('===============================================\n');
    
    // Generate or load issuer private key
    const issuerKeyPath = path.join(__dirname, '../../.issuer_b_key.json');
    let issuerPrivateKey;
    let issuerKeyData;
    
    if (fs.existsSync(issuerKeyPath)) {
        issuerKeyData = JSON.parse(fs.readFileSync(issuerKeyPath, 'utf8'));
        issuerPrivateKey = new Uint8Array(Buffer.from(issuerKeyData.privateKey, 'hex'));
        console.log('✅ Loaded existing Issuer B key');
    } else {
        const useRandomKeys = process.env.ISSUER_KEYS_RANDOM === 'true';
        if (useRandomKeys) {
            // Generate new key pair
            issuerPrivateKey = utils.randomPrivateKey();
            console.log('✅ Generated new Issuer B key pair (random)');
        } else {
            // Default to Ganache deterministic account #2 (third address)
            const ganachePrivateKey = getGanacheDeterministicPrivateKey(2);
            issuerPrivateKey = new Uint8Array(Buffer.from(ganachePrivateKey.slice(2), 'hex'));
            console.log('✅ Derived Issuer B key from Ganache account #2 (index 2)');
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
    
    console.log(`\n📋 Issuer B Public Key:`);
    console.log(`   X: ${issuerKeyData.publicKey.x}`);
    console.log(`   Y: ${issuerKeyData.publicKey.y}\n`);
    
    // Get user input (in production, this would come from authenticated user)
    const args = process.argv.slice(2);
    let citizenship, userPubkey, nonce;
    
    if (args.length >= 3) {
        // Command line arguments provided
        citizenship = args[0];
        userPubkey = BigInt(args[1]);
        nonce = BigInt(args[2]);
    } else {
        // Use example values for demo
        console.log('📝 Using example values for demo...\n');
        citizenship = 'US';
        if (process.env.SUBJECT_WALLET) {
            userPubkey = BigInt(process.env.SUBJECT_WALLET);
        } else {
            userPubkey = BigInt('1234567890123456789012345678901234567890123456789012345678901234');
        }
        nonce = BigInt(Math.floor(Math.random() * 2**64));
    }
    
    // Issue credential
    console.log('🔏 Signing credential...');
    const credential = await issueCitizenshipCredential(
        citizenship,
        userPubkey,
        nonce,
        issuerPrivateKey
    );
    
    // Save credential to file
    const credentialsDir = path.join(__dirname, '../../credentials');
    if (!fs.existsSync(credentialsDir)) {
        fs.mkdirSync(credentialsDir, { recursive: true });
    }
    
    const credentialPath = path.join(credentialsDir, 'citizenship_credential.json');
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

module.exports = { issueCitizenshipCredential, encodeCitizenship, main };
