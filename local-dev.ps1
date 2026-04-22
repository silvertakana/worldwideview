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

Write-Host "[*] Starting local Next.js frontend server..."
Write-Host "   (To run the data engine backends concurrently, run: pnpm dev:all)"
pnpm run dev
