#!/usr/bin/env node
/**
 * Copy circuit artifacts into the frontend public folder.
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '../..');
const buildDir = path.join(rootDir, 'build');

// Hard constraint circuit artifacts
const wasmSource = path.join(buildDir, 'age_citizenship_js', 'age_citizenship.wasm');
const zkeySource = path.join(buildDir, 'age_citizenship_final.zkey');

// Soft constraint circuit artifacts
const wasmSourceSoft = path.join(buildDir, 'age_citizenship_soft_js', 'age_citizenship_soft.wasm');
const zkeySourceSoft = path.join(buildDir, 'age_citizenship_soft_final.zkey');

const targetDir = path.join(rootDir, 'frontend', 'public', 'artifacts');
const wasmTargetDir = path.join(targetDir, 'age_citizenship_js');
const wasmTarget = path.join(wasmTargetDir, 'age_citizenship.wasm');
const zkeyTarget = path.join(targetDir, 'age_citizenship_final.zkey');

const wasmTargetDirSoft = path.join(targetDir, 'age_citizenship_soft_js');
const wasmTargetSoft = path.join(wasmTargetDirSoft, 'age_citizenship_soft.wasm');
const zkeyTargetSoft = path.join(targetDir, 'age_citizenship_soft_final.zkey');

function ensureFileExists(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing ${label}: ${filePath}`);
  }
}

function copyFile(source, destination) {
  fs.copyFileSync(source, destination);
}

function main() {
  try {
    console.log('📦 Copying circuit artifacts...\n');
    
    // Copy hard constraint artifacts (required)
    console.log('Hard Constraint Circuit:');
    ensureFileExists(wasmSource, 'Hard WASM');
    ensureFileExists(zkeySource, 'Hard zkey');

    fs.mkdirSync(wasmTargetDir, { recursive: true });

    copyFile(wasmSource, wasmTarget);
    copyFile(zkeySource, zkeyTarget);

    console.log('✅ Hard constraint artifacts copied');
    console.log(`   - ${wasmTarget}`);
    console.log(`   - ${zkeyTarget}`);
    
    // Copy soft constraint artifacts (optional)
    console.log('\nSoft Constraint Circuit:');
    const softExists = fs.existsSync(wasmSourceSoft) && fs.existsSync(zkeySourceSoft);
    
    if (softExists) {
      fs.mkdirSync(wasmTargetDirSoft, { recursive: true });
      
      copyFile(wasmSourceSoft, wasmTargetSoft);
      copyFile(zkeySourceSoft, zkeyTargetSoft);
      
      console.log('✅ Soft constraint artifacts copied');
      console.log(`   - ${wasmTargetSoft}`);
      console.log(`   - ${zkeyTargetSoft}`);
    } else {
      console.log('⚠️  Soft constraint artifacts not found (this is optional)');
      console.log('   To enable soft constraints, compile the soft circuit:');
      console.log('   See docs/SOFT_CONSTRAINTS.md for instructions');
    }
    
    console.log('\n✅ Artifact copy complete!');
  } catch (error) {
    console.error(`\n❌ ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
