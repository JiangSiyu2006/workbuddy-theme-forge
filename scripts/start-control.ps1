[CmdletBinding()]
param(
  [ValidateRange(1024,65535)][int]$CdpPort = 9223,
  [ValidateRange(1024,65535)][int]$ControlPort = 4782,
  [string]$WorkBuddyExe,
  [switch]$OpenBrowser
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot

function Find-WorkBuddy {
  if ($WorkBuddyExe -and (Test-Path -LiteralPath $WorkBuddyExe)) { return (Resolve-Path -LiteralPath $WorkBuddyExe).Path }
  if ($env:WORKBUDDY_EXE -and (Test-Path -LiteralPath $env:WORKBUDDY_EXE)) { return (Resolve-Path -LiteralPath $env:WORKBUDDY_EXE).Path }
  $candidates = @(
    (Join-Path $env:LOCALAPPDATA 'Programs\WorkBuddy\WorkBuddy.exe'),
    (Join-Path $env:LOCALAPPDATA 'workbuddy\WorkBuddy.exe'),
    (Join-Path $env:ProgramFiles 'WorkBuddy\WorkBuddy.exe')
  )
  if (${env:ProgramFiles(x86)}) { $candidates += (Join-Path ${env:ProgramFiles(x86)} 'WorkBuddy\WorkBuddy.exe') }
  foreach ($candidate in $candidates) { if (Test-Path -LiteralPath $candidate) { return (Resolve-Path -LiteralPath $candidate).Path } }
  foreach ($key in @('HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*','HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*','HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*')) {
    Get-ItemProperty $key -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like '*WorkBuddy*' -and $_.InstallLocation } | ForEach-Object {
      $candidate = Join-Path $_.InstallLocation 'WorkBuddy.exe'
      if (Test-Path -LiteralPath $candidate) { return (Resolve-Path -LiteralPath $candidate).Path }
    }
  }
  return $null
}

function Test-Cdp {
  try {
    $targets = Invoke-RestMethod -Uri "http://127.0.0.1:$CdpPort/json/list" -TimeoutSec 1
    return [bool]($targets | Where-Object { $_.type -eq 'page' -and $_.url -like '*renderer*' })
  } catch { return $false }
}

function Assert-CdpPortAvailable {
  $listeners = Get-NetTCPConnection -State Listen -LocalPort $CdpPort -ErrorAction SilentlyContinue
  foreach ($listener in $listeners) {
    $owner = Get-Process -Id $listener.OwningProcess -ErrorAction SilentlyContinue
    if ($owner -and $owner.ProcessName -notlike 'WorkBuddy*') {
      throw "CDP port $CdpPort is already owned by $($owner.ProcessName) (PID $($owner.Id))."
    }
  }
}

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { throw 'Node.js 20 or newer is required.' }
$nodeMajor = [int]((& $node.Source -p "Number(process.versions.node.split('.')[0])").Trim())
if ($nodeMajor -lt 20) { throw "Node.js 20 or newer is required; found $nodeMajor." }

if (-not (Test-Cdp)) {
  Assert-CdpPortAvailable
  $exe = Find-WorkBuddy
  if (-not $exe) { throw 'WorkBuddy.exe was not found. Use -WorkBuddyExe or set WORKBUDDY_EXE.' }
  Write-Warning 'WorkBuddy must restart with local CDP enabled. Save unfinished tasks before continuing.'
  $answer = Read-Host 'Restart WorkBuddy now? Type YES to confirm'
  if ($answer -cne 'YES') { throw 'Restart cancelled; WorkBuddy was not changed.' }
  Get-Process WorkBuddy -ErrorAction SilentlyContinue | Stop-Process
  Start-Sleep -Seconds 2
  Start-Process -FilePath $exe -ArgumentList "--remote-debugging-port=$CdpPort"
  $deadline = (Get-Date).AddSeconds(30)
  while (-not (Test-Cdp)) {
    if ((Get-Date) -ge $deadline) { throw 'WorkBuddy CDP did not become ready within 30 seconds.' }
    Start-Sleep -Milliseconds 400
  }
}

Set-Location -LiteralPath $ProjectRoot
$arguments = @('src/cli.mjs','serve','--port',"$CdpPort",'--editor-port',"$ControlPort")
if ($OpenBrowser) { $arguments += '--open' }
& $node.Source @arguments
