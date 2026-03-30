#!/usr/bin/env bash
#
# PM Code installer for macOS and Linux
# Usage: curl -fsSL https://raw.githubusercontent.com/caseyg/pmcode/main/install.sh | bash
#
set -euo pipefail

REPO="caseyg/pmcode"
PMCODE_DIR="$HOME/.pmcode"
BOLD="\033[1m"
GREEN="\033[32m"
YELLOW="\033[33m"
RED="\033[31m"
RESET="\033[0m"

info()  { printf "${BOLD}${GREEN}[pmcode]${RESET} %s\n" "$1"; }
warn()  { printf "${BOLD}${YELLOW}[pmcode]${RESET} %s\n" "$1"; }
error() { printf "${BOLD}${RED}[pmcode]${RESET} %s\n" "$1" >&2; }

# ── Detect OS ───────────────────────────────────────────────────────────────

detect_os() {
  case "$(uname -s)" in
    Darwin)  echo "macos" ;;
    Linux)   echo "linux" ;;
    MINGW*|MSYS*|CYGWIN*)
      error "Windows detected. Please use install.ps1 instead:"
      error "  iwr -useb https://raw.githubusercontent.com/$REPO/main/install.ps1 | iex"
      exit 1
      ;;
    *)
      error "Unsupported operating system: $(uname -s)"
      exit 1
      ;;
  esac
}

# ── Detect VS Code variants ────────────────────────────────────────────────

detect_editors() {
  local found=()

  # VS Code
  if command -v code &>/dev/null; then
    found+=("code")
  fi

  # VS Code Insiders
  if command -v code-insiders &>/dev/null; then
    found+=("code-insiders")
  fi

  # Cursor
  if command -v cursor &>/dev/null; then
    found+=("cursor")
  fi

  # Windsurf
  if command -v windsurf &>/dev/null; then
    found+=("windsurf")
  fi

  # Check common macOS app locations if CLI not in PATH
  if [[ "${#found[@]}" -eq 0 && "$(detect_os)" == "macos" ]]; then
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
      # Manual packaging fallback: just copy to extensions dir
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
    editor_name=$(basename "$editor")
    info "Installing PM Code into $editor_name..."

    if [[ "$vsix_path" == __MANUAL__:* ]]; then
      # Manual install: copy to extensions directory
      local src_dir="${vsix_path#__MANUAL__:}"
      local ext_dir="$HOME/.vscode/extensions/pmcode.pmcode-0.1.0"

      # Adjust for editor variant
      case "$editor_name" in
        code-insiders) ext_dir="$HOME/.vscode-insiders/extensions/pmcode.pmcode-0.1.0" ;;
        cursor)        ext_dir="$HOME/.cursor/extensions/pmcode.pmcode-0.1.0" ;;
        windsurf)      ext_dir="$HOME/.windsurf/extensions/pmcode.pmcode-0.1.0" ;;
      esac

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
  info "Setting up ~/.pmcode/ config directory..."

  local dirs=(
    "$PMCODE_DIR"
    "$PMCODE_DIR/skills"
    "$PMCODE_DIR/connectors"
    "$PMCODE_DIR/guides"
    "$PMCODE_DIR/memory"
    "$PMCODE_DIR/history"
  )

  for dir in "${dirs[@]}"; do
    mkdir -p "$dir"
  done

  # Create default config.json if it doesn't exist
  if [[ ! -f "$PMCODE_DIR/config.json" ]]; then
    cat > "$PMCODE_DIR/config.json" << 'CONF'
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

  # Create .env if it doesn't exist
  if [[ ! -f "$PMCODE_DIR/.env" ]]; then
    cat > "$PMCODE_DIR/.env" << 'ENV'
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

# ── Verify installation ───────────────────────────────────────────────────

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

  local os_name
  os_name=$(detect_os)
  info "Detected OS: $os_name"

  # Detect editors
  local editors
  mapfile -t editors < <(detect_editors)
  info "Found editor(s): ${editors[*]}"

  # Check prerequisites
  if ! command -v git &>/dev/null; then
    error "git is required. Install it first:"
    [[ "$os_name" == "macos" ]] && error "  xcode-select --install"
    [[ "$os_name" == "linux" ]] && error "  sudo apt install git  (or yum, pacman, etc.)"
    exit 1
  fi

  if ! command -v node &>/dev/null; then
    warn "Node.js not found. It will be needed for MCP connectors."
    warn "Install: https://nodejs.org or via nvm"
  fi

  # Download or build
  local vsix_path
  vsix_path=$(download_vsix)
  info "Package ready: $vsix_path"

  # Install into each editor
  install_extension "$vsix_path" "${editors[@]}"

  # Set up config
  setup_config

  # Verify
  verify "${editors[@]}"

  # Cleanup temp files
  if [[ "$vsix_path" != __MANUAL__:* ]]; then
    rm -rf "$(dirname "$vsix_path")" 2>/dev/null || true
  fi
}

main "$@"
