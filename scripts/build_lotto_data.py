import json
import urllib.request
from datetime import date
from html import unescape
from html.parser import HTMLParser
from pathlib import Path


SOURCE_URL = "https://en.lottolyzer.com/history/south-korea/6_slash_45-lotto"
OUTPUT_PATH = Path("docs/data/draws.json")


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


def main() -> None:
    request = urllib.request.Request(SOURCE_URL, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(request, timeout=20) as response:
        text = response.read().decode("utf-8", errors="ignore")

    draws = parse_draws(text)
    if not draws:
        raise RuntimeError("No lotto draw rows found")

    draws.sort(key=lambda draw: draw["round"], reverse=True)

    payload = {
        "source": SOURCE_URL,
        "sourceLabel": "Lottolyzer 공개 데이터",
        "generatedAt": date.today().isoformat(),
        "drawCount": len(draws),
        "firstRound": draws[-1]["round"],
        "lastRound": draws[0]["round"],
        "draws": draws,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {OUTPUT_PATH} with {len(draws)} draws")


if __name__ == "__main__":
    main()
