$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
. (Join-Path $PSScriptRoot 'import-local-env.ps1')
$javaDir = Get-ChildItem -LiteralPath (Join-Path $projectRoot '.tools/java') -Directory -ErrorAction SilentlyContinue | Select-Object -First 1
if ($javaDir) { $env:JAVA_HOME = $javaDir.FullName }
$mavenExe = Join-Path $projectRoot '.tools/maven/apache-maven-3.9.9/bin/mvn.cmd'
if (-not (Test-Path -LiteralPath $mavenExe)) { $mavenExe = (Get-Command mvn -ErrorAction Stop).Source }
Push-Location (Join-Path $projectRoot 'backend')
try {
    & $mavenExe 'spring-boot:run' '-Dspring-boot.run.profiles=local' '-Dspring-boot.run.jvmArguments=-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=127.0.0.1:5005'
    $debugExitCode = $LASTEXITCODE
} finally { Pop-Location }
exit $debugExitCode
