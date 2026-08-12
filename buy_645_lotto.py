from playwright.sync_api import Playwright, sync_playwright

from lotto_common import (
    env_bool,
    env_int,
    env_int_list,
    get_credentials,
    run_notified,
    save_failure_screenshot,
)


def click_first(page, selectors: list[str], timeout: int = 5000) -> str:
    last_error: Exception | None = None
    for selector in selectors:
        try:
            page.locator(selector).first.click(timeout=timeout)
            return selector
        except Exception as exc:
            last_error = exc
    raise RuntimeError(f"클릭할 수 있는 요소를 찾지 못했습니다: {selectors}") from last_error


def fill_first(page, selectors: list[str], value: str, timeout: int = 5000) -> str:
    last_error: Exception | None = None
    for selector in selectors:
        try:
            page.locator(selector).first.fill(value, timeout=timeout)
            return selector
        except Exception as exc:
            last_error = exc
    raise RuntimeError(f"입력 요소를 찾지 못했습니다: {selectors}") from last_error


def select_first(page, selectors: list[str], value: str, timeout: int = 5000) -> str:
    last_error: Exception | None = None
    for selector in selectors:
        try:
            page.locator(selector).first.select_option(value, timeout=timeout)
            return selector
        except Exception as exc:
            last_error = exc
    raise RuntimeError(f"선택 요소를 찾지 못했습니다: {selectors}") from last_error


def visible_text(page, selector: str, timeout: int = 5000) -> str:
    locator = page.locator(selector)
    locator.wait_for(state="visible", timeout=timeout)
    return " ".join(locator.inner_text(timeout=timeout).split())


def click_visible(page, selector: str, timeout: int = 5000) -> None:
    page.wait_for_function(
        """selector => Array.from(document.querySelectorAll(selector)).some(el => {
            const style = window.getComputedStyle(el);
            const box = el.getBoundingClientRect();
            return style.visibility !== 'hidden'
                && style.display !== 'none'
                && box.width > 0
                && box.height > 0;
        })""",
        arg=selector,
        timeout=timeout,
    )
    page.evaluate(
        """selector => {
            const target = Array.from(document.querySelectorAll(selector)).find(el => {
                const style = window.getComputedStyle(el);
                const box = el.getBoundingClientRect();
                return style.visibility !== 'hidden'
                    && style.display !== 'none'
                    && box.width > 0
                    && box.height > 0;
            });
            target.click();
        }""",
        selector,
    )


def login(page, user_id: str, user_pw: str) -> None:
    page.goto("https://dhlottery.co.kr/login", wait_until="networkidle")
    page.wait_for_function(
        "() => typeof rsa !== 'undefined' && typeof rsa.encrypt === 'function' && !!rsa.encrypt('probe')",
        timeout=10000,
    )
    fill_first(page, ["#inpUserId", "[placeholder='아이디']"], user_id)
    fill_first(page, ["#inpUserPswdEncn", "[placeholder='비밀번호']"], user_pw)
    click_first(page, ["#btnLogin", "button:has-text('로그인')"])
    page.wait_for_timeout(1000)

    alert_message = page.locator(".ui-dialog:visible, .layer-alert:visible, [role='dialog']:visible").first
    if alert_message.count() > 0:
        text = " ".join(alert_message.inner_text(timeout=1000).split())
        if text:
            raise RuntimeError(f"로그인 실패: {text}")

    try:
        page.wait_for_url(lambda url: "/login" not in url, timeout=10000)
    except Exception:
        pass

    body_text = " ".join(page.locator("body").inner_text(timeout=3000).split())
    if "5회 이상 로그인에 실패" in body_text:
        raise RuntimeError("로그인 실패: 5회 이상 로그인에 실패하여 계정 확인/비밀번호 찾기가 필요합니다.")
    if "아이디 또는 비밀번호가 일치하지 않습니다" in body_text:
        raise RuntimeError("로그인 실패: 아이디 또는 비밀번호가 일치하지 않습니다.")
    if "비밀번호 변경" in body_text and "/mypage/pswdChg" in page.url:
        raise RuntimeError("로그인 후 비밀번호 변경 또는 추가 확인 화면이 표시되었습니다.")

    if page.locator("#inpUserId").is_visible(timeout=1000):
        raise RuntimeError("로그인 후에도 로그인 입력창이 남아 있습니다. 계정 정보 또는 추가 인증을 확인해야 합니다.")


def run(playwright: Playwright) -> str:
    credentials = get_credentials()
    count = env_int("LOTTO_645_COUNT", 5, minimum=1)
    fixed_numbers = env_int_list("LOTTO_645_FIXED_NUMBERS", default=[16])
    dry_run = env_bool("LOTTO_DRY_RUN", default=False)
    headless = env_bool("LOTTO_HEADLESS", default=True)

    browser = playwright.chromium.launch(headless=headless)
    context = browser.new_context(locale="ko-KR", timezone_id="Asia/Seoul")
    page = context.new_page()
    page.set_default_timeout(15000)
    page.on("dialog", lambda dialog: dialog.accept())

    try:
        login(page, credentials.user_id, credentials.user_pw)

        page.goto("https://ol.dhlottery.co.kr/olotto/game/game645.do", wait_until="domcontentloaded")
        page.wait_for_timeout(2500)

        for num in fixed_numbers:
            click_first(page, [f"label[for='check645num{num}']", f"label:has-text('{num}')"])

        click_first(page, ["text=자동선택", "input[value='자동선택']", "#btnSelectNum"])
        select_first(page, ["#amoundApply", "select[name='amoundApply']", "select"], str(count))
        click_first(page, ["input[value='확인']", "button:has-text('확인')", "text=확인"])

        if dry_run:
            return f"DRY RUN: 645 구매 직전까지 확인 완료, count={count}, fixed_numbers={fixed_numbers}"

        click_first(page, ["#btnBuy", "button[name='btnBuy']", "input[value='구매하기']", "text=구매하기"])
        visible_text(page, "#popupLayerConfirm .layer-message")
        page.locator("#popupLayerConfirm input[value='확인']").click(timeout=7000)

        page.wait_for_function(
            """() => {
                const bodyText = document.body.innerText || '';
                const alertLayer = document.querySelector('#popupLayerAlert');
                const alertVisible = alertLayer
                    && window.getComputedStyle(alertLayer).display !== 'none'
                    && alertLayer.innerText.trim().length > 0;
                return bodyText.includes('구매내역 확인') || alertVisible;
            }""",
            timeout=15000,
        )

        body_text = " ".join(page.locator("body").inner_text(timeout=3000).split())
        if "구매내역 확인" in body_text:
            result_message = "구매내역 확인 팝업 표시"
            click_visible(page, "input[value='확인']", timeout=7000)
        else:
            result_message = visible_text(page, "#popupLayerAlert .layer-message", timeout=3000)
            page.locator("#popupLayerAlert input[value='확인']").click(timeout=7000)

        close_buttons = page.locator("input[name='closeLayer'], button:has-text('닫기'), input[value='닫기']")
        if close_buttons.count() > 0:
            close_buttons.first.click(timeout=3000)

        return f"645 구매 요청 완료, count={count}, fixed_numbers={fixed_numbers}, result={result_message}"
    except Exception:
        screenshot = save_failure_screenshot(page, "buy-645")
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
    run_notified("645 구매", main)
