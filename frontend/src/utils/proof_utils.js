/**
 * Proof Utilities
 * Helper functions for credential issuance and proof generation
 */

import { sign, getPublicKey, utils, etc } from '@noble/secp256k1';
import { hmac } from '@noble/hashes/hmac';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { buildPoseidon } from 'circomlibjs';
import * as snarkjs from 'snarkjs';

let poseidonInstance = null;

if (!etc.hmacSha256Sync) {
  etc.hmacSha256Sync = (key, ...msgs) => hmac(sha256, key, etc.concatBytes(...msgs));
}

const BN254_SCALAR_FIELD = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');

function reduceModR(value) {
  return BigInt(value) % BN254_SCALAR_FIELD;
}
function bigintToBytes32(value) {
  const hex = value.toString(16).padStart(64, '0');
  return hexToBytes(hex);
}

function signatureToBytes(signature) {
  if (signature instanceof Uint8Array) {
    return signature;
  }
  if (signature && typeof signature === 'object') {
    if (typeof signature.toCompactRawBytes === 'function') {
      return signature.toCompactRawBytes();
    }
    if ('r' in signature && 's' in signature) {
      const rBytes = bigintToBytes32(BigInt(signature.r));
      const sBytes = bigintToBytes32(BigInt(signature.s));
      const out = new Uint8Array(64);
      out.set(rBytes, 0);
      out.set(sBytes, 32);
      return out;
    }
  }
  return new Uint8Array(signature);
}

async function getPoseidon() {
  if (!poseidonInstance) {
    poseidonInstance = await buildPoseidon();
  }
  return poseidonInstance;
}

/**
 * Encode citizenship string as a field element
 */
export function encodeCitizenship(citizenship) {
  let encoded = BigInt(0);
  for (let i = 0; i < citizenship.length; i++) {
    encoded = encoded * BigInt(256) + BigInt(citizenship.charCodeAt(i));
  }
  return encoded;
}

/**
 * Issue a DOB credential (simulated - in production, this would be done by Issuer A)
 */
export async function issueDOBCredential(dateOfBirth, userPubkey, nonce, issuerPrivateKeyHex) {
  // In a real application, this would call an API endpoint
  // For the frontend demo, we simulate the credential structure
  // The actual signing would be done server-side by the issuer
  
  // Generate a mock issuer key for demo purposes
  const issuerPrivateKey = issuerPrivateKeyHex
    ? hexToBytes(issuerPrivateKeyHex.replace(/^0x/, ''))
    : utils.randomPrivateKey();
  const issuerPubkey = getPublicKey(issuerPrivateKey, false);
  
  // Create credential message hash
  const poseidon = await getPoseidon();
  const messageHash = poseidon([BigInt(dateOfBirth), BigInt(userPubkey), BigInt(nonce)]);
  
  // Sign the message (in production, this would be done by the issuer)
  const messageBytes = new Uint8Array(32);
  const messageBigInt = BigInt(poseidon.F.toString(messageHash));
  for (let i = 0; i < 32; i++) {
    messageBytes[31 - i] = Number((messageBigInt >> BigInt(i * 8)) & BigInt(0xff));
  }
  
  const signature = await sign(messageBytes, issuerPrivateKey);
  const sigBytes = signatureToBytes(signature);
  const signatureR = BigInt(`0x${bytesToHex(sigBytes.slice(0, 32))}`);
  const signatureS = BigInt(`0x${bytesToHex(sigBytes.slice(32, 64))}`);
  
  const rawIssuerPubkeyX = BigInt(`0x${bytesToHex(issuerPubkey.slice(1, 33))}`);
  const rawIssuerPubkeyY = BigInt(`0x${bytesToHex(issuerPubkey.slice(33, 65))}`);
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
 * Issue a citizenship credential (simulated - in production, this would be done by Issuer B)
 */
export async function issueCitizenshipCredential(citizenship, userPubkey, nonce, issuerPrivateKeyHex) {
  // Similar to DOB credential, but for citizenship
  const issuerPrivateKey = issuerPrivateKeyHex
    ? hexToBytes(issuerPrivateKeyHex.replace(/^0x/, ''))
    : utils.randomPrivateKey();
  const issuerPubkey = getPublicKey(issuerPrivateKey, false);
  
  const citizenshipEncoded = encodeCitizenship(citizenship);
  const poseidon = await getPoseidon();
  const messageHash = poseidon([citizenshipEncoded, BigInt(userPubkey), BigInt(nonce)]);
  
  const messageBytes = new Uint8Array(32);
  const messageBigInt = BigInt(poseidon.F.toString(messageHash));
  for (let i = 0; i < 32; i++) {
    messageBytes[31 - i] = Number((messageBigInt >> BigInt(i * 8)) & BigInt(0xff));
  }
  
  const signature = await sign(messageBytes, issuerPrivateKey);
  const sigBytes = signatureToBytes(signature);
  const signatureR = BigInt(`0x${bytesToHex(sigBytes.slice(0, 32))}`);
  const signatureS = BigInt(`0x${bytesToHex(sigBytes.slice(32, 64))}`);
  
  const rawIssuerPubkeyX = BigInt(`0x${bytesToHex(issuerPubkey.slice(1, 33))}`);
  const rawIssuerPubkeyY = BigInt(`0x${bytesToHex(issuerPubkey.slice(33, 65))}`);
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
 * Generate zero-knowledge proof
 * Note: This requires the circuit to be compiled and trusted setup to be run
 * In a production frontend, this might be done server-side due to computational requirements
 */
export async function generateProof(dobCredential, citizenshipCredential, currentDate, minAge, artifacts, subjectWalletAddress) {
  if (!artifacts?.wasm || !artifacts?.zkey) {
    throw new Error(
      'Missing circuit artifacts. Select age_citizenship.wasm and age_citizenship_final.zkey first.'
    );
  }

  const dateOfBirth = BigInt(dobCredential.dateOfBirth);
  const citizenship = encodeCitizenship(citizenshipCredential.citizenship);
  const signatureAR = BigInt(dobCredential.signature.r);
  const signatureAS = BigInt(dobCredential.signature.s);
  const signatureBR = BigInt(citizenshipCredential.signature.r);
  const signatureBS = BigInt(citizenshipCredential.signature.s);
  const nonceA = BigInt(dobCredential.nonce);
  const nonceB = BigInt(citizenshipCredential.nonce);

  const userPubkey = BigInt(dobCredential.userPubkey);
  if (userPubkey.toString() !== citizenshipCredential.userPubkey) {
    throw new Error('Credentials do not belong to the same user.');
  }
  if (!subjectWalletAddress) {
    throw new Error('Missing subject wallet address.');
  }
  const subjectWallet = BigInt(subjectWalletAddress);
  if (userPubkey !== subjectWallet) {
    throw new Error('Wallet address does not match the credential subject.');
  }

  const currentDateInput = BigInt(Math.floor(currentDate.getTime() / 1000));
  const minAgeInput = BigInt(minAge);
  const requiredCitizenship = encodeCitizenship('US');
  const issuerAPubkeyX = BigInt(dobCredential.issuerPubkey.x);
  const issuerAPubkeyY = BigInt(dobCredential.issuerPubkey.y);
  const issuerBPubkeyX = BigInt(citizenshipCredential.issuerPubkey.x);
  const issuerBPubkeyY = BigInt(citizenshipCredential.issuerPubkey.y);

  const input = {
    date_of_birth: dateOfBirth.toString(),
    citizenship: citizenship.toString(),
    signature_a_r: signatureAR.toString(),
    signature_a_s: signatureAS.toString(),
    signature_b_r: signatureBR.toString(),
    signature_b_s: signatureBS.toString(),
    nonce_a: nonceA.toString(),
    nonce_b: nonceB.toString(),
    current_date: currentDateInput.toString(),
    min_age: minAgeInput.toString(),
    required_citizenship: requiredCitizenship.toString(),
    issuer_a_pubkey_x: issuerAPubkeyX.toString(),
    issuer_a_pubkey_y: issuerAPubkeyY.toString(),
    issuer_b_pubkey_x: issuerBPubkeyX.toString(),
    issuer_b_pubkey_y: issuerBPubkeyY.toString(),
    user_pubkey: userPubkey.toString(),
    subject_wallet: subjectWallet.toString()
  };

  const wasmData = artifacts.wasm instanceof Uint8Array ? artifacts.wasm : new Uint8Array(artifacts.wasm);
  const zkeyData = artifacts.zkey instanceof Uint8Array ? artifacts.zkey : new Uint8Array(artifacts.zkey);

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, wasmData, zkeyData);

  return {
    proof,
    publicSignals: publicSignals.map((signal) => signal.toString())
  };
}
