param(
    [string]$OutputDir = 'github-safe'
)

$ErrorActionPreference = 'Stop'

$projectDir = Split-Path -Parent $PSScriptRoot
$targetDir = Join-Path $projectDir $OutputDir

function Reset-Directory {
    param([string]$Path)

    if (Test-Path -LiteralPath $Path) {
        Remove-Item -LiteralPath $Path -Recurse -Force
    }

    New-Item -ItemType Directory -Path $Path | Out-Null
}

function Copy-IfExists {
    param(
        [string]$Root,
        [string]$RelativePath,
        [string]$DestinationRoot
    )

    $src = Join-Path $Root $RelativePath
    if (-not (Test-Path -LiteralPath $src)) { return }

    $dst = Join-Path $DestinationRoot $RelativePath
    $parent = Split-Path -Parent $dst
    if ($parent -and -not (Test-Path -LiteralPath $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }

    Copy-Item -LiteralPath $src -Destination $dst -Recurse -Force
}

Reset-Directory -Path $targetDir

# Lista de arquivos/pastas que podem ir para o GitHub sem dados locais.
$allowedItems = @(
    '.editorconfig',
    'LICENSE',
    'package.json',
    'package-lock.json',
    'server.js',
    'iniciar-servidores.bat',
    'encerrar-servidores.bat',
    'reiniciar-servidores.bat',
    'check-text.bat',
    'start-localhost-ngrok.ps1',
    'stop-localhost-ngrok.ps1',
    'public',
    'routes',
    'scripts',
    'utils'
)

foreach ($item in $allowedItems) {
    Copy-IfExists -Root $projectDir -RelativePath $item -DestinationRoot $targetDir
}

# Remove qualquer artefato local ou segredo que possa ter sido copiado indiretamente.
$blockedItems = @(
    '.env',
    'mercado_pago_webhooks.json',
    '.run',
    '.vscode',
    'node_modules',
    'testes'
)

foreach ($item in $blockedItems) {
    $path = Join-Path $targetDir $item
    if (Test-Path -LiteralPath $path) {
        Remove-Item -LiteralPath $path -Recurse -Force -ErrorAction SilentlyContinue
    }
}

# Sanitiza credenciais padrao de dev no auth para nao publicar senha conhecida.
$authPath = Join-Path $targetDir 'public\auth.js'
if (Test-Path -LiteralPath $authPath) {
    $authText = Get-Content -Raw -LiteralPath $authPath
    $authText = $authText -replace "password:\s*'[^']+'", "password: 'change-me'"
    Set-Content -LiteralPath $authPath -Value $authText -Encoding UTF8
}

$envExample = @'
# Copie este arquivo para ".env" no ambiente local e preencha os valores.
PORT=3000
MERCADO_PAGO_ACCESS_TOKEN=
MERCADO_PAGO_WEBHOOK_SECRET=
MERCADO_PAGO_WHATSAPP_NUMERO=
NGROK_AUTHTOKEN=
'@
Set-Content -LiteralPath (Join-Path $targetDir '.env.example') -Value $envExample -Encoding UTF8

$gitIgnore = @'
node_modules/
.run/
.vscode/
.env
mercado_pago_webhooks.json
*.log
*.pid
'@
Set-Content -LiteralPath (Join-Path $targetDir '.gitignore') -Value $gitIgnore -Encoding UTF8

$readmeSafe = @'
# Publicacao segura no GitHub

Esta pasta foi gerada para upload no GitHub sem segredos locais.

## O que foi removido
- .env
- mercado_pago_webhooks.json
- .run
- node_modules
- testes (imagens locais)

## Antes de rodar
1. Copie ".env.example" para ".env"
2. Preencha seus tokens locais no ".env"
3. Rode "npm install"
4. Rode "npm start" (ou os arquivos .bat de servidor)

## Observacao
As senhas padrao de dev em "public/auth.js" foram trocadas para "change-me" nesta pasta.
'@
Set-Content -LiteralPath (Join-Path $targetDir 'README-SAFE-UPLOAD.md') -Value $readmeSafe -Encoding UTF8

Write-Host ''
Write-Host "Pasta segura criada em: $targetDir" -ForegroundColor Green
Write-Host 'Pronto para subir no GitHub.' -ForegroundColor Green
