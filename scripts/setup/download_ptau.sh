#!/bin/bash

# Download Powers of Tau for Trusted Setup
#
# This script downloads the Powers of Tau file required for the trusted setup ceremony.
# The file is ~18MB and is NOT included in git to avoid bloating the repository.
#
# Run this before: npm run setup

set -e

PTAU_DIR="$(dirname "$0")/../../ptau"
PTAU_FILE="$PTAU_DIR/powersOfTau_final.ptau"
PTAU_URL="https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_14.ptau"

# Create ptau directory if it doesn't exist
mkdir -p "$PTAU_DIR"

echo "================================================"
echo "  Powers of Tau Download Script"
echo "================================================"
echo ""

# Check if file already exists
if [ -f "$PTAU_FILE" ]; then
    FILE_SIZE=$(ls -lh "$PTAU_FILE" | awk '{print $5}')
    echo "✅ Powers of Tau file already exists ($FILE_SIZE)"
    echo "   Location: $PTAU_FILE"
    exit 0
fi

echo "Downloading Powers of Tau (powersOfTau28_hez_final_14.ptau)..."
echo "Source: Hermez Network / Polygon zkEVM"
echo "Size: ~18 MB"
echo ""

# Download with progress
if command -v curl &> /dev/null; then
    curl -L -o "$PTAU_FILE" "$PTAU_URL" --progress-bar
elif command -v wget &> /dev/null; then
    wget -O "$PTAU_FILE" "$PTAU_URL" --show-progress
else
    echo "Error: Neither curl nor wget found. Please install one of them."
    exit 1
fi

# Verify download
if [ -f "$PTAU_FILE" ]; then
    FILE_SIZE=$(ls -lh "$PTAU_FILE" | awk '{print $5}')
    echo ""
    echo "Download complete!"
    echo "File: $PTAU_FILE"
    echo "Size: $FILE_SIZE"
    echo ""
    echo "You can now run: npm run setup"
else
    echo ""
    echo "Error: Download failed. Please try again."
    exit 1
fi
