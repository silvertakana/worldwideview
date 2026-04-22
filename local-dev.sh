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

echo "🚀 Starting local Next.js frontend server..."
echo "   (To run the data engine backends concurrently, run: pnpm dev:all)"
pnpm run dev
