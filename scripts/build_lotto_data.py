import json
import urllib.request
from csv import reader
from datetime import date
from html import unescape
from html.parser import HTMLParser
from io import StringIO
from pathlib import Path


LOTTOLYZER_URL = "https://en.lottolyzer.com/history/south-korea/6_slash_45-lotto"
LEGACY_CSV_URL = "https://raw.githubusercontent.com/ioahKwon/Korean-Lottery-games-Analysis/master/data/lotto.csv"
OUTPUT_PATH = Path("docs/data/draws.json")
USER_AGENT = "Mozilla/5.0"


class LottoHistoryParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self._in_cell = False
        self._cell_parts = []
        self._cells = []
        self.rows = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "td":
            self._in_cell = True
            self._cell_parts = []

    def handle_data(self, data: str) -> None:
        if self._in_cell:
            self._cell_parts.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag == "td" and self._in_cell:
            self._in_cell = False
            self._cells.append(" ".join(part.strip() for part in self._cell_parts).strip())
        elif tag == "tr":
            if self._cells:
                self.rows.append(self._cells)
            self._cells = []


def parse_draws(html: str) -> list[dict[str, object]]:
    parser = LottoHistoryParser()
    parser.feed(html)

    draws = []
    for cells in parser.rows:
        if len(cells) < 4:
            continue
        round_text, date_text, numbers_text, bonus_text = (unescape(cell).strip() for cell in cells[:4])
        if not round_text.isdigit() or not bonus_text.isdigit():
            continue
        numbers = [int(value) for value in numbers_text.replace(" ", "").split(",") if value.isdigit()]
        if len(numbers) != 6:
            continue
        draws.append({
            "round": int(round_text),
            "date": date_text,
            "numbers": numbers,
            "bonus": int(bonus_text),
        })

    return draws


def fetch_text(url: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=20) as response:
        return response.read().decode("utf-8", errors="ignore")


def lottolyzer_page_url(page: int) -> str:
    if page == 1:
        return LOTTOLYZER_URL
    return f"{LOTTOLYZER_URL}/page/{page}/per-page/50/summary-view"


def fetch_lottolyzer_draws() -> list[dict[str, object]]:
    draws: list[dict[str, object]] = []
    for page in range(1, 60):
        page_draws = parse_draws(fetch_text(lottolyzer_page_url(page)))
        if not page_draws:
            break
        draws.extend(page_draws)
    return draws


def parse_legacy_csv(csv_text: str) -> list[dict[str, object]]:
    draws = []
    for index, row in enumerate(reader(StringIO(csv_text)), start=1):
        if len(row) < 7:
            continue
        values = [int(value.strip().lstrip("\ufeff")) for value in row[:7]]
        draws.append({
            "round": index,
            "date": None,
            "numbers": values[:6],
            "bonus": values[6],
        })
    return draws

def merge_draws(*draw_sets: list[dict[str, object]]) -> list[dict[str, object]]:
    by_round: dict[int, dict[str, object]] = {}
    for draw_set in draw_sets:
        for draw in draw_set:
            by_round[int(draw["round"])] = draw
    return sorted(by_round.values(), key=lambda draw: int(draw["round"]), reverse=True)


def main() -> None:
    legacy_draws = parse_legacy_csv(fetch_text(LEGACY_CSV_URL))
    recent_draws = fetch_lottolyzer_draws()
    draws = merge_draws(legacy_draws, recent_draws)
    if not draws:
        raise RuntimeError("No lotto draw rows found")

    rounds = [int(draw["round"]) for draw in draws]
    missing_rounds = sorted(set(range(min(rounds), max(rounds) + 1)) - set(rounds))
    if missing_rounds:
        missing_preview = ", ".join(str(round_number) for round_number in missing_rounds[:10])
        raise RuntimeError(f"Missing lotto rounds: {missing_preview}")

    payload = {
        "source": [LOTTOLYZER_URL, LEGACY_CSV_URL],
        "sourceLabel": "Lottolyzer + 공개 CSV",
        "generatedAt": date.today().isoformat(),
        "drawCount": len(draws),
        "firstRound": int(draws[-1]["round"]),
        "lastRound": int(draws[0]["round"]),
        "draws": draws,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {OUTPUT_PATH} with {len(draws)} draws")


if __name__ == "__main__":
    main()
