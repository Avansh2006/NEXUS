$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$logDir = Join-Path $projectRoot 'artifacts'
New-Item -ItemType Directory -Path $logDir -Force | Out-Null
$logFile = Join-Path $logDir 'tunnel.log'
$errFile = Join-Path $logDir 'tunnel-err.log'
Remove-Item $logFile, $errFile -Force -ErrorAction SilentlyContinue

$sshArgs = @(
    '-R', '80:127.0.0.1:8080',
    '-o', 'StrictHostKeyChecking=no',
    '-o', 'ServerAliveInterval=30',
    '-o', 'ServerAliveCountMax=5',
    '-o', 'ExitOnForwardFailure=yes',
    'nokey@localhost.run'
)

$proc = Start-Process -FilePath "ssh" -ArgumentList $sshArgs -PassThru -RedirectStandardOutput $logFile -RedirectStandardError $errFile
for ($i = 0; $i -lt 15; $i++) {
    Start-Sleep -Seconds 1
    if (Test-Path -LiteralPath $logFile) {
        $log = Get-Content $logFile -Raw -ErrorAction SilentlyContinue
        if ($log) {
            $m = [regex]::Match($log, 'https://[a-zA-Z0-9]+\.lhr\.life')
            if ($m.Success) {
                Write-Host "PUBLIC_TUNNEL_URL: $($m.Value)"
                break
            }
        }
    }
}
