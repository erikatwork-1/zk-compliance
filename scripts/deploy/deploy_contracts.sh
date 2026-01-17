#!/bin/bash

# Deployment script for AgeVerification contracts
# Supports local (anvil), Ganache, and Sepolia testnet deployments

set -e

NETWORK=${1:-local}

echo "🚀 Deploying Contracts to $NETWORK network"
echo "==========================================\n"

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  Warning: .env file not found. Using defaults for local network."
fi

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Determine RPC URL and network settings
case $NETWORK in
    local)
        RPC_URL="http://127.0.0.1:8545"
        CHAIN_ID=31337
        echo "📡 Using local network (anvil)"
        echo "   Make sure anvil is running: anvil"
        ;;
    ganache)
        RPC_URL="${GANACHE_RPC_URL:-http://127.0.0.1:8545}"
        CHAIN_ID="${GANACHE_CHAIN_ID:-1337}"
        echo "📡 Using Ganache local network"
        echo "   RPC URL: $RPC_URL"
        echo "   Chain ID: $CHAIN_ID"
        echo "   Make sure Ganache is running on the configured port"
        ;;
    sepolia)
        if [ -z "$SEPOLIA_RPC_URL" ]; then
            echo "❌ Error: SEPOLIA_RPC_URL not set in .env"
            exit 1
        fi
        RPC_URL="$SEPOLIA_RPC_URL"
        CHAIN_ID=11155111
        echo "📡 Using Sepolia testnet"
        ;;
    *)
        echo "❌ Error: Unknown network '$NETWORK'"
        echo "Usage: $0 [local|ganache|sepolia]"
        exit 1
        ;;
esac

echo "   RPC URL: $RPC_URL"
echo "   Chain ID: $CHAIN_ID\n"

# Check if contracts are compiled
if [ ! -d "out" ]; then
    echo "📦 Compiling contracts..."
    forge build
fi

# Check if Verifier contract exists
if [ ! -f "src/Verifier.sol" ] || ! grep -q "function verifyProof" src/Verifier.sol 2>/dev/null; then
    echo "⚠️  Warning: Verifier contract not found or not generated."
    echo "   Please run trusted setup first: npm run setup"
    echo "   This will generate src/Verifier.sol"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Deploy using Foundry
echo "📦 Deploying contracts...\n"

if [ "$NETWORK" == "local" ]; then
    # For local (anvil), use default anvil account
    forge script script/Deploy.s.sol:Deploy \
        --rpc-url $RPC_URL \
        --broadcast \
        --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
elif [ "$NETWORK" == "ganache" ]; then
    # For Ganache, use private key from .env or default Ganache account
    GANACHE_PRIVATE_KEY="${GANACHE_PRIVATE_KEY:-0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d}"
    forge script script/Deploy.s.sol:Deploy \
        --rpc-url $RPC_URL \
        --broadcast \
        --private-key $GANACHE_PRIVATE_KEY
else
    # For testnet, use private key from .env
    if [ -z "$PRIVATE_KEY" ]; then
        echo "❌ Error: PRIVATE_KEY not set in .env"
        exit 1
    fi
    
    forge script script/Deploy.s.sol:Deploy \
        --rpc-url $RPC_URL \
        --broadcast \
        --private-key $PRIVATE_KEY \
        --verify \
        --etherscan-api-key $ETHERSCAN_API_KEY
fi

echo "\n✅ Deployment complete!"
echo "\n📋 Next steps:"
echo "   1. Note the contract addresses from the output above"
echo "   2. Register issuer public keys in AgeVerification contract"
echo "   3. Use the contract address to submit proofs"
