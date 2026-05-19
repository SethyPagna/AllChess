param(
  [string]$Source = "",
  [string]$Database = "allchess",
  [string]$Config = "wrangler.jsonc",
  [switch]$Remote,
  [switch]$Local
)

$ErrorActionPreference = "Stop"

if (-not $Source) {
  if ($env:CATALOG_SOURCE_URL) {
    $Source = $env:CATALOG_SOURCE_URL
  } elseif ($env:NEXT_PUBLIC_SITE_URL) {
    $Source = $env:NEXT_PUBLIC_SITE_URL
  } else {
    $Source = "https://allchess.learn-app.workers.dev"
  }
}

$target = if ($Remote) { "--remote" } elseif ($Local) { "--local" } else { "--local" }
$tempFile = Join-Path ([System.IO.Path]::GetTempPath()) ("allchess-catalog-" + [System.Guid]::NewGuid().ToString("N") + ".sql")

try {
  node scripts/data/sync-catalog-d1.mjs --source $Source --out $tempFile
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }

  $wrangler = Join-Path (Get-Location) "node_modules\.bin\wrangler.cmd"
  if (-not (Test-Path -LiteralPath $wrangler)) {
    $wrangler = "wrangler"
  }

  & $wrangler d1 execute $Database $target --config $Config --file $tempFile
  exit $LASTEXITCODE
} finally {
  Remove-Item -LiteralPath $tempFile -Force -ErrorAction SilentlyContinue
}
