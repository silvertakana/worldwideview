Write-Host "[*] Setting up WorldWideView for local self-hosting..."

# Check Docker
try {
    $null = docker info 2>&1
    if ($LASTEXITCODE -ne 0) { throw }
} catch {
    Write-Host "[Error] Docker is not running or not accessible."
    Write-Host "Please install or start Docker Desktop: https://docs.docker.com/get-docker/"
    exit 1
}

# Check Docker Compose
try {
    $null = docker compose version 2>&1
    if ($LASTEXITCODE -ne 0) { throw }
} catch {
    Write-Host "[Error] Docker Compose is not installed or accessible."
    exit 1
}

# Generate docker-compose.yml
Write-Host "[*] Creating docker-compose.yml..."

$dockerCompose = @(
"services:"
"  wwv:"
"    image: ghcr.io/silvertakana/worldwideview:latest"
"    ports:"
"      - `"3000:3000`""
"    volumes:"
"      - wwv-data:/app/data"
"    env_file:"
"      - .env"
"    restart: unless-stopped"
""
"volumes:"
"  wwv-data:"
)

$dockerCompose | Out-File -FilePath docker-compose.yml -Encoding utf8

# Generate .env
if (-Not (Test-Path .env)) {
    Write-Host "[*] Generating new .env file with AUTH_SECRET..."
    $bytes = New-Object Byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $secret = -join ($bytes | ForEach-Object { $_.ToString("x2") })
    "AUTH_SECRET=$secret" | Out-File -FilePath .env -Encoding ascii
    "NEXT_PUBLIC_WWV_EDITION=local" | Out-File -FilePath .env -Encoding ascii -Append
} else {
    Write-Host "[Success] .env already exists, skipping generation."
}

Write-Host "[*] Starting Docker container..."
docker compose up -d

Write-Host "`n[Success] WorldWideView is running at http://localhost:3000"
Write-Host "   Data is persisted in Docker volume 'wwv-data'"
Write-Host "   Auth secret is saved in .env (don't delete this file)`n"
Write-Host "To stop the server: docker compose down"
Write-Host "To view logs: docker compose logs -f wwv"
