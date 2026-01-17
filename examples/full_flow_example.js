#!/usr/bin/env node

/**
 * Full Flow Example
 * 
 * This script demonstrates the complete end-to-end flow of the zero-knowledge
 * identity verification system:
 * 
 * 1. Issue credentials from both issuers
 * 2. Generate a zero-knowledge proof
 * 3. Deploy smart contracts (optional)
 * 4. Verify the proof on-chain
 * 
 * This is a comprehensive example showing how all components work together.
 */

const path = require('path');
const fs = require('fs');

// Import issuer scripts
const { issueDOBCredential } = require('../scripts/issuers/issuer_a_sign');
const { issueCitizenshipCredential, encodeCitizenship } = require('../scripts/issuers/issuer_b_sign');
const { generateProof } = require('../scripts/user/generate_proof');

async function main() {
    console.log('🚀 Zero-Knowledge Identity Verification - Full Flow Example');
    console.log('===========================================================\n');
    
    try {
        // ============================================
        // Step 1: Issue Credentials
        // ============================================
        console.log('📋 Step 1: Issuing Credentials');
        console.log('-------------------------------\n');
        
        // Set up test data
        const dateOfBirth = BigInt(Math.floor(new Date('2000-01-01').getTime() / 1000));
        const citizenship = 'US';
        const userPubkey = BigInt('1234567890123456789012345678901234567890123456789012345678901234');
        const nonceA = BigInt(Math.floor(Math.random() * 2**64));
        const nonceB = BigInt(Math.floor(Math.random() * 2**64));
        
        console.log('📝 Test Data:');
        console.log(`   Date of Birth: ${new Date(Number(dateOfBirth) * 1000).toISOString()}`);
        console.log(`   Citizenship: ${citizenship}`);
        console.log(`   User Public Key: ${userPubkey.toString()}\n`);
        
        // Issue DOB credential
        console.log('🏛️  Issuing DOB credential from Issuer A (DMV)...');
        const dobCredential = await issueDOBCredential(
            dateOfBirth,
            userPubkey,
            nonceA,
            undefined // Will generate new key
        );
        console.log('✅ DOB credential issued\n');
        
        // Issue citizenship credential
        console.log('🏛️  Issuing citizenship credential from Issuer B (Immigration)...');
        const citizenshipCredential = await issueCitizenshipCredential(
            citizenship,
            userPubkey,
            nonceB,
            undefined // Will generate new key
        );
        console.log('✅ Citizenship credential issued\n');
        
        // Save credentials
        const credentialsDir = path.join(__dirname, '../credentials');
        if (!fs.existsSync(credentialsDir)) {
            fs.mkdirSync(credentialsDir, { recursive: true });
        }
        
        fs.writeFileSync(
            path.join(credentialsDir, 'dob_credential.json'),
            JSON.stringify(dobCredential, null, 2)
        );
        fs.writeFileSync(
            path.join(credentialsDir, 'citizenship_credential.json'),
            JSON.stringify(citizenshipCredential, null, 2)
        );
        
        console.log('💾 Credentials saved to credentials/ directory\n');
        
        // ============================================
        // Step 2: Generate Zero-Knowledge Proof
        // ============================================
        console.log('🔐 Step 2: Generating Zero-Knowledge Proof');
        console.log('------------------------------------------\n');
        
        const currentDate = new Date();
        const minAge = 18;
        
        console.log('📊 Proof Requirements:');
        console.log(`   Current Date: ${currentDate.toISOString()}`);
        console.log(`   Minimum Age: ${minAge} years`);
        console.log(`   Required Citizenship: US\n`);
        
        console.log('🔧 Generating proof (this may take a few seconds)...');
        const proofData = await generateProof(
            dobCredential,
            citizenshipCredential,
            currentDate,
            minAge
        );
        
        console.log('✅ Proof generated successfully!\n');
        console.log('📊 Proof Summary:');
        console.log(`   Public Signals: ${proofData.publicSignals.length} values`);
        console.log(`   Proof Components: a, b, c`);
        console.log(`   Proof Size: ~${JSON.stringify(proofData.proof).length} bytes\n`);
        
        // Save proof
        fs.writeFileSync(
            path.join(credentialsDir, 'proof.json'),
            JSON.stringify(proofData, null, 2)
        );
        console.log('💾 Proof saved to credentials/proof.json\n');
        
        // ============================================
        // Step 3: Display Results
        // ============================================
        console.log('📋 Step 3: Results Summary');
        console.log('---------------------------\n');
        
        console.log('✅ Complete Flow Successful!\n');
        console.log('📁 Generated Files:');
        console.log('   1. credentials/dob_credential.json');
        console.log('   2. credentials/citizenship_credential.json');
        console.log('   3. credentials/proof.json\n');
        
        console.log('🔑 Issuer Public Keys (for contract registration):');
        console.log('\n   Issuer A (DOB):');
        console.log(`      X: ${dobCredential.issuerPubkey.x}`);
        console.log(`      Y: ${dobCredential.issuerPubkey.y}`);
        console.log('\n   Issuer B (Citizenship):');
        console.log(`      X: ${citizenshipCredential.issuerPubkey.x}`);
        console.log(`      Y: ${citizenshipCredential.issuerPubkey.y}\n`);
        
        console.log('📝 Next Steps:');
        console.log('   1. Deploy contracts: npm run deploy:local');
        console.log('   2. Register issuer keys in the contract');
        console.log('   3. Submit proof using the frontend or scripts');
        console.log('   4. Verify on-chain status\n');
        
        console.log('🎉 Full flow example completed successfully!');
        
    } catch (error) {
        console.error('\n❌ Error during full flow example:');
        console.error(error.message);
        console.error('\nStack trace:');
        console.error(error.stack);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { main };
