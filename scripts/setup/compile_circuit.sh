#!/bin/bash

# Script to compile the Circom circuit and generate necessary files
# This script:
# 1. Compiles the circuit to R1CS format
# 2. Generates witness calculator (WASM)
# 3. Generates Solidity verifier contract using snarkjs

set -e

echo "🔧 Compiling Circom circuit..."

# Create build directory if it doesn't exist
mkdir -p build

# Circuit files
CIRCUIT_FILE_HARD="circuits/age_citizenship.circom"
CIRCUIT_FILE_SOFT="circuits/age_citizenship_soft.circom"
CIRCUIT_NAME_HARD="age_citizenship"
CIRCUIT_NAME_SOFT="age_citizenship_soft"

# Check if circuit files exist
if [ ! -f "$CIRCUIT_FILE_HARD" ]; then
    echo "❌ Error: Hard constraint circuit file not found: $CIRCUIT_FILE_HARD"
    exit 1
fi

if [ ! -f "$CIRCUIT_FILE_SOFT" ]; then
    echo "❌ Error: Soft constraint circuit file not found: $CIRCUIT_FILE_SOFT"
    exit 1
fi

# Step 1: Compile circuit to R1CS
echo "📦 Step 1: Compiling circuit to R1CS..."

# Check if official circom is installed (not the npm package)
if ! command -v circom &> /dev/null; then
    echo "❌ Error: Circom compiler not found!"
    echo "   Please install the official Circom compiler (Circom 2):"
    echo "   https://docs.circom.io/getting-started/installation/#installing-circom"
    exit 1
fi

# Verify it's the official compiler (not npm package) and version 2+
CIRCOM_VERSION=$(circom --version 2>&1 || echo "")
if [[ "$CIRCOM_VERSION" == *"node_modules"* ]] || [[ -z "$CIRCOM_VERSION" ]]; then
    echo "❌ Error: Wrong Circom compiler detected!"
    echo "   The npm package 'circom' is installed, but you need the official compiler."
    echo "   Please uninstall the npm package and install Circom 2:"
    echo "   https://docs.circom.io/getting-started/installation/#installing-circom"
    exit 1
fi

if [[ "$CIRCOM_VERSION" != *"2."* ]]; then
    echo "❌ Error: Circom 2.x is required, but found: ${CIRCOM_VERSION}"
    echo "   Please install Circom 2 from the official instructions:"
    echo "   https://docs.circom.io/getting-started/installation/#installing-circom"
    exit 1
fi

# Compile hard constraint circuit
echo "📦 Compiling HARD constraint circuit..."
circom "$CIRCUIT_FILE_HARD" --r1cs --wasm --sym -o build -l node_modules

# Check if compilation was successful
if [ ! -f "build/${CIRCUIT_NAME_HARD}.r1cs" ]; then
    echo "❌ Error: Hard constraint circuit compilation failed"
    exit 1
fi

echo "✅ Hard constraint circuit compiled successfully!"
echo "   - R1CS file: build/${CIRCUIT_NAME_HARD}.r1cs"
echo "   - WASM file: build/${CIRCUIT_NAME_HARD}.wasm"
echo "   - Symbol file: build/${CIRCUIT_NAME_HARD}.sym"

# Compile soft constraint circuit
echo ""
echo "📦 Compiling SOFT constraint circuit..."
circom "$CIRCUIT_FILE_SOFT" --r1cs --wasm --sym -o build -l node_modules

# Check if compilation was successful
if [ ! -f "build/${CIRCUIT_NAME_SOFT}.r1cs" ]; then
    echo "❌ Error: Soft constraint circuit compilation failed"
    exit 1
fi

echo "✅ Soft constraint circuit compiled successfully!"
echo "   - R1CS file: build/${CIRCUIT_NAME_SOFT}.r1cs"
echo "   - WASM file: build/${CIRCUIT_NAME_SOFT}.wasm"
echo "   - Symbol file: build/${CIRCUIT_NAME_SOFT}.sym"

# Step 2: Print circuit info
echo ""
echo "📊 Hard Constraint Circuit Information:"
snarkjs r1cs info build/${CIRCUIT_NAME_HARD}.r1cs

echo ""
echo "📊 Soft Constraint Circuit Information:"
snarkjs r1cs info build/${CIRCUIT_NAME_SOFT}.r1cs

# Step 3: Generate Solidity verifier (requires trusted setup first)
echo ""
echo "⚠️  Note: To generate the Solidity verifier contracts, you need to:"
echo "   1. Run the trusted setup: npm run setup"
echo "   2. Then run:"
echo "      snarkjs zkey export solidityverifier build/${CIRCUIT_NAME_HARD}_final.zkey src/Verifier.sol"
echo "      snarkjs zkey export solidityverifier build/${CIRCUIT_NAME_SOFT}_final.zkey src/VerifierSoft.sol"
echo ""
echo "✅ Both circuits compiled successfully!"
