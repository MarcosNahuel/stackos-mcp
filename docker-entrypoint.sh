#!/bin/sh
set -e

CN_REPO="https://github.com/MarcosNahuel/CONOCIMIENTO-NAHUEL.git"
DATA_DIR="${STACKOS_ROOT:-/data}"

if [ -d "$DATA_DIR/.git" ]; then
  echo "[entrypoint] CN repo found — pulling latest..."
  git -C "$DATA_DIR" pull --rebase --autostash || echo "[entrypoint] pull failed, continuing with existing state"
else
  echo "[entrypoint] Cloning CN repo into $DATA_DIR..."
  git clone --depth=1 "$CN_REPO" "$DATA_DIR"
fi

exec node dist/index.js
