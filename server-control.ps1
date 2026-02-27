param(
    [ValidateSet('start', 'stop', 'restart', 'status')]
    [string]$Action = 'start',
    [int]$Port = 3000,
    [string]$ServerScript = 'server.js',
    [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'

$projectDir = Split-Path -Parent $PSScriptRoot
$runDir = Join-Path $projectDir '.run'
$pidFile = Join-Path $runDir 'server.pid'
$serverPath = Join-Path $projectDir $ServerScript
$homeUrl = "http://localhost:$Port/index.html"
$probeUrl = "http://127.0.0.1:$Port/index.html"

function Ensure-RunDir {
    if (-not (Test-Path $runDir)) {
        New-Item -ItemType Directory -Path $runDir | Out-Null
    }
}

function Read-Pid {
    if (-not (Test-Path $pidFile)) { return $null }
    $raw = (Get-Content -Path $pidFile -ErrorAction SilentlyContinue | Select-Object -First 1)
    $value = 0
    if ([int]::TryParse([string]$raw, [ref]$value) -and $value -gt 0) {
        return $value
    }
    return $null
}

function Write-Pid {
    param([int]$PidValue)
    Ensure-RunDir
    Set-Content -Path $pidFile -Value ([string]$PidValue)
}

function Clear-Pid {
    Remove-Item -Path $pidFile -Force -ErrorAction SilentlyContinue
}

function Get-ProcessByIdSafe {
    param([int]$Id)
    if (-not $Id) { return $null }
    return Get-Process -Id $Id -ErrorAction SilentlyContinue
}

function Get-ListenerProcessOnPort {
    param([int]$TargetPort)
    $listener = Get-NetTCPConnection -State Listen -LocalPort $TargetPort -ErrorAction SilentlyContinue |
        Select-Object -First 1
    if (-not $listener) { return $null }
    return Get-ProcessByIdSafe -Id ([int]$listener.OwningProcess)
}

function Wait-ServerUp {
    param([string]$Url, [int]$TimeoutSec = 25)
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        try {
            Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 2 | Out-Null
            return $true
        } catch {
            Start-Sleep -Milliseconds 400
        }
    }
    return $false
}

function Stop-Server {
    $stopped = $false

    $savedPid = Read-Pid
    $proc = Get-ProcessByIdSafe -Id $savedPid
    if ($proc -and $proc.ProcessName -match '^node') {
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
        $stopped = $true
    }

    if (-not $stopped) {
        $portProc = Get-ListenerProcessOnPort -TargetPort $Port
        if ($portProc -and $portProc.ProcessName -match '^node') {
            Stop-Process -Id $portProc.Id -Force -ErrorAction SilentlyContinue
            $stopped = $true
        }
    }

    Clear-Pid

    if ($stopped) {
        Write-Host "Servidor encerrado na porta $Port." -ForegroundColor Green
    } else {
        Write-Host "Nenhum servidor Node ativo encontrado na porta $Port."
    }
}

function Start-Server {
    if (-not (Test-Path $serverPath)) {
        throw "Arquivo nao encontrado: $serverPath"
    }

    $existingByPid = Get-ProcessByIdSafe -Id (Read-Pid)
    if ($existingByPid -and $existingByPid.ProcessName -match '^node') {
        Write-Host "Servidor ja esta em execucao (PID $($existingByPid.Id))."
        Write-Host "URL: $homeUrl"
        return
    }

    $existingByPort = Get-ListenerProcessOnPort -TargetPort $Port
    if ($existingByPort -and $existingByPort.ProcessName -match '^node') {
        Write-Pid -PidValue $existingByPort.Id
        Write-Host "Servidor ja esta em execucao na porta $Port (PID $($existingByPort.Id))."
        Write-Host "URL: $homeUrl"
        return
    }

    $proc = Start-Process -FilePath 'node' -ArgumentList $ServerScript -WorkingDirectory $projectDir -PassThru -WindowStyle Hidden
    Write-Pid -PidValue $proc.Id

    if (-not (Wait-ServerUp -Url $probeUrl -TimeoutSec 30)) {
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
        Clear-Pid
        throw "Servidor nao respondeu em $probeUrl."
    }

    if (-not $NoBrowser) {
        Start-Process $homeUrl
    }

    Write-Host "Servidor iniciado com sucesso (PID $($proc.Id))." -ForegroundColor Green
    Write-Host "URL: $homeUrl"
}

switch ($Action) {
    'start' {
        Start-Server
    }
    'stop' {
        Stop-Server
    }
    'restart' {
        Stop-Server
        Start-Sleep -Milliseconds 350
        Start-Server
    }
    'status' {
        $proc = Get-ProcessByIdSafe -Id (Read-Pid)
        if (-not $proc) {
            $proc = Get-ListenerProcessOnPort -TargetPort $Port
        }
        if ($proc -and $proc.ProcessName -match '^node') {
            Write-Host "Servidor ativo (PID $($proc.Id)) na porta $Port."
            Write-Host "URL: $homeUrl"
        } else {
            Write-Host "Servidor inativo na porta $Port."
        }
    }
}
