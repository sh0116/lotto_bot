#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

pre_lotto_dry_run_set=${LOTTO_DRY_RUN+x}
pre_lotto_dry_run=${LOTTO_DRY_RUN-}
pre_lotto_check_results_set=${LOTTO_645_CHECK_RESULTS+x}
pre_lotto_check_results=${LOTTO_645_CHECK_RESULTS-}

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

if [ "$pre_lotto_dry_run_set" = x ]; then
  export LOTTO_DRY_RUN="$pre_lotto_dry_run"
fi

if [ "$pre_lotto_check_results_set" = x ]; then
  export LOTTO_645_CHECK_RESULTS="$pre_lotto_check_results"
fi

if [ -d .venv ]; then
  # shellcheck disable=SC1091
  . .venv/bin/activate
fi

status=0

if [ "${LOTTO_645_CHECK_RESULTS:-true}" != "false" ]; then
  echo "[LottoBot] 이전 구매 당첨 결과 조회 시작"
  if ! python check_lotto_results.py; then
    echo "[LottoBot] 이전 구매 당첨 결과 조회 실패" >&2
    status=1
  fi
fi

echo "[LottoBot] 645 주간 구매 시작"
if ! python buy_645_lotto.py; then
  echo "[LottoBot] 645 주간 구매 실패" >&2
  status=1
fi

exit "$status"
