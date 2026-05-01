#Requires -Version 5.1
<#
.SYNOPSIS
    PM Code installer for Windows
.DESCRIPTION
    Downloads and installs the PM Code VS Code extension, creates config directory.
.EXAMPLE
    iwr -useb https://raw.githubusercontent.com/caseyg/pmcode/main/install.ps1 | iex
#>

$ErrorActionPreference = "Stop"
$Repo = "caseyg/pmcode"
$PmCodeDir = Join-Path $env:USERPROFILE ".pmcode"

function Write-Info($msg)  { Write-Host "[pmcode] $msg" -ForegroundColor Green }
function Write-Warn($msg)  { Write-Host "[pmcode] $msg" -ForegroundColor Yellow }
function Write-Err($msg)   { Write-Host "[pmcode] $msg" -ForegroundColor Red }

# ── Detect VS Code variants ────────────────────────────────────────────────

function Find-Editors {
    $editors = @()

    # VS Code
    $codePaths = @(
        (Get-Command "code" -ErrorAction SilentlyContinue),
        (Get-Command "code.cmd" -ErrorAction SilentlyContinue)
    ) | Where-Object { $_ -ne $null }
    if ($codePaths.Count -gt 0) { $editors += $codePaths[0].Source }

    # VS Code Insiders
    $insidersPaths = @(
        (Get-Command "code-insiders" -ErrorAction SilentlyContinue),
        (Get-Command "code-insiders.cmd" -ErrorAction SilentlyContinue)
    ) | Where-Object { $_ -ne $null }
    if ($insidersPaths.Count -gt 0) { $editors += $insidersPaths[0].Source }

    # Cursor
    $cursorPaths = @(
        (Get-Command "cursor" -ErrorAction SilentlyContinue),
        (Get-Command "cursor.cmd" -ErrorAction SilentlyContinue)
    ) | Where-Object { $_ -ne $null }
    if ($cursorPaths.Count -gt 0) { $editors += $cursorPaths[0].Source }

    # Windsurf
    $windsurfPaths = @(
        (Get-Command "windsurf" -ErrorAction SilentlyContinue),
        (Get-Command "windsurf.cmd" -ErrorAction SilentlyContinue)
    ) | Where-Object { $_ -ne $null }
    if ($windsurfPaths.Count -gt 0) { $editors += $windsurfPaths[0].Source }

    # Check common install locations
    $commonPaths = @(
        "$env:LOCALAPPDATA\Programs\Microsoft VS Code\bin\code.cmd",
        "$env:LOCALAPPDATA\Programs\Microsoft VS Code Insiders\bin\code-insiders.cmd",
        "$env:LOCALAPPDATA\Programs\cursor\resources\app\bin\cursor.cmd",
        "$env:LOCALAPPDATA\Programs\Windsurf\bin\windsurf.cmd"
    )
    foreach ($p in $commonPaths) {
        if ((Test-Path $p) -and ($editors -notcontains $p)) {
            $editors += $p
        }
    }

    if ($editors.Count -eq 0) {
        Write-Err "No VS Code variant found. Please install one of:"
        Write-Err "  - VS Code:    https://code.visualstudio.com"
        Write-Err "  - Cursor:     https://cursor.com"
        Write-Err "  - Windsurf:   https://windsurf.ai"
        exit 1
    }

    return $editors
}

# ── Download latest .vsix ──────────────────────────────────────────────────

function Get-Vsix {
    $tmpDir = Join-Path $env:TEMP "pmcode-install-$(Get-Random)"
    New-Item -ItemType Directory -Path $tmpDir -Force | Out-Null

    # Try GitHub release via gh CLI
    $ghCmd = Get-Command "gh" -ErrorAction SilentlyContinue
    if ($ghCmd) {
        Write-Info "Downloading latest release via gh CLI..."
        try {
            & gh release download --repo $Repo --pattern "*.vsix" --dir $tmpDir 2>$null
            $vsix = Get-ChildItem "$tmpDir\*.vsix" -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($vsix) { return $vsix.FullName }
        } catch {}
    }

    # Fallback: build from source
    Write-Info "No release found. Building from source..."
    $cloneDir = Join-Path $tmpDir "pmcode-src"

    $gitCmd = Get-Command "git" -ErrorAction SilentlyContinue
    if (-not $gitCmd) {
        Write-Err "git is required. Install it from: https://git-scm.com/download/win"
        exit 1
    }

    & git clone --depth 1 "https://github.com/$Repo.git" $cloneDir 2>$null

    $nodeCmd = Get-Command "node" -ErrorAction SilentlyContinue
    if (-not $nodeCmd) {
        Write-Warn "Node.js not found. Cannot build from source."
        Write-Warn "Install Node.js from: https://nodejs.org"
        return "__MANUAL__:$cloneDir"
    }

    Push-Location $cloneDir
    try {
        & npm install --ignore-scripts 2>$null
        & npm run compile 2>$null

        $vsixPath = Join-Path $tmpDir "pmcode.vsix"
        $npxCmd = Get-Command "npx" -ErrorAction SilentlyContinue
        if ($npxCmd) {
            & npx @vscode/vsce package --no-dependencies -o $vsixPath 2>$null
        }

        if (Test-Path $vsixPath) {
            return $vsixPath
        }
    } finally {
        Pop-Location
    }

    return "__MANUAL__:$cloneDir"
}

# ── Install extension ──────────────────────────────────────────────────────

function Install-Extension($vsixPath, $editors) {
    foreach ($editor in $editors) {
        $editorName = Split-Path $editor -Leaf
        Write-Info "Installing PM Code into $editorName..."

        if ($vsixPath.StartsWith("__MANUAL__:")) {
            $srcDir = $vsixPath.Substring(11)
            $extBaseName = switch -Wildcard ($editorName) {
                "code-insiders*" { ".vscode-insiders" }
                "cursor*"        { ".cursor" }
                "windsurf*"      { ".windsurf" }
                default          { ".vscode" }
            }
            $extDir = Join-Path $env:USERPROFILE "$extBaseName\extensions\pmcode.pmcode-0.1.0"
            New-Item -ItemType Directory -Path $extDir -Force | Out-Null

            $toCopy = @("dist", "package.json", "media", "webview-ui", "skills")
            foreach ($item in $toCopy) {
                $src = Join-Path $srcDir $item
                $dst = Join-Path $extDir $item
                if (Test-Path $src) {
                    if ((Get-Item $src).PSIsContainer) {
                        Copy-Item $src $dst -Recurse -Force
                    } else {
                        Copy-Item $src $dst -Force
                    }
                }
            }
            Write-Info "Installed to $extDir"
        } else {
            try {
                & $editor --install-extension $vsixPath --force 2>$null
                Write-Info "Installed into $editorName"
            } catch {
                Write-Warn "Failed to install into $editorName"
            }
        }
    }
}

# ── Create config directory ────────────────────────────────────────────────

function Setup-Config {
    Write-Info "Setting up ~/.pmcode/ config directory..."

    $dirs = @(
        $PmCodeDir,
        (Join-Path $PmCodeDir "skills"),
        (Join-Path $PmCodeDir "connectors"),
        (Join-Path $PmCodeDir "guides"),
        (Join-Path $PmCodeDir "memory"),
        (Join-Path $PmCodeDir "history")
    )

    foreach ($dir in $dirs) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }

    # Create default config.json
    $configPath = Join-Path $PmCodeDir "config.json"
    if (-not (Test-Path $configPath)) {
        $config = @{
            ftue = @{ completed = $false; completedSteps = @(); phase = "companion" }
            ui = @{ sidebarCollapsed = $false; lastOpenedPanel = $null; searchHistory = @() }
            preferences = @{ provider = "roo-code"; autoOpenCompanion = $true; telemetryEnabled = $false }
            connectors = @{ configured = @(); disabled = @() }
            skills = @{ used = @() }
            guides = @{ completed = @(); inProgress = @{} }
        }
        $config | ConvertTo-Json -Depth 5 | Set-Content $configPath -Encoding UTF8
        Write-Info "Created default config.json"
    }

    # Create .env template
    $envPath = Join-Path $PmCodeDir ".env"
    if (-not (Test-Path $envPath)) {
        @"
# PM Code API tokens and keys
# Add your tokens here or configure them via the PM Code UI.
#
# JIRA_URL=https://yourteam.atlassian.net
# JIRA_API_TOKEN=your-token-here
# MONDAY_API_TOKEN=your-token-here
# AHA_API_TOKEN=your-token-here
# TAVILY_API_KEY=your-key-here
"@ | Set-Content $envPath -Encoding UTF8
        Write-Info "Created .env template"
    }
}

# ── Verify ─────────────────────────────────────────────────────────────────

function Verify-Install($editors) {
    foreach ($editor in $editors) {
        try {
            $extensions = & $editor --list-extensions 2>$null
            if ($extensions -match "pmcode") {
                Write-Host ""
                Write-Info "PM Code installed successfully!"
                Write-Host ""
                Write-Host "  Next steps:" -ForegroundColor White
                Write-Host "  1. Open VS Code (or your editor)"
                Write-Host "  2. Look for the PM icon in the Activity Bar (left sidebar)"
                Write-Host "  3. Follow the Getting Started walkthrough"
                Write-Host ""
                return
            }
        } catch {}
    }
    Write-Warn "Installation completed but could not verify. Try restarting your editor."
}

# ── Main ────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "PM Code Installer" -ForegroundColor White
Write-Host ""

Write-Info "Detected OS: Windows"

$editors = Find-Editors
Write-Info "Found editor(s): $($editors -join ', ')"

# Check prerequisites
$gitCmd = Get-Command "git" -ErrorAction SilentlyContinue
if (-not $gitCmd) {
    Write-Err "git is required. Install from: https://git-scm.com/download/win"
    exit 1
}

$nodeCmd = Get-Command "node" -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    Write-Warn "Node.js not found. It will be needed for MCP connectors."
    Write-Warn "Install from: https://nodejs.org"
}

# Download or build
$vsixPath = Get-Vsix
Write-Info "Package ready: $vsixPath"

# Install
Install-Extension $vsixPath $editors

# Setup config
Setup-Config

# Verify
Verify-Install $editors

# Cleanup
if (-not $vsixPath.StartsWith("__MANUAL__:")) {
    $tmpDir = Split-Path $vsixPath
    Remove-Item $tmpDir -Recurse -Force -ErrorAction SilentlyContinue
}
