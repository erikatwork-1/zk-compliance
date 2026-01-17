#!/usr/bin/env node
/**
 * Register Issuer A/B public keys on AgeVerification.
 */

const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const { getPublicKey } = require('@noble/secp256k1');
const { bytesToHex, hexToBytes } = require('@noble/hashes/utils');

const AGE_VERIFICATION_ABI = [
  'function addTrustedIssuerA(uint256,uint256) external',
  'function addTrustedIssuerB(uint256,uint256) external'
];

const BN254_SCALAR_FIELD = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');

const ROOT = path.join(__dirname, '../..');
const ISSUER_A_FILE = path.join(ROOT, '.issuer_a_key.json');
const ISSUER_B_FILE = path.join(ROOT, '.issuer_b_key.json');

function readIssuerPrivateKey(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return data.privateKey ? `0x${data.privateKey}` : null;
}

function derivePubkey(privateKeyHex) {
  const priv = hexToBytes(privateKeyHex.replace(/^0x/, ''));
  const pubkey = getPublicKey(priv, false);
  const rawX = BigInt(`0x${bytesToHex(pubkey.slice(1, 33))}`);
  const rawY = BigInt(`0x${bytesToHex(pubkey.slice(33, 65))}`);
  const x = (rawX % BN254_SCALAR_FIELD).toString();
  const y = (rawY % BN254_SCALAR_FIELD).toString();
  return { x, y };
}

async function main() {
  const contractAddress = process.env.CONTRACT_ADDRESS;
  const deployerPrivateKey = process.env.DEPLOYER_PRIVATE_KEY;

  if (!contractAddress) {
    console.error('❌ Missing CONTRACT_ADDRESS');
    process.exit(1);
  }
  if (!deployerPrivateKey) {
    console.error('❌ Missing DEPLOYER_PRIVATE_KEY');
    process.exit(1);
  }

  const issuerAPrivateKey =
    process.env.ISSUER_A_PRIVATE_KEY || readIssuerPrivateKey(ISSUER_A_FILE);
  const issuerBPrivateKey =
    process.env.ISSUER_B_PRIVATE_KEY || readIssuerPrivateKey(ISSUER_B_FILE);

  if (!issuerAPrivateKey || !issuerBPrivateKey) {
    console.error('❌ Missing issuer private keys (env or .issuer_*_key.json)');
    process.exit(1);
  }

  const issuerA = derivePubkey(issuerAPrivateKey);
  const issuerB = derivePubkey(issuerBPrivateKey);

  const rpcUrl = process.env.RPC_URL || 'http://127.0.0.1:8545';
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(deployerPrivateKey, provider);
  const contract = new ethers.Contract(contractAddress, AGE_VERIFICATION_ABI, signer);

  console.log(`📦 Registering issuers on ${contractAddress}`);
  console.log(`   Issuer A pubkey: x=${issuerA.x} y=${issuerA.y}`);
  console.log(`   Issuer B pubkey: x=${issuerB.x} y=${issuerB.y}`);

  const baseNonce = await provider.getTransactionCount(signer.address, 'pending');
  const txA = await contract.addTrustedIssuerA(issuerA.x, issuerA.y, { nonce: baseNonce });
  await txA.wait();

  const txB = await contract.addTrustedIssuerB(issuerB.x, issuerB.y, { nonce: baseNonce + 1 });
  await txB.wait();

  console.log('✅ Issuers registered successfully.');
}

main().catch((error) => {
  console.error(`❌ ${error.message}`);
  process.exit(1);
});
