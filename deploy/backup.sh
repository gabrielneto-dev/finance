#!/usr/bin/env bash
# Backup do banco da produção (SPEC-0005, Marco 0). Rode na raiz do projeto, à mão ou pelo cron.
#   deploy/backup.sh
# FINANCE_BACKUP_DIR escolhe a pasta de destino (padrão: ./backups, fora do Git). Aponte-a para um
# disco externo ou outro aparelho: backup no mesmo disco não protege contra a perda desse disco.
# FINANCE_BACKUP_DAYS define quantos dias guardar (padrão: 14).
set -euo pipefail
cd "$(dirname "$0")/.."
export FINANCE_ENV_FILE="${FINANCE_ENV_FILE:-.env.production}"
dest="${FINANCE_BACKUP_DIR:-$PWD/backups}"
keep="${FINANCE_BACKUP_DAYS:-14}"
case "$keep" in ''|*[!0-9]*) echo "FINANCE_BACKUP_DAYS precisa ser um número." >&2; exit 2 ;; esac

umask 077
mkdir -p "$dest"
name="finance-$(date +%Y%m%d-%H%M%S).sqlite"
# VACUUM INTO gera uma cópia consistente com o web e o worker no ar.
docker compose exec -T web node -e "new (require('node:sqlite').DatabaseSync)('/data/finance.sqlite').exec(\"VACUUM INTO '/data/$name'\")"
docker compose cp "web:/data/$name" "$dest/$name"
docker compose exec -T web rm -f "/data/$name"
chmod 600 "$dest/$name"
find "$dest" -maxdepth 1 -name 'finance-*.sqlite' -mtime +"$keep" -delete
echo "Backup salvo em $dest/$name"
