import re
from datetime import date, timedelta

from playwright.sync_api import Playwright, sync_playwright

from buy_645_lotto import login, read_account_preflight
from lotto_common import (
    LottoBotError,
    env_bool,
    get_credentials,
    parse_money,
    run_notified,
    save_failure_screenshot,
)


def normalize_date(value: str) -> str:
    digits = "".join(ch for ch in value if ch.isdigit())
    if len(digits) != 8:
        raise LottoBotError(f"날짜는 YYYYMMDD 형식이어야 합니다: {value}")
    return digits


def default_start_date() -> str:
    today = date.today()
    return (today - timedelta(days=180)).strftime("%Y%m%d")


def ticket_key(row: dict[str, str]) -> tuple[str, str, str]:
    return (row.get("round", ""), row.get("ticket_number", ""), row.get("purchase_date", ""))


def read_body_text(page) -> str:
    return " ".join(page.locator("body").inner_text(timeout=5000).split())


def parse_ledger_cards_from_text(body_text: str) -> list[dict[str, str]]:
    pattern = re.compile(
        r"구입일자\s*(?P<purchase_date>\d{4}-\d{2}-\d{2})\s*"
        r"(?P<lotto_name>로또6/45)\s*"
        r"(?P<round>\d+)\s+"
        r"(?P<ticket_number>.*?)\s*"
        r"구입매수\s*(?P<quantity>\d+)\s*"
        r"(?P<result>당첨|낙첨|미추첨|미확인|추첨중)\s*"
        r"(?P<prize>[0-9,]+\s*원|-)?\s*"
        r"추첨일자\s*(?P<draw_date>\d{4}-\d{2}-\d{2})",
    )
    rows = []
    for match in pattern.finditer(body_text):
        ticket_number = " ".join(match.group("ticket_number").split())
        rows.append({
            "purchase_date": match.group("purchase_date"),
            "lotto_name": match.group("lotto_name"),
            "round": match.group("round"),
            "ticket_number": ticket_number,
            "quantity": match.group("quantity"),
            "result": match.group("result"),
            "prize": match.group("prize") or "0",
            "draw_date": match.group("draw_date"),
        })
    return rows


def parse_ledger_rows(page) -> list[dict[str, str]]:
    body_text = read_body_text(page)
    if "조회된 내역이 없습니다" in body_text:
        return []

    rows = parse_ledger_cards_from_text(body_text)
    if rows:
        return rows

    for row in page.locator("table tbody tr").all():
        try:
            cells = [" ".join(cell.inner_text(timeout=500).split()) for cell in row.locator("td").all()]
        except Exception:
            continue
        if len(cells) < 5:
            continue
        row_text = " ".join(cells)
        if not any(token in row_text for token in ["로또", "645", "당첨", "낙첨", "미추첨", "미확인", "추첨중"]):
            continue
        rows.append({
            "purchase_date": cells[0] if len(cells) > 0 else "",
            "lotto_name": cells[1] if len(cells) > 1 else "",
            "round": cells[2] if len(cells) > 2 else "",
            "ticket_number": cells[3] if len(cells) > 3 else "",
            "quantity": cells[4] if len(cells) > 4 else "",
            "result": cells[5] if len(cells) > 5 else "",
            "prize": cells[6] if len(cells) > 6 else "0",
            "draw_date": cells[7] if len(cells) > 7 else "",
        })
    return rows


def select_lotto_645_if_available(page) -> None:
    try:
        page.locator("#ltGdsSelect").select_option(label="로또6/45", timeout=3000)
    except Exception:
        pass


def click_search_if_available(page) -> None:
    for selector in ["button:has-text('검색')", "a:has-text('검색')", "input[value='검색']"]:
        try:
            page.locator(selector).first.click(timeout=3000)
            page.wait_for_timeout(1500)
            return
        except Exception:
            continue

def run(playwright: Playwright) -> str:
    credentials = get_credentials()
    headless = env_bool("LOTTO_HEADLESS", default=True)
    start_date = normalize_date(__import__("os").environ.get("LOTTO_CHECK_START_DATE", default_start_date()))

    browser = playwright.chromium.launch(headless=headless)
    context = browser.new_context(locale="ko-KR", timezone_id="Asia/Seoul")
    page = context.new_page()
    page.set_default_timeout(15000)

    try:
        login(page, credentials.user_id, credentials.user_pw)
        account_label, deposit_amount = read_account_preflight(page)

        page.goto("https://www.dhlottery.co.kr/mypage/mylotteryledger", wait_until="domcontentloaded")
        page.wait_for_timeout(1500)
        select_lotto_645_if_available(page)
        page.fill("#srchStrDt", start_date)
        page.fill("#srchEndDt", date.today().strftime("%Y%m%d"))
        click_search_if_available(page)

        results = parse_ledger_rows(page)

        total_prize = sum(parse_money(item["prize"]) for item in results if item.get("result") == "당첨")
        winning_count = sum(1 for item in results if item.get("result") == "당첨")
        recent = results[:3]
        recent_text = "; ".join(
            f"{item['round']}회 {item['result']} {item['prize']}" for item in recent
        ) or "최근 구매내역 없음"
        return (
            f"계정: {account_label} / 예치금: {deposit_amount}원 / 조회 시작일: {start_date} / "
            f"조회 건수: {len(results)} / 당첨 건수: {winning_count} / "
            f"총 당첨 금액: {total_prize}원 / 최근: {recent_text}"
        )
    except Exception:
        screenshot = save_failure_screenshot(page, "check-results")
        if screenshot:
            print(f"실패 스크린샷 저장: {screenshot}")
        raise
    finally:
        context.close()
        browser.close()


def main() -> str:
    get_credentials()
    with sync_playwright() as playwright:
        return run(playwright)


if __name__ == "__main__":
    run_notified("당첨 결과 조회", main)
