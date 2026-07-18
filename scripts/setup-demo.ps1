[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

function Require-Command {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$Help
  )

  $command = Get-Command $Name -ErrorAction SilentlyContinue
  if (-not $command) {
    throw "$Name was not found. $Help"
  }
  return $command.Source
}

function Parse-Version {
  param(
    [Parameter(Mandatory = $true)][string]$Label,
    [Parameter(Mandatory = $true)][string]$Text
  )

  $match = [regex]::Match($Text, '\d+(?:\.\d+){1,3}')
  if (-not $match.Success) {
    throw "Could not parse the $Label version from: $Text"
  }
  return [version]$match.Value
}

function Invoke-NativeStep {
  param(
    [Parameter(Mandatory = $true)][string]$Label,
    [Parameter(Mandatory = $true)][string]$Command,
    [Parameter(Mandatory = $true)][string[]]$Arguments
  )

  Write-Host "[EduRecall] $Label" -ForegroundColor Green
  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$Label failed with exit code $LASTEXITCODE."
  }
}

function Test-WorkspaceLinkSupport {
  $probePath = Join-Path $ProjectRoot ".workspace-link-probe-$PID"
  $targetPath = Join-Path $ProjectRoot "apps\web"
  try {
    New-Item -ItemType Junction -Path $probePath -Target $targetPath -ErrorAction Stop | Out-Null
    return $true
  } catch {
    return $false
  } finally {
    if (Test-Path -LiteralPath $probePath) {
      Remove-Item -LiteralPath $probePath -Force -ErrorAction SilentlyContinue
    }
  }
}

function Get-FlatNodePackageSpecs {
  $packageFiles = @("package.json", "apps/api/package.json", "apps/web/package.json")
  $packages = @{}
  foreach ($packageFile in $packageFiles) {
    $manifest = Get-Content -Raw -LiteralPath $packageFile | ConvertFrom-Json
    foreach ($sectionName in @("dependencies", "devDependencies")) {
      $sectionProperty = $manifest.PSObject.Properties[$sectionName]
      if (-not $sectionProperty) { continue }
      $section = $sectionProperty.Value
      foreach ($property in $section.PSObject.Properties) {
        if ($property.Name -notlike "@edurecall/*") {
          $packages[$property.Name] = [string]$property.Value
        }
      }
    }
  }
  return @($packages.GetEnumerator() | Sort-Object Name | ForEach-Object { "$($_.Name)@$($_.Value)" })
}

Write-Host "[EduRecall] Checking demo prerequisites..." -ForegroundColor Green
$nodeCommand = Require-Command "node" "Install Node.js 20.9 or newer."
$npmCommand = Require-Command "npm" "npm is included with Node.js."

$nodeVersionText = (& $nodeCommand "--version" | Out-String).Trim()
$nodeVersion = Parse-Version "Node.js" $nodeVersionText
if ($nodeVersion -lt [version]"20.9.0") {
  throw "Node.js 20.9+ is required; found $nodeVersionText."
}

$npmVersionText = (& $npmCommand "--version" | Out-String).Trim()
$npmVersion = Parse-Version "npm" $npmVersionText
if ($npmVersion -lt [version]"10.0.0") {
  throw "npm 10+ is required; found $npmVersionText."
}

$pythonCommand = $null
$pythonExecutable = Get-Command "python" -ErrorAction SilentlyContinue
if ($pythonExecutable) {
  $pythonCommand = $pythonExecutable.Source
  $pythonVersionText = (& $pythonCommand "--version" 2>&1 | Out-String).Trim()
  if ($LASTEXITCODE -ne 0) {
    $pythonCommand = $null
  }
}

$pyLauncher = Get-Command "py" -ErrorAction SilentlyContinue
if (-not $pythonCommand -and $pyLauncher) {
  $pythonVersionText = (& $pyLauncher.Source "-3" "--version" 2>&1 | Out-String).Trim()
  if ($LASTEXITCODE -eq 0) {
    $pythonCommand = $pyLauncher.Source
  }
}

if (-not $pythonCommand) {
  throw "Python 3.11+ was not found. Install Python, then run this script again."
}

$pythonVersion = Parse-Version "Python" $pythonVersionText
if ($pythonVersion -lt [version]"3.11.0") {
  throw "Python 3.11+ is required; found $pythonVersionText."
}

Write-Host "[EduRecall] Node $nodeVersion; npm $npmVersion; Python $pythonVersion" -ForegroundColor DarkGreen

if (-not (Test-Path -LiteralPath ".env")) {
  Copy-Item -LiteralPath ".env.example" -Destination ".env"
  Write-Host "[EduRecall] Created .env from .env.example." -ForegroundColor Green
} else {
  Write-Host "[EduRecall] Keeping the existing .env file." -ForegroundColor DarkGreen
}

if (Test-WorkspaceLinkSupport) {
  Invoke-NativeStep "Installing Node dependencies..." $npmCommand @("install")
} else {
  Write-Warning "This filesystem cannot create npm workspace junctions. Installing a flat dependency tree instead."
  $flatPackageSpecs = Get-FlatNodePackageSpecs
  $flatInstallArguments = @(
    "install", "--workspaces=false", "--no-save", "--ignore-scripts", "--package-lock=false"
  ) + $flatPackageSpecs
  Invoke-NativeStep "Installing flat Node dependencies..." $npmCommand $flatInstallArguments
  Invoke-NativeStep "Generating Prisma Client..." $nodeCommand @(
    "node_modules/prisma/build/index.js", "generate", "--schema", "prisma/schema.prisma"
  )
}
Invoke-NativeStep "Creating the Python virtual environment and installing AI dependencies..." $npmCommand @("run", "ai:install")
Invoke-NativeStep "Validating repository assets..." $npmCommand @("run", "validate:assets")

$modelArtifact = "apps/ai-service/ml/artifacts/next_attempt_model.joblib"
if (-not (Test-Path -LiteralPath $modelArtifact)) {
  Write-Warning "The next-attempt model artifact is missing. Run 'npm run ai:data' and 'npm run ai:train' before the judged demo."
}

Write-Host ""
Write-Host "Demo setup completed without Docker or a database." -ForegroundColor Green
Write-Host "This mode stores API attempts and generated content in process memory." -ForegroundColor Yellow
Write-Host "Start all services: npm run dev"
Write-Host "Then, in a second PowerShell window: .\scripts\smoke-demo.ps1"
Write-Host "Runbook: docs/run-local-and-supabase.md"
