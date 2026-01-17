#!/bin/bash

# Prerequisite Check Script
# Validates that all required tools are installed before running setup

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

MISSING_TOOLS=()
WARNINGS=()

echo "========================================="
echo "  Prerequisite Check"
echo "========================================="
echo ""

# Check Node.js
echo -n "Checking Node.js... "
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -ge 18 ]; then
        echo -e "${GREEN}✓${NC} $(node --version)"
    else
        echo -e "${RED}✗${NC} Version $(node --version) found, but v18+ is required"
        MISSING_TOOLS+=("Node.js v18+")
    fi
else
    echo -e "${RED}✗${NC} Not found"
    MISSING_TOOLS+=("Node.js v18+")
fi

# Check npm
echo -n "Checking npm... "
if command -v npm &> /dev/null; then
    echo -e "${GREEN}✓${NC} $(npm --version)"
else
    echo -e "${RED}✗${NC} Not found"
    MISSING_TOOLS+=("npm")
fi

# Check Foundry
echo -n "Checking Foundry... "
if command -v forge &> /dev/null; then
    echo -e "${GREEN}✓${NC} $(forge --version | head -n1)"
else
    echo -e "${RED}✗${NC} Not found"
    MISSING_TOOLS+=("Foundry")
fi

# Check Circom
echo -n "Checking Circom... "
if command -v circom &> /dev/null; then
    CIRCOM_VERSION=$(circom --version 2>&1 || echo "")
    if [[ "$CIRCOM_VERSION" == *"node_modules"* ]]; then
        echo -e "${RED}✗${NC} Wrong Circom detected (npm package, not official compiler)"
        MISSING_TOOLS+=("Circom 2 (official compiler)")
    elif [[ "$CIRCOM_VERSION" == *"2."* ]] || [[ "$CIRCOM_VERSION" == *"circom compiler 2."* ]]; then
        echo -e "${GREEN}✓${NC} $CIRCOM_VERSION"
    else
        echo -e "${YELLOW}⚠${NC}  Version $CIRCOM_VERSION found, but Circom 2.x is recommended"
        WARNINGS+=("Circom version may not be compatible")
    fi
else
    echo -e "${RED}✗${NC} Not found"
    MISSING_TOOLS+=("Circom 2 (official compiler)")
fi

# Check snarkjs
echo -n "Checking snarkjs... "
if command -v snarkjs &> /dev/null; then
    echo -e "${GREEN}✓${NC} $(snarkjs --version 2>&1 | head -n1 || echo 'installed')"
else
    echo -e "${RED}✗${NC} Not found"
    MISSING_TOOLS+=("snarkjs (npm install -g snarkjs)")
fi

# Check Ganache
echo -n "Checking Ganache... "
if command -v ganache &> /dev/null; then
    echo -e "${GREEN}✓${NC} $(ganache --version 2>&1 | head -n1 || echo 'installed')"
else
    echo -e "${RED}✗${NC} Not found"
    MISSING_TOOLS+=("Ganache (npm install -g ganache)")
fi

echo ""

# Report results
if [ ${#MISSING_TOOLS[@]} -eq 0 ]; then
    echo -e "${GREEN}✅ All prerequisites are installed!${NC}"
    echo ""
    
    if [ ${#WARNINGS[@]} -gt 0 ]; then
        echo -e "${YELLOW}⚠️  Warnings:${NC}"
        for warning in "${WARNINGS[@]}"; do
            echo "   - $warning"
        done
        echo ""
    fi
    
    exit 0
else
    echo -e "${RED}❌ Missing prerequisites:${NC}"
    echo ""
    for tool in "${MISSING_TOOLS[@]}"; do
        echo "   - $tool"
    done
    echo ""
    echo -e "${BLUE}Installation Instructions:${NC}"
    echo ""
    
    # Node.js
    if [[ " ${MISSING_TOOLS[@]} " =~ " Node.js v18+ " ]]; then
        echo "📦 Node.js v18+:"
        echo "   Visit: https://nodejs.org/"
        echo "   Or use nvm: nvm install 18"
        echo ""
    fi
    
    # Foundry
    if [[ " ${MISSING_TOOLS[@]} " =~ " Foundry " ]]; then
        echo "🔨 Foundry:"
        echo "   curl -L https://foundry.paradigm.xyz | bash"
        echo "   foundryup"
        echo ""
    fi
    
    # Circom
    if [[ " ${MISSING_TOOLS[@]} " =~ " Circom 2" ]]; then
        echo "⚙️  Circom 2 (Official Compiler):"
        echo "   # Install Rust first (if not installed):"
        echo "   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
        echo "   source \"\$HOME/.cargo/env\""
        echo ""
        echo "   # Then install Circom:"
        echo "   curl -Ls https://raw.githubusercontent.com/iden3/circom/master/install.sh | bash"
        echo "   # Or use the install script:"
        echo "   bash scripts/setup/install_circom.sh"
        echo ""
    fi
    
    # snarkjs
    if [[ " ${MISSING_TOOLS[@]} " =~ " snarkjs" ]]; then
        echo "🔐 snarkjs:"
        echo "   npm install -g snarkjs"
        echo ""
    fi
    
    # Ganache
    if [[ " ${MISSING_TOOLS[@]} " =~ " Ganache" ]]; then
        echo "⛓️  Ganache:"
        echo "   npm install -g ganache"
        echo ""
    fi
    
    echo -e "${YELLOW}After installing missing tools, run this script again to verify.${NC}"
    exit 1
fi
