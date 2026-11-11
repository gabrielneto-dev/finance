#!/usr/bin/env bash
# Publica ou atualiza o Finance no servidor de casa (SPEC-0005, Marco 0).
# Uso, na raiz do projeto:
#   deploy/deploy.sh               baixa o código, confere o .env.production, gera a imagem e sobe web e worker
#   deploy/deploy.sh --no-pull     o mesmo, sem git pull
#   deploy/deploy.sh --webhooks    depois de subir, confere o domínio público e cadastra os webhooks da Pluggy
# Pode ser repetido: cada execução só atualiza o que mudou e preserva o volume com o banco.
set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE="${FINANCE_ENV_FILE:-.env.production}"
export FINANCE_ENV_FILE="$ENV_FILE"
PORT=3000  # porta publicada pelo compose.yaml, só em 127.0.0.1
pull=1
webhooks=0
for arg in "$@"; do
  case "$arg" in
    --no-pull) pull=0 ;;
    --webhooks) webhooks=1 ;;
    *) echo "Opção desconhecida: $arg" >&2; exit 2 ;;
  esac
done

fail() { echo "ERRO: $*" >&2; exit 1; }
step() { echo "==> $*"; }
# Lê uma variável do arquivo sem executá-lo nem mostrar o valor.
get() { grep -E "^$1=" "$ENV_FILE" | tail -n 1 | cut -d= -f2- | tr -d '\r' || true; }

step "Conferindo pré-requisitos"
command -v docker >/dev/null || fail "Docker não encontrado."
docker compose version >/dev/null 2>&1 || fail "Plugin 'docker compose' não encontrado."
docker info >/dev/null 2>&1 || fail "O Docker não responde. Rode: sudo systemctl enable --now docker (e confira se seu usuário está no grupo docker)."
command -v curl >/dev/null || fail "curl não encontrado."

step "Conferindo $ENV_FILE (os valores não são exibidos)"
[ -f "$ENV_FILE" ] || fail "$ENV_FILE não existe. Copie de .env.production.example, preencha e rode chmod 600 $ENV_FILE."
perm="$(stat -c %a "$ENV_FILE" 2>/dev/null || true)"
case "$perm" in 600|400|"") ;; *) echo "AVISO: $ENV_FILE tem permissão $perm. Use chmod 600 $ENV_FILE." ;; esac
for name in APP_ORIGIN FINANCE_OWNER_EMAIL SUPABASE_URL SUPABASE_PUBLISHABLE_KEY PLUGGY_CLIENT_ID PLUGGY_CLIENT_SECRET PLUGGY_WEBHOOK_SECRET; do
  [ -n "$(get "$name")" ] || fail "$name está vazio em $ENV_FILE."
done
[ -z "$(get FINANCE_LOCAL_KEY_HASH)" ] || fail "FINANCE_LOCAL_KEY_HASH precisa ficar vazio na produção."
[ -z "$(get FINANCE_DEV_ORIGINS)" ] || fail "FINANCE_DEV_ORIGINS precisa ficar vazio na produção (CORS só de desenvolvimento)."
origin="$(get APP_ORIGIN)"
case "$origin" in https://*) ;; *) fail "APP_ORIGIN precisa começar com https://." ;; esac
case "$origin" in */) fail "APP_ORIGIN não pode terminar com barra." ;; esac
case "$(get SUPABASE_PUBLISHABLE_KEY)" in sb_secret_*|*service_role*) fail "Use a chave publicável do Supabase, não a secreta." ;; esac
[ "$(get PLUGGY_WEBHOOK_SECRET | wc -c)" -ge 33 ] || fail "PLUGGY_WEBHOOK_SECRET curto demais. Gere com: openssl rand -hex 32"
[ -n "$(get FIREBASE_SERVICE_ACCOUNT)" ] || echo "AVISO: FIREBASE_SERVICE_ACCOUNT vazio. O app não vai receber avisos de transferência."

if [ "$pull" = 1 ]; then
  step "Baixando o código"
  git pull --ff-only
fi
echo "Versão: $(git log -1 --format='%h %s')"

step "Gerando a imagem"
docker compose build

step "Subindo web e worker"
docker compose up -d

step "Esperando o web ficar saudável"
status="starting"
for _ in $(seq 1 45); do
  id="$(docker compose ps -q web)"
  status="$(docker inspect -f '{{.State.Health.Status}}' "$id" 2>/dev/null || echo starting)"
  [ "$status" = healthy ] && break
  sleep 4
done
if [ "$status" != healthy ]; then
  docker compose logs --tail=60 web
  fail "O web não ficou saudável (estado: $status)."
fi
curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null || fail "Sem resposta em http://127.0.0.1:$PORT/api/health."
worker="$(docker inspect -f '{{.State.Status}}' "$(docker compose ps -q worker)" 2>/dev/null || echo ausente)"
[ "$worker" = running ] || { docker compose logs --tail=60 worker; fail "O worker não está rodando (estado: $worker)."; }

if [ "$webhooks" = 1 ]; then
  step "Conferindo o domínio público"
  curl -fsS "$origin/api/health" >/dev/null || fail "$origin/api/health não respondeu. Confira o túnel da Cloudflare antes de cadastrar os webhooks."
  step "Cadastrando os webhooks da Pluggy"
  docker compose exec -T web node scripts/register-webhooks.mjs
fi

docker compose ps
echo "Pronto: web saudável em 127.0.0.1:$PORT e worker rodando."
