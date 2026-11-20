#!/usr/bin/env bash
set -euo pipefail

# 1. Configure shell PATH for Encore (works across uVMs regardless of username)
sed -i '/case \$- in/,/esac/d' "$HOME/.bashrc" 2>/dev/null || true
grep -qxF 'export ENCORE_INSTALL="$HOME/.encore"' "$HOME/.bashrc" 2>/dev/null || \
  echo 'export ENCORE_INSTALL="$HOME/.encore"' >> "$HOME/.bashrc"
grep -qxF 'export PATH="$ENCORE_INSTALL/bin:$PATH"' "$HOME/.bashrc" 2>/dev/null || \
  echo 'export PATH="$ENCORE_INSTALL/bin:$PATH"' >> "$HOME/.bashrc"

export ENCORE_INSTALL="$HOME/.encore"
export PATH="$ENCORE_INSTALL/bin:$PATH"

# 2. Install Encore CLI if not already present
if ! command -v encore >/dev/null 2>&1 && [ ! -x "$ENCORE_INSTALL/bin/encore" ]; then
  if [ -f "./install_encore.sh" ]; then
    sh ./install_encore.sh
  else
    curl -fsSL https://encore.dev/install.sh | bash
  fi
fi

# 3. Install & configure Docker with VFS storage driver when privileged access is available
SUDO=""
if [ "$(id -u)" -eq 0 ]; then
  SUDO=""
elif command -v sudo >/dev/null 2>&1 && sudo -n true 2>/dev/null; then
  SUDO="sudo"
else
  SUDO="UNAVAILABLE"
fi

if [ "$SUDO" != "UNAVAILABLE" ]; then
  if command -v apt-get >/dev/null 2>&1; then
    $SUDO apt-get update -qq
    $SUDO apt-get install -y -qq socat jq curl
  fi

  if ! command -v docker >/dev/null 2>&1; then
    curl -fsSL https://get.docker.com | $SUDO sh
  fi

  if command -v docker >/dev/null 2>&1; then
    $SUDO mkdir -p /etc/docker
    if [ -f /etc/docker/daemon.json ] && jq empty /etc/docker/daemon.json 2>/dev/null; then
      jq '. + {"storage-driver": "vfs"}' /etc/docker/daemon.json | $SUDO tee /etc/docker/daemon.json.tmp >/dev/null
      $SUDO mv /etc/docker/daemon.json.tmp /etc/docker/daemon.json
    else
      printf '{\n  "storage-driver": "vfs"\n}\n' | $SUDO tee /etc/docker/daemon.json >/dev/null
    fi

    if [ "$(id -u)" -ne 0 ] && getent group docker >/dev/null 2>&1; then
      $SUDO usermod -aG docker "$(whoami)" 2>/dev/null || true
    fi

    $SUDO systemctl restart docker 2>/dev/null || $SUDO service docker restart 2>/dev/null || true
  fi
else
  echo "[setup] Skipping Docker install/config: no root or passwordless sudo available in this uVM."
fi

# 4. Install Go and Frontend dependencies
go mod download
pnpm --dir frontend install --frozen-lockfile
