# ----------------------------------------------------------------------
#  FinAgent — one-click dev launcher
# ----------------------------------------------------------------------
#  Starts:
#    - Redis + Backend (via docker compose)
#    - Frontend Next.js dev server (in a new PowerShell window)
#  Then waits for both, and opens http://localhost:3000 in your browser.
#
#  Run from the repo root:
#      powershell -ExecutionPolicy Bypass -File .\start.ps1
#  Or right-click → "Run with PowerShell".
# ----------------------------------------------------------------------

$ErrorActionPreference = 'Stop'
$RepoRoot   = $PSScriptRoot
$BackendUrl = 'http://localhost:8000'
$FrontendUrl = 'http://localhost:3000'

function Step($msg) { Write-Host "" ; Write-Host ">>> $msg" -ForegroundColor Cyan }
function Ok($msg)   { Write-Host "    [OK] $msg"   -ForegroundColor Green }
function Warn($msg) { Write-Host "    [!]  $msg"   -ForegroundColor Yellow }
function Fail($msg) { Write-Host "    [X]  $msg"   -ForegroundColor Red ; exit 1 }

# ---------- 1. Sanity checks ----------
Step "Checking prerequisites"

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Fail "Docker isn't on your PATH. Install Docker Desktop and make sure it's running, then try again."
}
try { docker info 2>&1 | Out-Null } catch {
    Fail "Docker Desktop isn't running. Open it, wait for the whale icon to settle, then re-run this script."
}
Ok "Docker available"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Fail "Node.js isn't on your PATH. Install Node 20+ from https://nodejs.org and try again."
}
$nodeVer = (node --version).TrimStart('v')
$nodeMajor = [int]($nodeVer -split '\.')[0]
if ($nodeMajor -lt 20) {
    Warn "Node $nodeVer detected — Next.js wants 20+. You may hit warnings."
} else {
    Ok "Node $nodeVer"
}

if (-not (Test-Path "$RepoRoot\.env")) {
    Fail ".env not found at repo root. Copy .env.example to .env and fill in DATABASE_URL + OPENAI_API_KEY."
}
Ok ".env present"

if (-not (Test-Path "$RepoRoot\frontend-next\.env.local")) {
    Warn "frontend-next\.env.local not found — copying from .env.local.example"
    Copy-Item "$RepoRoot\frontend-next\.env.local.example" "$RepoRoot\frontend-next\.env.local"
}

# ---------- 2. Start backend + redis via docker compose ----------
Step "Starting Redis + Backend (docker compose)"
Push-Location $RepoRoot
try {
    docker compose up -d --build
    if ($LASTEXITCODE -ne 0) { Fail "docker compose failed. Run 'docker compose logs' to see why." }
} finally {
    Pop-Location
}
Ok "docker compose up issued"

# ---------- 3. Wait for backend /health ----------
Step "Waiting for backend at $BackendUrl/health"
$deadline = (Get-Date).AddSeconds(120)
$ready = $false
while ((Get-Date) -lt $deadline) {
    try {
        $r = Invoke-WebRequest -Uri "$BackendUrl/health" -UseBasicParsing -TimeoutSec 2
        if ($r.StatusCode -eq 200) { $ready = $true; break }
    } catch { }
    Start-Sleep -Milliseconds 800
    Write-Host "." -NoNewline
}
Write-Host ""
if (-not $ready) {
    Warn "Backend didn't answer /health within 2 minutes. Check 'docker compose logs backend' for errors."
    Warn "Continuing anyway — the frontend will retry on its own."
} else {
    Ok "Backend up at $BackendUrl"
}

# ---------- 4. Install frontend deps if needed ----------
Step "Preparing frontend"
$frontend = Join-Path $RepoRoot 'frontend-next'
if (-not (Test-Path (Join-Path $frontend 'node_modules'))) {
    Warn "node_modules missing — running 'npm install' (this can take a few minutes the first time)"
    Push-Location $frontend
    try {
        npm install
        if ($LASTEXITCODE -ne 0) { Fail "npm install failed. Check the output above." }
    } finally {
        Pop-Location
    }
} else {
    Ok "node_modules already present"
}

# ---------- 5. Launch frontend in a new window ----------
Step "Starting Next.js dev server in a new window"
$startCmd = "Set-Location '$frontend'; Write-Host 'FinAgent frontend dev server' -ForegroundColor Cyan; npm run dev"
Start-Process powershell -ArgumentList '-NoExit', '-Command', $startCmd | Out-Null
Ok "Frontend window launched"

# ---------- 6. Wait for frontend, then open browser ----------
Step "Waiting for frontend at $FrontendUrl"
$deadline = (Get-Date).AddSeconds(120)
$ready = $false
while ((Get-Date) -lt $deadline) {
    try {
        $r = Invoke-WebRequest -Uri $FrontendUrl -UseBasicParsing -TimeoutSec 2
        if ($r.StatusCode -lt 500) { $ready = $true; break }
    } catch { }
    Start-Sleep -Milliseconds 800
    Write-Host "." -NoNewline
}
Write-Host ""

if ($ready) {
    Ok "Frontend up at $FrontendUrl — opening browser"
    Start-Process $FrontendUrl
} else {
    Warn "Frontend didn't answer in 2 minutes. Look at the new PowerShell window for errors."
    Warn "When it's ready, open $FrontendUrl manually."
}

# ---------- 7. Summary ----------
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  FinAgent is running" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  App           : $FrontendUrl"
Write-Host "  Backend API   : $BackendUrl"
Write-Host "  API docs      : $BackendUrl/docs"
Write-Host "  Analytics tab : $FrontendUrl/analytics"
Write-Host ""
Write-Host "  Stop:    .\stop.ps1   (or)   docker compose down  +  close the frontend window"
Write-Host "  Logs:    docker compose logs -f backend"
Write-Host ""
