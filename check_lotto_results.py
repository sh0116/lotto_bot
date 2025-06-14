import os
import time
import re
from playwright.sync_api import Playwright, sync_playwright

# 구매할 게임 수
COUNT = 5

# 5(5천원) 게임 자동 구매
def run(playwright: Playwright):
    # 동행복권 아이디와 패스워드를 설정
    user_id = os.environ.get("LOTTO_ID")
    user_pw = os.environ.get("LOTTO_PW")
    if not user_id or not user_pw:
        raise ValueError("환경변수 LOTTO_ID, LOTTO_PW가 설정되지 않았습니다.")

    # 브라우저 열기
    browser = playwright.chromium.launch(headless=True)  # headless=False → 창 보이기
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

        # 예치금 조회 페이지로 이동
        page.goto("https://dhlottery.co.kr/userSsl.do?method=myPage")
        page.wait_for_timeout(2000)
        # 프레임 내부에서 예치금 strong 태그 찾기
        deposit_str = page.query_selector("p.total_new > strong").inner_text().strip()
        deposit_amount = int(deposit_str.replace(",", ""))
        print(f"예치금: {deposit_amount}원")


        # 당첨여부 조회 페이지로 이동
        page.goto("https://dhlottery.co.kr/myPage.do?method=lottoBuyListView")
        page.wait_for_timeout(2000)

        # 날짜 설정: 조회 시작 날짜를 2025.01.01로 설정
        page.fill("#calendarStartDt", "20250101")
        page.press("#calendarStartDt", "Enter") 
        page.wait_for_timeout(1000)

        page.click("#submit_btn")
        page.wait_for_timeout(1000)
        


        results = []
        seen_tickets = set()
        visited_pages = set()

        frame = page.frame(name="lottoBuyList")

        def parse_table_data(frame):
            rows = frame.query_selector_all("table.tbl_data_col tbody tr")
            for row in rows:
                cols = row.query_selector_all("td")
                if len(cols) == 8:
                    ticket_number = cols[3].inner_text().strip()
                    if ticket_number in seen_tickets:
                        continue  # 중복 제거
                    seen_tickets.add(ticket_number)

                    results.append({
                        "purchase_date": cols[0].inner_text().strip(),
                        "lotto_name": cols[1].inner_text().strip(),
                        "round": cols[2].inner_text().strip(),
                        "ticket_number": ticket_number,
                        "quantity": cols[4].inner_text().strip(),
                        "result": cols[5].inner_text().strip(),
                        "prize": cols[6].inner_text().strip(),
                        "draw_date": cols[7].inner_text().strip(),
                    })

        while True:
            frame = page.frame(name="lottoBuyList")  # ✅ 반드시 매 반복마다 재할당
            parse_table_data(frame)

            # 페이지 이동 링크 확인
            page_links = frame.query_selector_all("div#page_box a")

            next_page_number = None

            for link in page_links:
                onclick = link.get_attribute("onclick")
                if onclick and "selfSubmit" in onclick:
                    match = re.search(r"selfSubmit\((\d+)\)", onclick)
                    if match:
                        page_num = int(match.group(1))
                        if page_num not in visited_pages:
                            next_page_number = page_num
                            visited_pages.add(page_num)
                            break

            if next_page_number is None:
                break  # 더 이상 새로운 페이지 없음

            # 다음 페이지 이동
            frame.eval_on_selector(f"a[onclick*='selfSubmit({next_page_number})']", "el => el.click()")
            page.wait_for_timeout(3000)


        total_prize = 0
        
        for result in results:
            if result['result'] == '당첨':
                total_prize += result['prize']
            
        print(f"총 당첨 금액 : {total_prize}")

    except Exception as e:
        print(f"❌ 오류 발생: {e}")

    finally:
        context.close()
        browser.close()


if __name__ == "__main__":
    with sync_playwright() as playwright:
        run(playwright)
