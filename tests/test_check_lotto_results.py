import unittest

from check_lotto_results import normalize_date, parse_ledger_cards_from_text, ticket_key
from lotto_common import LottoBotError


class CheckLottoResultsTest(unittest.TestCase):
    def test_normalize_date_accepts_digits_and_dots(self):
        self.assertEqual(normalize_date("2026.09.15"), "20260915")
        self.assertEqual(normalize_date("20260915"), "20260915")

    def test_normalize_date_rejects_wrong_length(self):
        with self.assertRaises(LottoBotError):
            normalize_date("2026-9-15")

    def test_ticket_key_uses_round_ticket_and_purchase_date(self):
        item = {"round": "1190", "ticket_number": "123", "purchase_date": "2026-09-11"}
        self.assertEqual(ticket_key(item), ("1190", "123", "2026-09-11"))


    def test_parse_ledger_cards_from_current_mobile_text(self):
        text = (
            "구입일자 2026-09-15 로또6/45 1242 "
            "61785 97467 67327 04621 27248 37763 "
            "구입매수 5 미추첨 - 추첨일자 2026-09-19 "
            "구입일자 2026-09-04 로또6/45 1240 "
            "65235 91494 21337 47138 09277 55710 "
            "구입매수 5 낙첨 0 원 추첨일자 2026-09-05"
        )

        rows = parse_ledger_cards_from_text(text)

        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]["purchase_date"], "2026-09-15")
        self.assertEqual(rows[0]["round"], "1242")
        self.assertEqual(rows[0]["quantity"], "5")
        self.assertEqual(rows[0]["result"], "미추첨")
        self.assertEqual(rows[1]["result"], "낙첨")


if __name__ == "__main__":
    unittest.main()
