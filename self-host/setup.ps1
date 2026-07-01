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
Write-Host "[*] Downloading docker-compose.yml..."
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/silvertakana/worldwideview/main/self-host/docker-compose.yml" -OutFile docker-compose.yml

# Generate .env
if (-Not (Test-Path .env)) {
    Write-Host "[*] Generating new .env file with secrets..."
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $authBytes = New-Object Byte[] 32
    $rng.GetBytes($authBytes)
    $encBytes = New-Object Byte[] 16
    $rng.GetBytes($encBytes)
    $authSecret = -join ($authBytes | ForEach-Object { $_.ToString("x2") })
    $encKey = -join ($encBytes | ForEach-Object { $_.ToString("x2") })
    Write-Host "[*] Downloading .env template..."
    Invoke-WebRequest -Uri "https://raw.githubusercontent.com/silvertakana/worldwideview/main/.env.example" -OutFile .env
    
    $envContent = Get-Content .env -Raw
    $envContent = $envContent -replace "(?m)^BETTER_AUTH_SECRET=.*", "BETTER_AUTH_SECRET=$authSecret"
    $envContent = $envContent -replace "(?m)^ENCRYPTION_MASTER_KEY=.*", "ENCRYPTION_MASTER_KEY=$encKey"
    $envContent | Out-File -FilePath .env -Encoding utf8
} else {
    Write-Host "[Success] .env already exists, skipping generation."
}

Write-Host "[*] Pulling latest image updates..."
docker compose pull

Write-Host "[*] Starting Docker container..."
docker compose up -d

Write-Host "`n[Success] WorldWideView is running at http://localhost:3000"
Write-Host "   Data is persisted in Docker volume 'wwv-data'"
Write-Host "   Auth secret is saved in .env (don't delete this file)`n"
Write-Host "To stop the server: docker compose down"
Write-Host "To view logs: docker compose logs -f wwv"
