#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

if [ -d .venv ]; then
  # shellcheck disable=SC1091
  . .venv/bin/activate
fi

python buy_645_lotto.py
