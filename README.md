# LottoBot

동행복권 자동 구매와 결과 확인을 위한 Playwright 기반 자동화 프로젝트입니다.

현재 운영 방향은 단순합니다. GitHub Actions가 직접 정기 구매하지 않고,
OpenClaw Cron이 로컬의 안전한 `.env`를 읽어 실행한 뒤 Telegram으로 결과를 알려줍니다.

## What It Does

- 로또 6/45 자동 구매
- 연금복권 720+ 자동 구매
- 예치금, 구매 내역, 당첨 결과 조회
- 구매 성공/실패 Telegram 알림
- 구매 전 dry-run 검증
- OpenClaw Cron 기반 정기 실행
- GitHub Pages용 확률 분포 놀이터

## Project Layout

```text
.
├── buy_645_lotto.py          # 로또 6/45 구매
├── buy_720_lotto.py          # 연금복권 720+ 구매
├── check_lotto_results.py    # 예치금/구매내역/당첨 결과 조회
├── docs/                     # GitHub Pages 확률 분포 사이트
├── lotto_common.py           # 환경변수, 알림, 금액 파싱, 공통 예외
├── run_645_cron.sh           # OpenClaw Cron 진입점
├── tests/                    # 공통 유틸 단위 테스트
└── .github/workflows/        # 수동 실행용 GitHub Actions
```

## Probability Playground

`docs/`에는 로또 6/45 확률 분포를 가볍게 보는 정적 사이트가 들어 있습니다.

- 등수별 조합 확률
- 번호별 출현 분포 차트
- 빈도, 미출현 기간, 무작위 흔들림을 섞은 재미용 번호 신호
- 주당 구매량과 기간을 넣어 보는 누적 1등 확률

로컬 미리보기:

```bash
cd /home/pi/.openclaw/workspace/lotto_bot
python -m http.server 8123 --directory docs
```

GitHub Pages 공개:

1. PR을 `main`에 merge합니다.
2. GitHub repository Settings > Pages에서 Source를 GitHub Actions로 설정합니다.
3. `Deploy probability playground` workflow를 실행합니다.

공개 URL은 보통 아래 형식입니다.

```text
https://sh0116.github.io/lotto_bot/
```

## Setup

```bash
cd /home/pi/.openclaw/workspace/lotto_bot
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
playwright install --with-deps chromium
```

## Environment

로컬 운영에서는 `.env.example`을 참고해 `.env`를 만듭니다. `.env`는 Git에 올라가지 않습니다.

```bash
LOTTO_ID=your_dhlottery_id
LOTTO_PW=your_dhlottery_password

LOTTO_645_COUNT=5
LOTTO_645_FIXED_NUMBERS=16
LOTTO_HEADLESS=true
LOTTO_DRY_RUN=false

TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```

Telegram 알림은 두 겹으로 운용할 수 있습니다.

- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`: 스크립트가 직접 보내는 알림
- OpenClaw Cron delivery: Cron 실행 결과를 OpenClaw가 Telegram으로 보내는 알림

둘 다 켜면 알림이 중복될 수 있습니다. 운영에서는 Cron delivery만 써도 충분합니다.

## Run

구매 직전까지만 확인:

```bash
cd /home/pi/.openclaw/workspace/lotto_bot
set -a; . ./.env; set +a
LOTTO_DRY_RUN=true .venv/bin/python buy_645_lotto.py
```

실제 6/45 구매:

```bash
cd /home/pi/.openclaw/workspace/lotto_bot
./run_645_cron.sh
```

결과 조회:

```bash
cd /home/pi/.openclaw/workspace/lotto_bot
set -a; . ./.env; set +a
.venv/bin/python check_lotto_results.py
```

## OpenClaw Cron

GitHub Actions의 정기 스케줄은 중복 구매를 막기 위해 끄고, 수동 실행만 남깁니다.
정기 구매는 OpenClaw Cron에서 아래 명령을 실행합니다.

```text
Schedule: Asia/Seoul 매주 금요일 08:00
Command:  cd /home/pi/.openclaw/workspace/lotto_bot && ./run_645_cron.sh
Notify:   Telegram
```

## Safety Notes

- 자동 구매는 실제 예치금을 사용합니다.
- 새 계정값, 새 브라우저 환경, 사이트 UI 변경 후에는 반드시 `LOTTO_DRY_RUN=true`로 먼저 확인합니다.
- 로그인 실패가 5회 이상 반복되면 동행복권 계정 잠금이 걸릴 수 있습니다.
- 실패 시 `artifacts/buy-645-failure.png`에 마지막 화면이 저장됩니다.

## Lotto 6/45 Odds

복권 번호를 예측하는 것은 불가능에 가깝지만, 당첨 확률은 정확히 계산할 수 있습니다.
로또 6/45는 45개 숫자 중 6개를 고르는 조합이므로 전체 경우의 수는 다음과 같습니다.


현재 운영 방향은 단순합니다. GitHub Actions가 직접 정기 구매하지 않고,
OpenClaw Cron이 로컬의 안전한 `.env`를 읽어 실행한 뒤 Telegram으로 결과를 알려줍니다.

## What It Does

- 로또 6/45 자동 구매
- 연금복권 720+ 자동 구매
- 예치금, 구매 내역, 당첨 결과 조회
- 구매 성공/실패 Telegram 알림
- 구매 전 dry-run 검증
- OpenClaw Cron 기반 정기 실행

## Project Layout

```text
.
├── buy_645_lotto.py          # 로또 6/45 구매
├── buy_720_lotto.py          # 연금복권 720+ 구매
├── check_lotto_results.py    # 예치금/구매내역/당첨 결과 조회
├── lotto_common.py           # 환경변수, 알림, 금액 파싱, 공통 예외
├── run_645_cron.sh           # OpenClaw Cron 진입점
├── tests/                    # 공통 유틸 단위 테스트
└── .github/workflows/        # 수동 실행용 GitHub Actions
```

## Setup

```bash
cd /home/pi/.openclaw/workspace/lotto_bot
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
playwright install --with-deps chromium
```

## Environment

로컬 운영에서는 `.env.example`을 참고해 `.env`를 만듭니다. `.env`는 Git에 올라가지 않습니다.

```bash
LOTTO_ID=your_dhlottery_id
LOTTO_PW=your_dhlottery_password

LOTTO_645_COUNT=5
LOTTO_645_FIXED_NUMBERS=16
LOTTO_HEADLESS=true
LOTTO_DRY_RUN=false

TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```

Telegram 알림은 두 겹으로 운용할 수 있습니다.

- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`: 스크립트가 직접 보내는 알림
- OpenClaw Cron delivery: Cron 실행 결과를 OpenClaw가 Telegram으로 보내는 알림

둘 다 켜면 알림이 중복될 수 있습니다. 운영에서는 Cron delivery만 써도 충분합니다.

## Run

구매 직전까지만 확인:

```bash
cd /home/pi/.openclaw/workspace/lotto_bot
set -a; . ./.env; set +a
LOTTO_DRY_RUN=true .venv/bin/python buy_645_lotto.py
```

실제 6/45 구매:

```bash
cd /home/pi/.openclaw/workspace/lotto_bot
./run_645_cron.sh
```

결과 조회:

```bash
cd /home/pi/.openclaw/workspace/lotto_bot
set -a; . ./.env; set +a
.venv/bin/python check_lotto_results.py
```

## OpenClaw Cron

GitHub Actions의 정기 스케줄은 중복 구매를 막기 위해 끄고, 수동 실행만 남깁니다.
정기 구매는 OpenClaw Cron에서 아래 명령을 실행합니다.

```text
Schedule: Asia/Seoul 매주 금요일 08:00
Command:  cd /home/pi/.openclaw/workspace/lotto_bot && ./run_645_cron.sh
Notify:   Telegram
```

## Safety Notes

- 자동 구매는 실제 예치금을 사용합니다.
- 새 계정값, 새 브라우저 환경, 사이트 UI 변경 후에는 반드시 `LOTTO_DRY_RUN=true`로 먼저 확인합니다.
- 로그인 실패가 5회 이상 반복되면 동행복권 계정 잠금이 걸릴 수 있습니다.
- 실패 시 `artifacts/buy-645-failure.png`에 마지막 화면이 저장됩니다.

## Lotto 6/45 Odds

복권 번호를 예측하는 것은 불가능에 가깝지만, 당첨 확률은 정확히 계산할 수 있습니다.
로또 6/45는 45개 숫자 중 6개를 고르는 조합이므로 전체 경우의 수는 다음과 같습니다.

```text
C(45, 6) = 8,145,060
```

| 등수 | 조건 | 확률 |
| --- | --- | ---: |
| 1등 | 6개 번호 일치 | 1 / 8,145,060 |
| 2등 | 5개 번호 + 보너스 번호 일치 | 1 / 1,357,510 |
| 3등 | 5개 번호 일치 | 1 / 35,724 |
| 4등 | 4개 번호 일치 | 약 1 / 733 |
| 5등 | 3개 번호 일치 | 약 1 / 45 |

## Probability Playground Idea

재미용 사이트를 만들면 이런 식으로 갈 수 있습니다.

- 내가 산 번호들의 회차별 당첨 확률 표시
- 자동/고정번호/수동번호 조합별 확률 비교
- “이번 달 구매금액 vs 기대 당첨금” 시뮬레이션
- 누적 구매 횟수에 따른 1등 한 번 이상 당첨 확률
- 당첨 번호 빈도 시각화
- “확률은 그대로인데 기분만 좋아지는 번호 추천기”

중요한 점은 번호 추천이 실제 당첨 가능성을 높이지 않는다는 것입니다. 사이트의 재미는 예측이 아니라
확률, 비용, 기대값, 기록을 시각적으로 보여주는 쪽에 있습니다.
