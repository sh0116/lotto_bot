import os
import sys
import traceback
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Callable


class LottoBotError(RuntimeError):
    pass


@dataclass(frozen=True)
class Credentials:
    user_id: str
    user_pw: str


def get_credentials() -> Credentials:
    user_id = os.environ.get("LOTTO_ID")
    user_pw = os.environ.get("LOTTO_PW")
    if not user_id or not user_pw:
        raise LottoBotError("환경변수 LOTTO_ID, LOTTO_PW가 설정되지 않았습니다.")
    return Credentials(user_id=user_id, user_pw=user_pw)


def env_bool(name: str, default: bool = False) -> bool:
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "y", "on"}


def env_int(name: str, default: int, minimum: int | None = None) -> int:
    raw_value = os.environ.get(name)
    if raw_value is None or raw_value.strip() == "":
        return default
    try:
        value = int(raw_value)
    except ValueError as exc:
        raise LottoBotError(f"{name}는 정수여야 합니다: {raw_value}") from exc
    if minimum is not None and value < minimum:
        raise LottoBotError(f"{name}는 {minimum} 이상이어야 합니다: {value}")
    return value


def env_int_list(name: str, default: list[int] | None = None) -> list[int]:
    raw_value = os.environ.get(name)
    if raw_value is None or raw_value.strip() == "":
        return list(default or [])
    values: list[int] = []
    for token in raw_value.replace(" ", "").split(","):
        if not token:
            continue
        try:
            values.append(int(token))
        except ValueError as exc:
            raise LottoBotError(f"{name}에는 쉼표로 구분한 숫자만 넣을 수 있습니다: {raw_value}") from exc
    return values


def parse_money(value: str) -> int:
    digits = "".join(ch for ch in value if ch.isdigit())
    return int(digits or "0")


def notify_telegram(message: str) -> None:
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    chat_id = os.environ.get("TELEGRAM_CHAT_ID")
    if not token or not chat_id:
        print("텔레그램 알림 건너뜀: TELEGRAM_BOT_TOKEN 또는 TELEGRAM_CHAT_ID 미설정")
        return

    data = urllib.parse.urlencode({"chat_id": chat_id, "text": message}).encode()
    request = urllib.request.Request(
        f"https://api.telegram.org/bot{token}/sendMessage",
        data=data,
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=15) as response:
        if response.status >= 400:
            raise LottoBotError(f"텔레그램 알림 실패: HTTP {response.status}")


def save_failure_screenshot(page, prefix: str) -> Path | None:
    artifact_dir = Path("artifacts")
    artifact_dir.mkdir(exist_ok=True)
    path = artifact_dir / f"{prefix}-failure.png"
    try:
        page.screenshot(path=str(path), full_page=True)
        return path
    except Exception:
        return None


def run_notified(task_name: str, action: Callable[[], str]) -> None:
    try:
        result = action()
    except Exception as exc:
        detail = "".join(traceback.format_exception_only(type(exc), exc)).strip()
        message = f"[LottoBot] {task_name} 실패\n{detail}"
        print(message, file=sys.stderr)
        try:
            notify_telegram(message)
        finally:
            raise SystemExit(1) from exc

    message = f"[LottoBot] {task_name} 성공\n{result}"
    print(message)
    notify_telegram(message)
