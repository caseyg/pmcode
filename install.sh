#!/usr/bin/env bash
#
# PM Code — cross-platform installer (macOS, Linux, Windows)
# Usage: curl -fsSL https://raw.githubusercontent.com/caseyg/pmcode/main/install.sh | bash
#
# On Windows (Git Bash, MSYS2, or WSL), this script detects the platform and
# either handles installation natively or bootstraps PowerShell automatically.
#
set -euo pipefail

REPO="caseyg/pmcode"
BOLD="\033[1m"
GREEN="\033[32m"
YELLOW="\033[33m"
RED="\033[31m"
RESET="\033[0m"

info()  { printf "${BOLD}${GREEN}[pmcode]${RESET} %s\n" "$1"; }
warn()  { printf "${BOLD}${YELLOW}[pmcode]${RESET} %s\n" "$1"; }
error() { printf "${BOLD}${RED}[pmcode]${RESET} %s\n" "$1" >&2; }

# ── Detect OS ───────────────────────────────────────────────────────────────

OS=""
WINDOWS=false

detect_os() {
  case "$(uname -s)" in
    Darwin)           OS="macos" ;;
    Linux)
      # Check if running under WSL
      if grep -qiE '(microsoft|wsl)' /proc/version 2>/dev/null; then
        OS="windows"
        WINDOWS=true
      else
        OS="linux"
      fi
      ;;
    MINGW*|MSYS*|CYGWIN*)
      OS="windows"
      WINDOWS=true
      ;;
    *)
      error "Unsupported operating system: $(uname -s)"
      exit 1
      ;;
  esac
}

# ── Windows: resolve native paths ──────────────────────────────────────────

# Convert a Unix-style path to a Windows-native path (for MSYS/Git Bash)
win_path() {
  if command -v cygpath &>/dev/null; then
    cygpath -w "$1"
  else
    echo "$1" | sed 's|^/c/|C:/|;s|^/d/|D:/|;s|^/\([a-zA-Z]\)/|\1:/|;s|/|\\|g'
  fi
}

# Get the Windows home directory
win_home() {
  if [[ -n "${USERPROFILE:-}" ]]; then
    echo "$USERPROFILE"
  elif [[ -n "${HOME:-}" ]]; then
    win_path "$HOME"
  else
    echo "C:\\Users\\$USER"
  fi
}

# ── Windows: try PowerShell bootstrap ──────────────────────────────────────

try_powershell() {
  local ps_cmd=""
  if command -v pwsh &>/dev/null; then
    ps_cmd="pwsh"
  elif command -v powershell.exe &>/dev/null; then
    ps_cmd="powershell.exe"
  elif command -v powershell &>/dev/null; then
    ps_cmd="powershell"
  fi

  if [[ -n "$ps_cmd" ]]; then
    info "Windows detected — launching PowerShell installer..."
    local script_url="https://raw.githubusercontent.com/$REPO/main/install.ps1"
    "$ps_cmd" -NoProfile -ExecutionPolicy Bypass -Command \
      "Invoke-WebRequest -UseBasicParsing '$script_url' | Invoke-Expression"
    return 0
  fi
  return 1
}

# ── Detect config directory ────────────────────────────────────────────────

get_pmcode_dir() {
  if $WINDOWS; then
    local wh
    wh=$(win_home)
    echo "${wh}\\.pmcode"
  else
    echo "$HOME/.pmcode"
  fi
}

PMCODE_DIR=""  # set in main after OS detection

# ── Detect VS Code variants ────────────────────────────────────────────────

detect_editors() {
  local found=()

  # CLI commands to check
  local cmds=("code" "code-insiders" "cursor" "windsurf")

  # On Windows, also check .cmd variants
  if $WINDOWS; then
    cmds+=("code.cmd" "code-insiders.cmd" "cursor.cmd" "windsurf.cmd")
  fi

  for cmd in "${cmds[@]}"; do
    if command -v "$cmd" &>/dev/null; then
      # Deduplicate (e.g. code and code.cmd might resolve to the same thing)
      local base="${cmd%.cmd}"
      local already=false
      for f in "${found[@]+"${found[@]}"}"; do
        if [[ "$(basename "${f%.cmd}")" == "$base" ]]; then
          already=true
          break
        fi
      done
      if ! $already; then
        found+=("$cmd")
      fi
    fi
  done

  # macOS: check common app locations if nothing found in PATH
  if [[ "${#found[@]}" -eq 0 && "$OS" == "macos" ]]; then
    local apps=(
      "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code"
      "/Applications/Visual Studio Code - Insiders.app/Contents/Resources/app/bin/code-insiders"
      "/Applications/Cursor.app/Contents/Resources/app/bin/cursor"
      "/Applications/Windsurf.app/Contents/Resources/app/bin/windsurf"
    )
    for app in "${apps[@]}"; do
      if [[ -f "$app" ]]; then
        found+=("$app")
      fi
    done
  fi

  # Windows: check common install locations
  if [[ "${#found[@]}" -eq 0 ]] && $WINDOWS; then
    local localappdata="${LOCALAPPDATA:-${USERPROFILE:-$HOME}/AppData/Local}"
    local win_apps=(
      "$localappdata/Programs/Microsoft VS Code/bin/code.cmd"
      "$localappdata/Programs/Microsoft VS Code Insiders/bin/code-insiders.cmd"
      "$localappdata/Programs/cursor/resources/app/bin/cursor.cmd"
      "$localappdata/Programs/Windsurf/bin/windsurf.cmd"
    )
    for app in "${win_apps[@]}"; do
      if [[ -f "$app" ]]; then
        found+=("$app")
      fi
    done
  fi

  if [[ "${#found[@]}" -eq 0 ]]; then
    error "No VS Code variant found. Please install one of:"
    error "  - VS Code:    https://code.visualstudio.com"
    error "  - Cursor:     https://cursor.com"
    error "  - Windsurf:   https://windsurf.ai"
    exit 1
  fi

  printf '%s\n' "${found[@]}"
}

# ── Download latest .vsix ──────────────────────────────────────────────────

download_vsix() {
  local tmp_dir
  tmp_dir=$(mktemp -d)
  local vsix_path="$tmp_dir/pmcode.vsix"

  # Try GitHub release first
  if command -v gh &>/dev/null; then
    info "Downloading latest release via gh CLI..."
    if gh release download --repo "$REPO" --pattern "*.vsix" --dir "$tmp_dir" 2>/dev/null; then
      local downloaded
      downloaded=$(ls "$tmp_dir"/*.vsix 2>/dev/null | head -1)
      if [[ -n "$downloaded" ]]; then
        echo "$downloaded"
        return
      fi
    fi
  fi

  # Fallback: build from source
  info "No release found. Building from source..."
  local clone_dir="$tmp_dir/pmcode-src"
  git clone --depth 1 "https://github.com/$REPO.git" "$clone_dir" 2>/dev/null

  (
    cd "$clone_dir"
    npm install --ignore-scripts 2>/dev/null
    npm run compile 2>/dev/null

    # Package as vsix
    if command -v npx &>/dev/null; then
      npx @vscode/vsce package --no-dependencies -o "$vsix_path" 2>/dev/null
    else
      echo "__MANUAL__:$clone_dir"
      return
    fi
  )

  if [[ -f "$vsix_path" ]]; then
    echo "$vsix_path"
  else
    echo "__MANUAL__:$clone_dir"
  fi
}

# ── Install extension ──────────────────────────────────────────────────────

install_extension() {
  local vsix_path="$1"
  shift
  local editors=("$@")

  for editor in "${editors[@]}"; do
    local editor_name
    editor_name=$(basename "${editor%.cmd}")
    info "Installing PM Code into $editor_name..."

    if [[ "$vsix_path" == __MANUAL__:* ]]; then
      local src_dir="${vsix_path#__MANUAL__:}"
      local ext_base="$HOME/.vscode"

      case "$editor_name" in
        code-insiders) ext_base="$HOME/.vscode-insiders" ;;
        cursor)        ext_base="$HOME/.cursor" ;;
        windsurf)      ext_base="$HOME/.windsurf" ;;
      esac

      # On Windows via MSYS/Git Bash, use USERPROFILE
      if $WINDOWS && [[ -n "${USERPROFILE:-}" ]]; then
        local win_base
        case "$editor_name" in
          code-insiders) win_base="$USERPROFILE/.vscode-insiders" ;;
          cursor)        win_base="$USERPROFILE/.cursor" ;;
          windsurf)      win_base="$USERPROFILE/.windsurf" ;;
          *)             win_base="$USERPROFILE/.vscode" ;;
        esac
        ext_base="$win_base"
      fi

      local ext_dir="$ext_base/extensions/pmcode.pmcode-0.1.0"
      mkdir -p "$ext_dir"
      cp -r "$src_dir"/dist "$src_dir"/package.json "$src_dir"/media "$src_dir"/webview-ui "$src_dir"/skills "$ext_dir/" 2>/dev/null || true
      info "Installed to $ext_dir"
    else
      "$editor" --install-extension "$vsix_path" --force 2>/dev/null && \
        info "Installed into $editor_name" || \
        warn "Failed to install into $editor_name"
    fi
  done
}

# ── Create config directory ────────────────────────────────────────────────

setup_config() {
  info "Setting up config directory: $PMCODE_DIR"

  # Use $HOME-based path for mkdir (works in both MSYS and native)
  local dir="$HOME/.pmcode"

  local subdirs=("skills" "connectors" "guides" "memory" "history")
  mkdir -p "$dir"
  for sub in "${subdirs[@]}"; do
    mkdir -p "$dir/$sub"
  done

  if [[ ! -f "$dir/config.json" ]]; then
    cat > "$dir/config.json" << 'CONF'
{
  "ftue": { "completed": false, "completedSteps": [], "phase": "companion" },
  "ui": { "sidebarCollapsed": false, "lastOpenedPanel": null, "searchHistory": [] },
  "preferences": { "provider": "roo-code", "autoOpenCompanion": true, "telemetryEnabled": false },
  "connectors": { "configured": [], "disabled": [] },
  "skills": { "used": [] },
  "guides": { "completed": [], "inProgress": {} }
}
CONF
    info "Created default config.json"
  fi

  if [[ ! -f "$dir/.env" ]]; then
    cat > "$dir/.env" << 'ENV'
# PM Code API tokens and keys
# Add your tokens here or configure them via the PM Code UI.
#
# JIRA_URL=https://yourteam.atlassian.net
# JIRA_API_TOKEN=your-token-here
# MONDAY_API_TOKEN=your-token-here
# AHA_API_TOKEN=your-token-here
# TAVILY_API_KEY=your-key-here
ENV
    info "Created .env template"
  fi
}

# ── Verify ─────────────────────────────────────────────────────────────────

verify() {
  local editors=("$@")
  local success=false

  for editor in "${editors[@]}"; do
    if "$editor" --list-extensions 2>/dev/null | grep -qi "pmcode"; then
      success=true
      break
    fi
  done

  if $success; then
    echo ""
    info "PM Code installed successfully!"
    echo ""
    printf "  ${BOLD}Next steps:${RESET}\n"
    printf "  1. Open VS Code (or your editor)\n"
    printf "  2. Look for the ${BOLD}PM${RESET} icon in the Activity Bar (left sidebar)\n"
    printf "  3. Follow the Getting Started walkthrough\n"
    echo ""
  else
    warn "Installation completed but could not verify. Try restarting your editor."
  fi
}

# ── Main ────────────────────────────────────────────────────────────────────

main() {
  echo ""
  printf "${BOLD}PM Code Installer${RESET}\n"
  echo ""

  detect_os
  info "Detected OS: $OS"
  PMCODE_DIR=$(get_pmcode_dir)

  # On Windows, try to hand off to PowerShell for best compatibility
  if $WINDOWS; then
    if try_powershell; then
      exit 0
    fi
    info "PowerShell not available — continuing with bash installer"
  fi

  # Detect editors
  local editors
  mapfile -t editors < <(detect_editors)
  info "Found editor(s): ${editors[*]}"

  # Check prerequisites
  if ! command -v git &>/dev/null; then
    error "git is required. Install it first:"
    case "$OS" in
      macos)   error "  xcode-select --install" ;;
      linux)   error "  sudo apt install git  (or yum, pacman, etc.)" ;;
      windows) error "  https://git-scm.com/download/win" ;;
    esac
    exit 1
  fi

  if ! command -v node &>/dev/null; then
    warn "Node.js not found. It will be needed for MCP connectors."
    case "$OS" in
      windows) warn "Install from: https://nodejs.org" ;;
      *)       warn "Install: https://nodejs.org or via nvm" ;;
    esac
  fi

  # Download or build
  local vsix_path
  vsix_path=$(download_vsix)
  info "Package ready: $vsix_path"

  # Install
  install_extension "$vsix_path" "${editors[@]}"

  # Config
  setup_config

  # Verify
  verify "${editors[@]}"

  # Cleanup
  if [[ "$vsix_path" != __MANUAL__:* ]]; then
    rm -rf "$(dirname "$vsix_path")" 2>/dev/null || true
  fi
}

main "$@"
