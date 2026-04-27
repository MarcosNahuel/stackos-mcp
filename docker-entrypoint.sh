#!/bin/sh
set -e

DATA_DIR="${STACKOS_ROOT:-/data}"
GH_USER="MarcosNahuel"
GH_REPO="CONOCIMIENTO-NAHUEL"

if [ -z "$GITHUB_TOKEN" ]; then
  echo "[entrypoint] ERROR: GITHUB_TOKEN no está seteado. Abortando." >&2
  exit 1
fi

CN_REPO="https://${GITHUB_TOKEN}@github.com/${GH_USER}/${GH_REPO}.git"

mkdir -p "$DATA_DIR"

if [ -d "$DATA_DIR/.git" ]; then
  echo "[entrypoint] CN repo encontrado — haciendo pull..."
  git -C "$DATA_DIR" pull --rebase --autostash || echo "[entrypoint] pull falló, continuando con estado existente"
else
  echo "[entrypoint] Clonando CN repo en directorio temporal..."
  TMP=$(mktemp -d)
  git clone --depth=1 "$CN_REPO" "$TMP"
  cp -a "$TMP/." "$DATA_DIR/"
  rm -rf "$TMP"
  echo "[entrypoint] Clone completado."
fi

exec node dist/index.js
