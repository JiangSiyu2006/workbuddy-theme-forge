[CmdletBinding()]
param(
  [ValidateRange(1024,65535)][int]$CdpPort,
  [ValidateRange(1024,65535)][int]$ControlPort = 4782,
  [string]$WorkBuddyExe,
  [switch]$OpenBrowser
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$script:HasExplicitCdp = $PSBoundParameters.ContainsKey('CdpPort') -and $CdpPort

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
    foreach ($item in @(Get-ItemProperty $key -ErrorAction SilentlyContinue)) {
      if ($item.DisplayName -notlike '*WorkBuddy*' -or -not $item.InstallLocation) { continue }
      $candidate = Join-Path $item.InstallLocation 'WorkBuddy.exe'
      if (Test-Path -LiteralPath $candidate) { return (Resolve-Path -LiteralPath $candidate).Path }
    }
  }
  return $null
}

function Get-FreeCdpPort {
  $defaultOwner = Get-NetTCPConnection -State Listen -LocalPort 9223 -ErrorAction SilentlyContinue
  if (-not $defaultOwner) { return 9223 }
  $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
  try { $listener.Start(); return ([System.Net.IPEndPoint]$listener.LocalEndpoint).Port } finally { $listener.Stop() }
}

function Stop-WorkBuddyForRestart {
  $processes = @(Get-Process WorkBuddy -ErrorAction SilentlyContinue)
  if (-not $processes) { return }

  # Give the main Electron window a short opportunity to shut down normally.
  foreach ($process in $processes) { if ($process.MainWindowHandle -ne 0) { [void]$process.CloseMainWindow() } }
  $deadline = (Get-Date).AddSeconds(5)
  while ((Get-Process WorkBuddy -ErrorAction SilentlyContinue) -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 250 }

  # Electron background and child processes can survive after the window closes.
  # The user already confirmed the restart with an exact YES, so terminate only the
  # remaining processes whose executable name is exactly WorkBuddy.
  $remaining = @(Get-Process WorkBuddy -ErrorAction SilentlyContinue)
  foreach ($process in $remaining) {
    Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
  }

  $deadline = (Get-Date).AddSeconds(8)
  while ((Get-Process WorkBuddy -ErrorAction SilentlyContinue) -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 250 }
  if (Get-Process WorkBuddy -ErrorAction SilentlyContinue) { throw 'WorkBuddy processes could not be terminated; restart was cancelled.' }
}

$script:Node = Get-Command node -ErrorAction SilentlyContinue
if (-not $script:Node) { throw 'Node.js 20 or newer is required.' }
$nodeMajor = [int]((& $script:Node.Source -p "Number(process.versions.node.split('.')[0])").Trim())
if ($nodeMajor -lt 20) { throw "Node.js 20 or newer is required; found $nodeMajor." }

Set-Location -LiteralPath $ProjectRoot
$exe = Find-WorkBuddy
if (-not $exe) { throw 'WorkBuddy.exe was not found. Use -WorkBuddyExe or set WORKBUDDY_EXE.' }

$workBuddyRunning = @(Get-Process WorkBuddy -ErrorAction SilentlyContinue).Count -gt 0
if ($workBuddyRunning) {
  Write-Warning 'WorkBuddy is running. Save unfinished tasks before continuing; the existing instance will be restarted.'
  $answer = Read-Host 'Restart WorkBuddy and open Theme Forge now? Type YES to confirm'
  $cancelMessage = 'Restart cancelled; WorkBuddy was not changed.'
  $portSource = 'managed-restart'
} else {
  $answer = Read-Host 'Start WorkBuddy and open Theme Forge now? Type YES to confirm'
  $cancelMessage = 'Start cancelled; WorkBuddy was not changed.'
  $portSource = 'managed-start'
}
if ($answer -cne 'YES') { throw $cancelMessage }

if ($workBuddyRunning) { Stop-WorkBuddyForRestart }
$selectedPort = if ($script:HasExplicitCdp) { $CdpPort } else { Get-FreeCdpPort }
$listeners = Get-NetTCPConnection -State Listen -LocalPort $selectedPort -ErrorAction SilentlyContinue
if ($listeners) { throw "Selected CDP port $selectedPort is already in use." }

Start-Process -FilePath $exe -ArgumentList @("--remote-debugging-address=127.0.0.1", "--remote-debugging-port=$selectedPort")

$ready = & $script:Node.Source (Join-Path $PSScriptRoot 'wait-cdp.mjs') --port $selectedPort --timeout 30000
if ($LASTEXITCODE -ne 0 -or -not $ready) { throw 'WorkBuddy CDP did not become ready within 30 seconds.' }
$readiness = $ready | ConvertFrom-Json
if (-not $readiness.ok -or $readiness.port -ne $selectedPort) { throw 'The newly started WorkBuddy CDP endpoint could not be verified.' }

$arguments = @('src/cli.mjs','serve','--port',"$selectedPort",'--editor-port',"$ControlPort",'--port-source',$portSource,'--owner-verified')
if ($OpenBrowser) { $arguments += '--open' }
& $script:Node.Source @arguments
