param([switch]$NoBuild)
$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
. (Join-Path $PSScriptRoot 'import-local-env.ps1')
$logDir = Join-Path $projectRoot 'artifacts'
New-Item -ItemType Directory -Path $logDir -Force | Out-Null
$pythonExe = Join-Path $projectRoot '.venv/Scripts/python.exe'
if (-not (Test-Path -LiteralPath $pythonExe)) { throw 'Create .venv and install intelligence/requirements.txt first; see docs/TESTING_GUIDE.md.' }
$javaDir = Get-ChildItem -LiteralPath (Join-Path $projectRoot '.tools/java') -Directory -ErrorAction SilentlyContinue | Select-Object -First 1
if ($javaDir) { $env:JAVA_HOME=$javaDir.FullName; $javaExe=Join-Path $env:JAVA_HOME 'bin/java.exe' } else { $javaExe=(Get-Command java -ErrorAction Stop).Source }
$mavenExe = Join-Path $projectRoot '.tools/maven/apache-maven-3.9.9/bin/mvn.cmd'
if (-not (Test-Path -LiteralPath $mavenExe)) { $mavenExe=(Get-Command mvn -ErrorAction Stop).Source }
$nodeExe = (Get-Command node -ErrorAction SilentlyContinue)?.Source
if (-not $nodeExe) {
    $candidatePaths = @(
        'C:\Program Files\nodejs\node.exe'
    )
    foreach ($cand in $candidatePaths) {
        if (Test-Path -LiteralPath $cand) {
            $nodeExe = $cand
            $nodeDir = Split-Path $cand
            $env:PATH = "$nodeDir;$env:PATH"
            break
        }
    }
}
if (-not $nodeExe) { throw 'Node.js is not found on PATH or in standard runtimes.' }
if (-not $NoBuild) {
    & $mavenExe -f (Join-Path $projectRoot 'backend/pom.xml') package -DskipTests -q
    if ($LASTEXITCODE -ne 0) { throw 'Backend build failed.' }
}
if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'frontend/node_modules/vite/bin/vite.js'))) { throw 'Run pnpm install in frontend first.' }
$tmpDir=Join-Path $projectRoot '.tools/tmp'
New-Item -ItemType Directory -Path $tmpDir -Force | Out-Null
$children=@()
try {
    $children+=Start-Process -FilePath $pythonExe -ArgumentList '-m','uvicorn','app:app','--host','127.0.0.1','--port','8000' -WorkingDirectory (Join-Path $projectRoot 'intelligence') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logDir 'intelligence.log') -RedirectStandardError (Join-Path $logDir 'intelligence-error.log') -PassThru
    $children+=Start-Process -FilePath $javaExe -ArgumentList ('"-Djdk.net.unixdomain.tmpdir=' + $tmpDir + '"'),'-jar','target/nexus-api-0.1.0.jar','--spring.profiles.active=local' -WorkingDirectory (Join-Path $projectRoot 'backend') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logDir 'api.log') -RedirectStandardError (Join-Path $logDir 'api-error.log') -PassThru
    $children+=Start-Process -FilePath $nodeExe -ArgumentList 'node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','8080' -WorkingDirectory (Join-Path $projectRoot 'frontend') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logDir 'frontend.log') -RedirectStandardError (Join-Path $logDir 'frontend-error.log') -PassThru
    Write-Host 'NEXUS starting at http://localhost:8080. Keep this terminal open. Ctrl+C stops these services.'
    $children | Select-Object Id,ProcessName | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $logDir 'local-processes.json')
    while ($true) { Start-Sleep -Seconds 2; foreach ($child in $children) { $child.Refresh(); if ($child.HasExited) { throw "Service $($child.ProcessName) exited; inspect artifacts/*.log." } } }
} finally { foreach ($child in $children) { if (-not $child.HasExited) { Stop-Process -Id $child.Id -Force -ErrorAction SilentlyContinue } } }
