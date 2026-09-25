$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$logDir = Join-Path $projectRoot 'artifacts'
$procFile = Join-Path $logDir 'local-processes.json'

Write-Host ">>> Stopping NEXUS services..." -ForegroundColor Yellow

if (Test-Path -LiteralPath $procFile) {
    try {
        $oldProcs = Get-Content -LiteralPath $procFile -Raw | ConvertFrom-Json
        foreach ($p in $oldProcs) {
            Write-Host "Stopping $($p.ProcessName) (PID $($p.Id))..."
            Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
        }
        Remove-Item -LiteralPath $procFile -Force -ErrorAction SilentlyContinue
    } catch {}
}

# Ensure ports 8000, 8080, 8081 are cleared
Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -in 8000, 8080, 8081 } | ForEach-Object {
    Write-Host "Killing process on port $($_.LocalPort) (PID $($_.OwningProcess))..."
    Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
}

Write-Host ">>> All NEXUS services stopped." -ForegroundColor Green
