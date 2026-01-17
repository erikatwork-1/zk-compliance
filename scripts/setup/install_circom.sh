#!/bin/bash

# Script to install the official Circom compiler
# The npm package 'circom' is NOT the official compiler!

set -e

echo "🔧 Installing Official Circom Compiler"
echo "======================================"
echo ""
echo "⚠️  Note: The npm package 'circom' is NOT the official compiler!"
echo "   This script will install the official compiler from iden3."
echo ""

# Check if Rust is installed (required for building)
if ! command -v rustc &> /dev/null; then
    echo "❌ Rust is not installed. Circom requires Rust to build."
    echo ""
    echo "Please install Rust first:"
    echo "  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    echo ""
    exit 1
fi

echo "✅ Rust is installed"
echo ""

# Install using the official installer
echo "📥 Downloading and installing Circom..."
curl -Ls https://raw.githubusercontent.com/iden3/circom/master/install.sh | bash

echo ""
echo "✅ Installation complete!"
echo ""
echo "Please add Circom to your PATH:"
echo "  export PATH=\"\$HOME/.cargo/bin:\$PATH\""
echo ""
echo "Or add this to your ~/.zshrc or ~/.bashrc:"
echo "  export PATH=\"\$HOME/.cargo/bin:\$PATH\""
echo ""
echo "Then verify installation:"
echo "  source ~/.zshrc  # or source ~/.bashrc"
echo "  circom --version"
