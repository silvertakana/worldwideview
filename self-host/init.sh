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

# 1. Generate docker-compose.yml
echo "📦 Creating docker-compose.yml..."
cat > docker-compose.yml << 'EOF'
services:
  wwv:
    image: ghcr.io/silvertakana/worldwideview:latest
    ports:
      - "3000:3000"
    volumes:
      - wwv-data:/app/data
    env_file:
      - .env
    restart: unless-stopped    # ← Auto-starts on boot

volumes:
  wwv-data:
EOF

# 2. Generate .env with a persistent secret
if [ ! -f .env ]; then
  echo "🔐 Generating new .env file with AUTH_SECRET..."
  # Use openssl if available, otherwise use urandom
  if command -v openssl &> /dev/null; then
    SECRET=$(openssl rand -hex 32)
  else
    SECRET=$(head -c 32 /dev/urandom | xxd -p)
  fi
  echo "AUTH_SECRET=$SECRET" > .env
  echo "NEXT_PUBLIC_WWV_EDITION=local" >> .env
else
  echo "✅ .env already exists, skipping generation."
fi

# 3. Start it
echo "🚀 Starting Docker container..."
docker compose up -d

echo ""
echo "✅ WorldWideView is running at http://localhost:3000"
echo "   Data is persisted in Docker volume 'wwv-data'"
echo "   Auth secret is saved in .env (don't delete this file)"
echo ""
echo "To stop the server: docker compose down"
echo "To view logs: docker compose logs -f wwv"
