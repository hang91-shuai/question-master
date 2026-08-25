# 从 .env.local 读取 ANON_KEY，填入 cloudbaserc.json 占位符，使用无 BOM UTF-8
$root = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $root '.env.local'
$cfgPath = Join-Path $root 'cloudbaserc.json'

if (-not (Test-Path $envPath)) { Write-Error ".env.local not found"; exit 1 }
if (-not (Test-Path $cfgPath)) { Write-Error "cloudbaserc.json not found"; exit 1 }

$key = (Select-String -Path $envPath -Pattern '^VITE_CLOUDBASE_ANON_KEY=').Line -replace '^VITE_CLOUDBASE_ANON_KEY=',''
$key = $key.Trim()
if (-not $key) { Write-Error "ANON_KEY is empty"; exit 1 }

$content = Get-Content -Path $cfgPath -Raw -Encoding UTF8
$content = $content.Replace('__ANON_KEY_PLACEHOLDER__', $key)

# 写回无 BOM 的 UTF-8
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($cfgPath, $content, $utf8NoBom)
Write-Host "cloudbaserc.json updated. ANON_KEY filled (length: $($key.Length))"
