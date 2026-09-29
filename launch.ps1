$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $scriptDir) { $scriptDir = $PSScriptRoot }
if (-not $scriptDir) { $scriptDir = (Get-Location).Path }
$indexPath = Join-Path $scriptDir "index.html"
$fileUri = [System.Uri]::new($indexPath).AbsoluteUri
$profileDir = Join-Path $env:TEMP "spolujazda_edge_app"

$edge = (Get-Item "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" -ErrorAction SilentlyContinue).FullName
if (-not $edge) {
    $edge = (Get-Item "C:\Program Files\Microsoft\Edge\Application\msedge.exe" -ErrorAction SilentlyContinue).FullName
}
if (-not $edge) { $edge = "msedge.exe" }

Start-Process $edge -ArgumentList @(
    "--app=$fileUri",
    "--window-size=430,920",
    "--user-data-dir=$profileDir",
    "--allow-file-access-from-files"
)
