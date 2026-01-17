#!/usr/bin/env node

/**
 * Trusted Setup Script
 * 
 * This script performs the trusted setup ceremony for the zk-SNARK circuit.
 * 
 * IMPORTANT: In production, this should be done as a multi-party ceremony
 * where multiple parties contribute randomness. For this demo, we use a
 * single-party setup which is NOT secure for production use.
 * 
 * The setup has two phases:
 * 1. Phase 1 (Powers of Tau): Circuit-agnostic, can be reused
 * 2. Phase 2 (Circuit-specific): Generates proving and verification keys
 */

const fs = require('fs');
const path = require('path');
const snarkjs = require('snarkjs');

const BUILD_DIR = path.join(__dirname, '../../build');
const PTAU_DIR = path.join(__dirname, '../../ptau');
const CIRCUIT_DIR = path.join(__dirname, '../../circuits');

// Support both hard and soft constraint circuits
const CIRCUIT_NAMES = ['age_citizenship', 'age_citizenship_soft'];

// Ensure build directory exists
if (!fs.existsSync(BUILD_DIR)) {
    fs.mkdirSync(BUILD_DIR, { recursive: true });
}
// Ensure ptau directory exists
if (!fs.existsSync(PTAU_DIR)) {
    fs.mkdirSync(PTAU_DIR, { recursive: true });
}

async function phase1() {
    console.log('\n🔐 Phase 1: Powers of Tau Ceremony');
    console.log('=====================================');

    const ptauPath = path.join(PTAU_DIR, 'powersOfTau_final.ptau');

    // Check if Powers of Tau file exists (should be pre-downloaded)
    if (fs.existsSync(ptauPath)) {
        const stats = fs.statSync(ptauPath);
        console.log(`✅ Powers of Tau file found (${(stats.size / 1024 / 1024).toFixed(1)} MB)`);
        return ptauPath;
    }

    // File not found - provide instructions
    console.error('❌ Powers of Tau file not found!');
    console.error('   Please download it first:');
    console.error('');
    console.error('   npm run download:ptau');
    console.error('');
    console.error('   Or manually:');
    console.error('   bash scripts/setup/download_ptau.sh');
    console.error('');
    process.exit(1);
}

async function phase2(ptauPath, circuitName) {
    console.log(`\n🔐 Phase 2: Circuit-Specific Setup for ${circuitName}`);
    console.log('===================================');

    const r1csPath = path.join(BUILD_DIR, `${circuitName}.r1cs`);

    if (!fs.existsSync(r1csPath)) {
        console.log(`⚠️  R1CS file not found for ${circuitName}, skipping...`);
        return null;
    }

    // Step 1: Start Phase 2
    console.log('🔧 Starting Phase 2 (generating initial zkey)...');
    const zkeyPath = path.join(BUILD_DIR, `${circuitName}_0000.zkey`);

    if (!fs.existsSync(zkeyPath)) {
        await snarkjs.zKey.newZKey(r1csPath, ptauPath, zkeyPath, console);
        console.log('✅ Initial zkey created');
    } else {
        console.log('✅ Initial zkey already exists');
    }

    // Step 2: Contribute to Phase 2 (for demo, single contribution)
    console.log('🔧 Contributing to Phase 2...');
    const zkeyFinalPath = path.join(BUILD_DIR, `${circuitName}_final.zkey`);

    if (!fs.existsSync(zkeyFinalPath)) {
        await snarkjs.zKey.contribute(zkeyPath, zkeyFinalPath, 'demo-contribution', 'demo-entropy-12345');
        console.log('✅ Phase 2 contribution complete (demo mode - single party)');
    } else {
        console.log('✅ Phase 2 already complete');
    }

    // Step 3: Export verification key
    console.log('🔧 Exporting verification key...');
    const vkeyPath = path.join(BUILD_DIR, `${circuitName}_vkey.json`);

    if (!fs.existsSync(vkeyPath)) {
        const vkey = await snarkjs.zKey.exportVerificationKey(zkeyFinalPath);
        fs.writeFileSync(vkeyPath, JSON.stringify(vkey, null, 2));
        console.log('✅ Verification key exported');
    } else {
        console.log('✅ Verification key already exists');
    }

    // Step 4: Generate Solidity verifier using CLI (only for main hard circuit)
    if (circuitName === 'age_citizenship') {
        console.log('🔧 Generating Solidity verifier contract...');
        const verifierPath = path.join(__dirname, '../../src/Verifier.sol');

        const { execSync } = require('child_process');
        try {
            execSync(`npx snarkjs zkey export solidityverifier "${zkeyFinalPath}" "${verifierPath}"`, {
                stdio: 'inherit'
            });
            console.log('✅ Solidity verifier contract generated');
        } catch (err) {
            console.error('⚠️  Failed to generate Solidity verifier via CLI');
            console.error('   You can generate it manually with:');
            console.error(`   npx snarkjs zkey export solidityverifier ${zkeyFinalPath} ${verifierPath}`);
        }
    } else {
        console.log(`ℹ️  Skipping Solidity verifier generation for ${circuitName} (using main verifier)`);
    }

    return zkeyFinalPath;
}

async function main() {
    console.log('🚀 Starting Trusted Setup Ceremony');
    console.log('==================================\n');
    console.log('⚠️  WARNING: This is a DEMO setup with a single party.');
    console.log('   For production use, you MUST perform a multi-party ceremony!\n');

    try {
        // Phase 1: Powers of Tau (uses pre-downloaded file)
        const ptauPath = await phase1();
        
        // Phase 2: Circuit-specific setup for all circuits
        const generatedKeys = [];
        
        for (const circuitName of CIRCUIT_NAMES) {
            console.log(`\n${'='.repeat(60)}`);
            console.log(`Processing circuit: ${circuitName}`);
            console.log('='.repeat(60));
            
            const zkeyPath = await phase2(ptauPath, circuitName);
            
            if (zkeyPath) {
                generatedKeys.push({
                    circuit: circuitName,
                    zkeyPath,
                    vkeyPath: path.join(BUILD_DIR, `${circuitName}_vkey.json`)
                });
            }
        }
        
        console.log('\n✅ Trusted Setup Complete!');
        console.log('==========================');
        console.log('📁 Files generated:');
        
        generatedKeys.forEach(({ circuit, zkeyPath, vkeyPath }) => {
            console.log(`\n   ${circuit}:`);
            console.log(`   - Proving key: ${zkeyPath}`);
            console.log(`   - Verification key: ${vkeyPath}`);
        });
        
        console.log(`\n   - Verifier contract: src/Verifier.sol (for main circuit)`);
        console.log('\n🎉 You can now generate proofs with both hard and soft constraint circuits!');
        
    } catch (error) {
        console.error('\n❌ Error during trusted setup:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main()
        .then(() => {
            process.exit(0);
        })
        .catch((error) => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}

module.exports = { main };
