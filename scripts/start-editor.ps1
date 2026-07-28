$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
node src/cli.mjs serve --open
