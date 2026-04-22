#!/bin/bash
set -e

echo "🌍 Setting up WorldWideView for Local Development..."

# Check for pnpm
if ! command -v pnpm &> /dev/null; then
    echo "❌ Error: pnpm is required but not installed."
    echo "Please install it first: https://pnpm.io/installation"
    exit 1
fi

echo "📦 Installing dependencies..."
pnpm install

echo "🔐 Running initial setup (generating secrets)..."
pnpm run setup

# Check for the sibling Data Engine repository
if [ ! -d "../wwv-data-engine" ]; then
    echo ""
    echo "====================================================================="
    echo "⚠️  NOTICE: Local Data Engine not found at ../wwv-data-engine"
    echo ""
    echo "Frontend-Only Mode: You are developing the frontend UI."
    echo "WorldWideView will automatically stream data from the Cloud Engine."
    echo ""
    echo "Full-Stack Mode: If you want to develop backend data seeders, you"
    echo "must clone the open-source data engine as a sibling directory:"
    echo "  cd .. && git clone https://github.com/silvertakana/wwv-data-engine"
    echo "  cd wwv-data-engine && pnpm install"
    echo "====================================================================="
    echo ""
fi

echo "🚀 Starting local Next.js frontend server..."
echo "   (To run the data engine backends concurrently, run: pnpm dev:all)"
pnpm run dev
