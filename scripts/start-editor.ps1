$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
node apps/editor/server.mjs
