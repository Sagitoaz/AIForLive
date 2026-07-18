$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Require-Command([string]$Name, [string]$Help) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "$Name was not found. $Help"
  }
}

Write-Host "[EduRecall] Checking prerequisites..." -ForegroundColor Green
Require-Command "node" "Install Node.js 20.9 or newer."
Require-Command "npm" "npm is included with Node.js."
if (-not (Get-Command "py" -ErrorAction SilentlyContinue) -and -not (Get-Command "python" -ErrorAction SilentlyContinue)) {
  throw "Python was not found. Install Python 3.11 or newer."
}
Require-Command "docker" "Install Docker Desktop and start it."

if (-not (Test-Path ".env")) { Copy-Item ".env.example" ".env" }

Write-Host "[EduRecall] Installing Node dependencies..." -ForegroundColor Green
npm install
Write-Host "[EduRecall] Installing Python dependencies..." -ForegroundColor Green
npm run ai:install
Write-Host "[EduRecall] Starting PostgreSQL..." -ForegroundColor Green
docker compose up -d postgres
Write-Host "[EduRecall] Applying database migrations..." -ForegroundColor Green
npm run db:setup
Write-Host "[EduRecall] Generating deterministic synthetic data..." -ForegroundColor Green
npm run ai:data

if (-not (Test-Path "apps/ai-service/ml/artifacts/next_attempt_model.joblib")) {
  npm run ai:train
}

npm run db:seed
npm run validate:assets

Write-Host ""
Write-Host "Setup completed." -ForegroundColor Green
Write-Host "Run: npm run dev"
Write-Host "Web: http://localhost:3000"
Write-Host "API: http://localhost:4000/api/docs"
Write-Host "AI:  http://localhost:8001/docs"
Write-Host "Teacher: teacher@edurecall.local / Demo@123"
Write-Host "Student: minh@edurecall.local / Demo@123"
