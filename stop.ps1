# Stop the docker containers (Redis + Backend). The frontend dev window
# can be closed manually with Ctrl+C in its PowerShell window.
$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
    Write-Host ">>> Stopping Redis + Backend (docker compose down)" -ForegroundColor Cyan
    docker compose down
    Write-Host "    [OK] Containers stopped." -ForegroundColor Green
    Write-Host ""
    Write-Host "Tip: close the frontend dev window with Ctrl+C, or just close it." -ForegroundColor Yellow
} finally {
    Pop-Location
}
