from playwright.sync_api import Playwright, sync_playwright

from lotto_common import get_credentials, run_notified, save_failure_screenshot


# 모든 조(1,2,3,4,5조) 이외 번호 자동
def run(playwright: Playwright) -> str:
    credentials = get_credentials()

    # 브라우저 열기
    browser = playwright.chromium.launch(headless=True)  # headless=False → 창 보이기
    context = browser.new_context()
    page = context.new_page()

    try:
        # 로그인 페이지 접속
        page.goto("https://dhlottery.co.kr/login")

        # 로그인 입력
        page.fill("#inpUserId", credentials.user_id)
        page.fill("#inpUserPswdEncn", credentials.user_pw)
        page.click("#btnLogin")
        page.wait_for_timeout(2000)

        # 게임 페이지로 이동
        page.goto("https://el.dhlottery.co.kr/game/pension720/game.jsp")
        page.wait_for_timeout(2000)

        # 자동 선택
        page.click("text=자동번호")
        page.wait_for_timeout(1000)        
        page.click("text=선택완료")
        page.wait_for_timeout(1000)
        page.click("text=구매하기")
        page.wait_for_timeout(1000)
        page.click("div.lotto720_popup_bottom_wrapper a.btn_blue:has-text('구매하기')")
        page.wait_for_timeout(1000)

        return "720 연금복권 구매 요청 완료"
    except Exception:
        screenshot = save_failure_screenshot(page, "buy-720")
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
    run_notified("720 구매", main)
