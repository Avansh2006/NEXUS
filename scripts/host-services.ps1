$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
. (Join-Path $PSScriptRoot 'import-local-env.ps1')

$logDir = Join-Path $projectRoot 'artifacts'
New-Item -ItemType Directory -Path $logDir -Force | Out-Null

# 1. Terminate any previous instances if recorded or listening
$procFile = Join-Path $logDir 'local-processes.json'
if (Test-Path -LiteralPath $procFile) {
    try {
        $oldProcs = Get-Content -LiteralPath $procFile -Raw | ConvertFrom-Json
        foreach ($p in $oldProcs) {
            Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
        }
    } catch {}
}

# Also ensure ports 8000, 8080, 8081 are cleared
Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -in 8000, 8080, 8081 } | ForEach-Object {
    Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
}

# 2. Resolve runtimes
$pythonExe = Join-Path $projectRoot '.venv/Scripts/python.exe'
if (-not (Test-Path -LiteralPath $pythonExe)) { throw 'Python virtual environment not found in .venv.' }

$javaDir = Get-ChildItem -LiteralPath (Join-Path $projectRoot '.tools/java') -Directory -ErrorAction SilentlyContinue | Select-Object -First 1
if ($javaDir) { $env:JAVA_HOME = $javaDir.FullName; $javaExe = Join-Path $env:JAVA_HOME 'bin/java.exe' }
else { $javaExe = (Get-Command java -ErrorAction Stop).Source }

$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
$nodeExe = if ($nodeCmd) { $nodeCmd.Source } else { 'C:\Program Files\nodejs\node.exe' }
if (-not (Test-Path -LiteralPath $nodeExe)) { throw 'Node.js runtime not found.' }

$tmpDir = Join-Path $projectRoot '.tools/tmp'
New-Item -ItemType Directory -Path $tmpDir -Force | Out-Null

Write-Host ">>> Launching Python FastAPI Intelligence & ML Engine (Port 8000)..." -ForegroundColor Cyan
$pFastAPI = Start-Process -FilePath $pythonExe -ArgumentList '-m','uvicorn','app:app','--host','127.0.0.1','--port','8000' -WorkingDirectory (Join-Path $projectRoot 'intelligence') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logDir 'intelligence.log') -RedirectStandardError (Join-Path $logDir 'intelligence-error.log') -PassThru

Write-Host ">>> Launching Java Spring Boot Core Backend (Port 8081)..." -ForegroundColor Cyan
$pBackend = Start-Process -FilePath $javaExe -ArgumentList ('"-Djdk.net.unixdomain.tmpdir=' + $tmpDir + '"'),'-jar','target/nexus-api-0.1.0.jar','--spring.profiles.active=local' -WorkingDirectory (Join-Path $projectRoot 'backend') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logDir 'api.log') -RedirectStandardError (Join-Path $logDir 'api-error.log') -PassThru

Write-Host ">>> Launching React 19 Frontend Web Server (Port 8080)..." -ForegroundColor Cyan
$pFrontend = Start-Process -FilePath $nodeExe -ArgumentList 'node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','8080' -WorkingDirectory (Join-Path $projectRoot 'frontend') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logDir 'frontend.log') -RedirectStandardError (Join-Path $logDir 'frontend-error.log') -PassThru

$runningProcs = @(
    @{ Id = $pFastAPI.Id; ProcessName = "python-fastapi" },
    @{ Id = $pBackend.Id; ProcessName = "java-backend" },
    @{ Id = $pFrontend.Id; ProcessName = "node-frontend" }
)
$runningProcs | ConvertTo-Json | Set-Content -LiteralPath $procFile

# 3. Wait for health checks
Write-Host ">>> Polling health checks..." -ForegroundColor Yellow
$maxAttempts = 30
$fastApiReady = $false
$backendReady = $false
$frontendReady = $false

for ($i = 1; $i -le $maxAttempts; $i++) {
    Start-Sleep -Seconds 1
    if (-not $fastApiReady) {
        try {
            $h = Invoke-RestMethod -Uri "http://127.0.0.1:8000/health" -Method Get -TimeoutSec 2 -ErrorAction SilentlyContinue
            if ($h.status -eq 'ok') { $fastApiReady = $true; Write-Host "    [OK] FastAPI Intelligence Engine ready." -ForegroundColor Green }
        } catch {}
    }
    if (-not $backendReady) {
        try {
            $h = Invoke-RestMethod -Uri "http://127.0.0.1:8081/api/health" -Method Get -TimeoutSec 2 -ErrorAction SilentlyContinue
            if ($h.status -eq 'ok') { $backendReady = $true; Write-Host "    [OK] Spring Boot Backend ready." -ForegroundColor Green }
        } catch {}
    }
    if (-not $frontendReady) {
        try {
            $h = Invoke-WebRequest -Uri "http://127.0.0.1:8080" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
            if ($h.StatusCode -eq 200) { $frontendReady = $true; Write-Host "    [OK] React 19 Frontend ready." -ForegroundColor Green }
        } catch {}
    }
    if ($fastApiReady -and $backendReady -and $frontendReady) { break }
}

if (-not ($fastApiReady -and $backendReady -and $frontendReady)) {
    Write-Warning "One or more services did not respond within $maxAttempts seconds. Inspect artifacts/*.log"
} else {
    Write-Host "`n========================================================" -ForegroundColor Green
    Write-Host "   NEXUS FULL STACK IS LIVE AND HOSTED SUCCESSFULLY!" -ForegroundColor Green
    Write-Host "========================================================" -ForegroundColor Green
    Write-Host "Frontend Application:  http://localhost:8080" -ForegroundColor Cyan
    Write-Host "Backend Core REST API: http://127.0.0.1:8081/api" -ForegroundColor Cyan
    Write-Host "FastAPI Intel & ML:    http://127.0.0.1:8000" -ForegroundColor Cyan
    Write-Host "`nTo stop all services, run: .\scripts\stop-services.ps1" -ForegroundColor Gray
}
