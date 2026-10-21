param([string]$PostgresBin = 'C:\Program Files\PostgreSQL\17\bin')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$localDir = Join-Path $projectRoot '.local'
$pgData = Join-Path $localDir 'pgdata'
if (-not (Test-Path -LiteralPath (Join-Path $projectRoot '.env'))) { throw 'Configure the root .env first; see docs/local-demo.md.' }
New-Item -ItemType Directory -Path $localDir -Force | Out-Null
if (Test-Path -LiteralPath (Join-Path $pgData 'PG_VERSION')) {
  $pgCtl = Join-Path $PostgresBin 'pg_ctl.exe'
  if (-not (Test-Path -LiteralPath $pgCtl)) { throw 'Pass -PostgresBin with your PostgreSQL bin directory.' }
  & $pgCtl -D $pgData status | Out-Null
  if ($LASTEXITCODE -ne 0) {
    & $pgCtl -D $pgData -l (Join-Path $localDir 'postgres.log') -o '-h 127.0.0.1 -p 55433 -c shared_buffers=64MB -c max_connections=100' -w start
    if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL did not start; inspect .local/postgres.log.' }
  }
}
function Test-LocalPort([int]$Port) {
  $client = [Net.Sockets.TcpClient]::new()
  try { $client.Connect('127.0.0.1', $Port); return $true } catch { return $false } finally { $client.Dispose() }
}
$nodePath = (Get-Command node).Source
if (-not (Test-LocalPort 3000)) {
  Start-Process -FilePath $nodePath -ArgumentList '--env-file=../.env','src/server.js' -WorkingDirectory (Join-Path $projectRoot 'backend') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $localDir 'api.log') -RedirectStandardError (Join-Path $localDir 'api-error.log') | Out-Null
}
if (-not (Test-LocalPort 4200)) {
  Start-Process -FilePath $nodePath -ArgumentList 'node_modules/@angular/cli/bin/ng.js','serve','--host','127.0.0.1','--port','4200' -WorkingDirectory (Join-Path $projectRoot 'frontend') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $localDir 'web.log') -RedirectStandardError (Join-Path $localDir 'web-error.log') | Out-Null
}
for ($attempt = 0; $attempt -lt 30; $attempt++) {
  try {
    $response = Invoke-RestMethod 'http://127.0.0.1:4200/api/v1/health' -TimeoutSec 2
    if ($response.status -eq 'ok') { Write-Host 'HomeFinder ready: http://127.0.0.1:4200/properties'; exit 0 }
  } catch { }
  Start-Sleep -Seconds 1
}
throw 'The app did not become ready. Check .local logs and confirm ports 3000/4200 are not occupied by another project.'
