좋습니다! 아래는 위의 코드와 GitHub Actions 워크플로우에 맞춘 README.md 마크다운 템플릿입니다. 로또 645 자동 구매 기능에 대한 설명과 사용법, GitHub Actions 자동화까지 깔끔하게 담았습니다.

⸻



# 🎰 LottoBot - 자동 로또 구매 봇 (645 & 720)

Python + Playwright 기반의 **동행복권 자동 로또 구매 봇**입니다.  
GitHub Actions를 통해 **매주 금요일 오전 8시(KST)** 에 로또 645를 자동으로 구매합니다.  
연금복권 720+ 구매 및 당첨 확인 기능도 함께 포함할 수 있습니다.

---

## 🧩 기능

- ✅ 로또 6/45 자동 또는 수동 번호 구매
- ✅ GitHub Actions로 매주 정해진 시간에 자동 실행
- ✅ 환경변수 기반 안전한 로그인 처리
- ✅ 예치금, 구매 내역, 당첨 내역 확인 기능 (옵션)
- 🛠 연금복권 720+ 자동 구매 코드 포함

---

## 🚀 사용법

### 1. 이 저장소를 **fork 또는 clone** 합니다.

```bash
git clone https://github.com/your-username/lotto-bot.git
cd lotto-bot
```


### 2. Python 및 의존성 설치

pip install -r requirements.txt
playwright install

### 3. .env 설정 (로컬 테스트 시)

로컬 테스트용 .env 파일을 만들어 아이디/비밀번호를 설정합니다:

LOTTO_ID=your_username
LOTTO_PW=your_password

### 4. GitHub Secrets 설정

GitHub 저장소에 다음 Secret 값을 추가합니다:
Settings > Secrets and variables > Actions > New repository secret


LOTTO_ID: 동행복권 로그인 아이디<br>
LOTTO_PW: 동행복권 로그인 비밀번호



⸻

🕘 자동 실행 일정 (GitHub Actions)

현재 설정은 다음과 같습니다:

파일명: .github/workflows/buy_645_lotto.yml<br>
스케줄: 매주 금요일 오전 8시(KST)<br>
동작: buy_645_lotto.py 실행하여 로또 구매

파일명: .github/workflows/buy_720_lotto.yml<br>
스케줄: 매주 월요일 오전 9시(KST)<br>
동작: buy_720_lotto.py 실행하여 로또 구매

수동으로 실행하고 싶을 때는 GitHub Actions → 워크플로우 선택 → Run workflow 버튼을 누르세요.

⸻

🧾 예시: buy_645_lotto.py

page.goto("https://ol.dhlottery.co.kr/olotto/game/game645.do")<br>
page.click("label:has-text(\"16\")")  # 수동 번호 선택<br>
page.click("text=자동선택")<br>
page.select_option("select", "5")     # 5게임 선택<br>
page.click("text=확인")<br>
page.click("input[value=\"구매하기\"]")


⸻

⚠️ 주의사항

	•	이 코드는 개인 용도로만 사용하세요.
	•	자동 구매 기능은 실제 돈이 결제됩니다.
	•	로또는 적당히 즐기세요! 🙏

