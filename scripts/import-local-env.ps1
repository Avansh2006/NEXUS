param([string]$SettingsPath = (Join-Path (Split-Path $PSScriptRoot -Parent) '.env'))
if (Test-Path -LiteralPath $SettingsPath) {
    foreach ($line in Get-Content -LiteralPath $SettingsPath) {
        if ($line -match '^([A-Z][A-Z0-9_]*)=(.*)$') {
            $settingName = $Matches[1]
            $settingValue = $Matches[2].Trim()
            if ($settingValue.StartsWith("'") -and $settingValue.EndsWith("'")) {
                $settingValue = $settingValue.Substring(1, $settingValue.Length - 2)
            }
            [Environment]::SetEnvironmentVariable($settingName, $settingValue, 'Process')
        }
    }
}
foreach ($requiredName in @('NEXUS_JWT_SECRET','NEXUS_ADMIN_PASSWORD_HASH','NEXUS_INVESTIGATOR_PASSWORD_HASH','NEXUS_VIEWER_PASSWORD_HASH')) {
    if (-not [Environment]::GetEnvironmentVariable($requiredName, 'Process')) {
        throw "Configure $requiredName using scripts/setup_credentials.py before starting."
    }
}
