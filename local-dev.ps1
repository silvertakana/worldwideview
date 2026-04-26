Write-Host "[*] Setting up WorldWideView for Local Development..."

# Check for pnpm
try {
    $null = Get-Command pnpm -ErrorAction Stop
} catch {
    Write-Host "[Error] pnpm is not installed or not in PATH."
    Write-Host "Please install it first: https://pnpm.io/installation"
    exit 1
}

Write-Host "[*] Installing dependencies..."
pnpm install

Write-Host "[*] Running initial setup (generating secrets)..."
pnpm run setup

# Check for the sibling Data Engine repository
if (-not (Test-Path "../wwv-data-engine")) {
    Write-Host ""
    Write-Host "=====================================================================" -ForegroundColor Yellow
    Write-Host "[!] NOTICE: Local Data Engine not found at ../wwv-data-engine" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Frontend-Only Mode: You are developing the frontend UI." -ForegroundColor Green
    Write-Host "WorldWideView will automatically stream data from the Cloud Engine." -ForegroundColor Green
    Write-Host ""
    Write-Host "Full-Stack Mode: If you want to develop backend data seeders, you" -ForegroundColor Cyan
    Write-Host "must clone the open-source data engine as a sibling directory:" -ForegroundColor Cyan
    Write-Host "  cd ..; git clone https://github.com/silvertakana/wwv-data-engine"
    Write-Host "  cd wwv-data-engine; pnpm install"
    Write-Host "=====================================================================" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "[*] Starting local Next.js frontend server..."
Write-Host "   (To run the data engine backends concurrently, run: pnpm dev:all)"
pnpm run dev
