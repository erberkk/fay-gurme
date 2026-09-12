<#
.SYNOPSIS
  Imports hand-curated photo restorations into the project.

.DESCRIPTION
  Copies each restored PNG master into source/restored/ and converts it to the
  WebP file served at public/media/enhanced-<id>.webp. The conversion only
  changes the container format; resolution and composition are preserved.

.PARAMETER SourceDir
  Folder that contains the restored PNG files named <id>.png.

.EXAMPLE
  ./scripts/media/save-restored.ps1 -SourceDir D:\restorations
#>
param(
    [Parameter(Mandatory = $true)]
    [string]$SourceDir,
    [string[]]$Ids = @('2589', '2590', '2599', '2622', '2625', '2506')
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$archiveDir = Join-Path $projectRoot 'source\restored'
New-Item -ItemType Directory -Force $archiveDir | Out-Null

foreach ($id in $Ids) {
    $sourceFile = Join-Path $SourceDir "$id.png"
    $archiveFile = Join-Path $archiveDir "$id.png"
    $webFile = Join-Path $projectRoot "public\media\enhanced-$id.webp"
    Copy-Item -LiteralPath $sourceFile -Destination $archiveFile
    ffmpeg -hide_banner -loglevel error -y -i $archiveFile -c:v libwebp -quality 94 $webFile
}
