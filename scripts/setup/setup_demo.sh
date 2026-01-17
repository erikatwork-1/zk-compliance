#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "========================================="
echo "ZK Identity Proof - Demo Setup"
echo "========================================="
echo ""

# Step 0: Check prerequisites
echo -e "${BLUE}[0/7] Checking prerequisites...${NC}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if bash "$SCRIPT_DIR/check_prerequisites.sh"; then
    echo -e "${GREEN}✓ All prerequisites installed${NC}"
else
    echo -e "${RED}✗ Missing prerequisites. Please install them and try again.${NC}"
    exit 1
fi
echo ""

# Step 0.5: Check if Ganache is running
echo -e "${BLUE}[0.5/7] Checking if Ganache is running...${NC}"
if curl -s http://127.0.0.1:8545 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Ganache is running${NC}"
else
    echo -e "${RED}✗ Ganache is not running!${NC}"
    echo ""
    echo "Please start Ganache in a separate terminal:"
    echo "  ganache -d -g 1"
    echo ""
    echo "Then run this setup script again."
    exit 1
fi
echo ""

# Step 0.6: Download Powers of Tau if needed
echo -e "${BLUE}[0.6/7] Checking Powers of Tau file...${NC}"
PTAU_DIR="$(dirname "$SCRIPT_DIR")/../../ptau"
PTAU_FILE="$PTAU_DIR/powersOfTau_final.ptau"
if [ ! -f "$PTAU_FILE" ]; then
    echo "Powers of Tau file not found. Downloading..."
    bash "$SCRIPT_DIR/download_ptau.sh"
    if [ ! -f "$PTAU_FILE" ]; then
        echo -e "${RED}✗ Failed to download Powers of Tau file${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Powers of Tau downloaded${NC}"
else
    FILE_SIZE=$(ls -lh "$PTAU_FILE" | awk '{print $5}')
    echo -e "${GREEN}✓ Powers of Tau file found ($FILE_SIZE)${NC}"
fi
echo ""

# Step 1: Compile circuit
echo -e "${BLUE}[1/7] Compiling circuit...${NC}"
npm run compile:circuit || {
    echo -e "${YELLOW}⚠️  Circuit compilation failed${NC}"
    exit 1
}
echo -e "${GREEN}✓ Circuit compiled${NC}"
echo ""

# Step 2: Trusted setup
echo -e "${BLUE}[2/7] Running trusted setup...${NC}"
npm run setup || {
    echo -e "${YELLOW}⚠️  Trusted setup encountered an issue${NC}"
    exit 1
}
echo -e "${GREEN}✓ Trusted setup complete${NC}"
echo -e "${BLUE}   Continuing to deployment...${NC}"
echo ""

# Step 3: Deploy contracts
echo -e "${BLUE}[3/7] Deploying contracts to Ganache...${NC}"
DEPLOY_OUTPUT=$(npm run deploy:ganache 2>&1)
echo "$DEPLOY_OUTPUT"

# Extract AgeVerification contract address from deployment output
CONTRACT_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep "AgeVerification:" | grep -oE '0x[a-fA-F0-9]{40}' | tail -1)

if [ -z "$CONTRACT_ADDRESS" ]; then
    echo -e "${YELLOW}⚠️  Could not extract contract address from deployment output${NC}"
    echo "Deployment may have failed. Please check the output above."
    exit 1
fi

echo -e "${GREEN}✓ Contracts deployed${NC}"
echo -e "${BLUE}📝 AgeVerification address: ${CONTRACT_ADDRESS}${NC}"
echo ""

# Step 4: Register issuers
echo -e "${BLUE}[4/7] Registering issuers on-chain...${NC}"
# Set environment variables for register_issuers.js
export CONTRACT_ADDRESS="${CONTRACT_ADDRESS}"
export DEPLOYER_PRIVATE_KEY="0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d"
export RPC_URL="http://127.0.0.1:8545"
npm run register:issuers
echo -e "${GREEN}✓ Issuers registered${NC}"
echo ""

# Step 5: Issue demo credentials
echo -e "${BLUE}[5/7] Issuing demo credentials...${NC}"
npm run issuer:a
npm run issuer:b
echo -e "${GREEN}✓ Credentials issued${NC}"
echo ""

# Step 6: Copy artifacts to frontend
echo -e "${BLUE}[6/7] Copying artifacts to frontend...${NC}"
npm run copy:artifacts
echo -e "${GREEN}✓ Artifacts copied${NC}"
echo ""

echo "========================================="
echo -e "${GREEN}✓ Demo setup complete!${NC}"
echo "========================================="
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "  1. Keep Ganache running in the other terminal"
echo "  2. Start the frontend:"
echo "     cd frontend"
echo "     npm install"
echo "     npm run dev"
echo "  3. Open http://localhost:5173 in your browser"
echo ""
