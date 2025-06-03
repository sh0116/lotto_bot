import os
import time
from playwright.sync_api import Playwright, sync_playwright

# 모든 조(1,2,3,4,5조) 이외 번호 자동
def run(playwright: Playwright):
    # 동행복권 아이디와 패스워드를 설정
    user_id = os.environ.get("LOTTO_ID")
    user_pw = os.environ.get("LOTTO_PW")
    if not user_id or not user_pw:
        raise ValueError("환경변수 LOTTO_ID, LOTTO_PW가 설정되지 않았습니다.")

    # 브라우저 열기
    browser = playwright.chromium.launch(headless=False)  # headless=False → 창 보이기
    context = browser.new_context()
    page = context.new_page()

    FIXED_NUMBERS = [16]

    try:
        # 로그인 페이지 접속
        page.goto("https://dhlottery.co.kr/user.do?method=login")

        # 로그인 입력
        page.fill("[placeholder=\"아이디\"]", user_id)
        page.fill("[placeholder=\"비밀번호\"]", user_pw)
        page.press("[placeholder=\"비밀번호\"]", "Enter")
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

        print("✅ 720 연금로또 구매 성공")

    except Exception as e:
        print(f"❌ 오류 발생: {e}")

    finally:
        context.close()
        browser.close()


if __name__ == "__main__":
    with sync_playwright() as playwright:
        run(playwright)
