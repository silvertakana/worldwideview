#!/bin/bash
set -e

echo "🌍 Setting up WorldWideView for local self-hosting..."

# Check if docker is actually available and running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker is not running or not accessible."
    echo "If you are on Windows using WSL, ensure Docker Desktop is running and WSL integration is enabled for your default distro."
    echo "Please install or start Docker Desktop: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check for docker compose plugin
if ! docker compose version > /dev/null 2>&1; then
    echo "❌ Error: Docker Compose is not installed or accessible."
    exit 1
fi

# 1. Download docker-compose.yml
echo "📦 Downloading docker-compose.yml..."
curl -fsSL -o docker-compose.yml https://raw.githubusercontent.com/silvertakana/worldwideview/main/self-host/docker-compose.yml

# 2. Generate .env with a persistent secret
  if [ ! -f .env ]; then
  echo "🔐 Generating new .env file with secrets..."
  if command -v openssl &> /dev/null; then
    AUTH_SECRET=$(openssl rand -hex 32)
    ENCRYPTION_KEY=$(openssl rand -hex 16)
  else
    AUTH_SECRET=$(head -c 32 /dev/urandom | xxd -p -c 64)
    ENCRYPTION_KEY=$(head -c 16 /dev/urandom | xxd -p -c 32)
  fi
  echo "📥 Downloading .env template..."
  curl -fsSL -o .env https://raw.githubusercontent.com/silvertakana/worldwideview/main/.env.example
  
  perl -pi -e "s/^BETTER_AUTH_SECRET=.*$/BETTER_AUTH_SECRET=$AUTH_SECRET/" .env
  perl -pi -e "s/^ENCRYPTION_MASTER_KEY=.*$/ENCRYPTION_MASTER_KEY=$ENCRYPTION_KEY/" .env
else
  echo "✅ .env already exists, skipping generation."
fi

# 3. Start it
echo "📥 Pulling latest image updates..."
docker compose pull

echo "🚀 Starting Docker container..."
docker compose up -d

echo ""
echo "✅ WorldWideView is running at http://localhost:3000"
echo "   Data is persisted in Docker volume 'wwv-data'"
echo "   Auth secret is saved in .env (don't delete this file)"
echo ""
echo "To stop the server: docker compose down"
echo "To view logs: docker compose logs -f wwv"
