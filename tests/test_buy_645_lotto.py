import unittest
from unittest.mock import patch

from buy_645_lotto import (
    assert_expected_account,
    assert_sufficient_deposit,
    read_deposit_amount,
    is_max_games_per_purchase_message,
    is_purchase_limit_message,
)
from lotto_common import LottoBotError


class FakeDepositLocator:
    def __init__(self, text):
        self._text = text
        self.first = self

    def wait_for(self, **kwargs):
        return None

    def inner_text(self, **kwargs):
        return self._text


class FakeDepositPage:
    def __init__(self, body_text, selector_text="0원"):
        self.body_text = body_text
        self.selector_text = selector_text

    def locator(self, selector):
        if selector == "body":
            return FakeDepositLocator(self.body_text)
        return FakeDepositLocator(self.selector_text)


class Lotto645PurchaseTest(unittest.TestCase):
    def test_purchase_limit_message_is_terminal(self):
        message = "이번 주 로또 구매한도 5천원을 모두 채우셨습니다."

        self.assertTrue(is_purchase_limit_message(message))
        self.assertFalse(is_max_games_per_purchase_message(message))

    def test_purchase_limit_modal_text_is_terminal(self):
        message = "구매한도 알림 이번 주 로또 구매한도 5천원을 모두 채우셨습니다."

        self.assertTrue(is_purchase_limit_message(message))
        self.assertFalse(is_max_games_per_purchase_message(message))

    def test_max_games_message_is_retryable_alert(self):
        message = "1회 최대 5게임만 구매할 수 있습니다. (5,000원)"

        self.assertTrue(is_max_games_per_purchase_message(message))
        self.assertFalse(is_purchase_limit_message(message))

    def test_sufficient_deposit_rejects_short_balance(self):
        with self.assertRaises(LottoBotError):
            assert_sufficient_deposit(4000, 5000)

    def test_sufficient_deposit_accepts_required_balance(self):
        assert_sufficient_deposit(5000, 5000)

    def test_expected_account_label_rejects_mismatch(self):
        with patch.dict("os.environ", {"LOTTO_EXPECTED_ACCOUNT_LABEL": "김*현"}):
            with self.assertRaises(LottoBotError):
                assert_expected_account("이*정")

    def test_expected_account_label_accepts_match(self):
        with patch.dict("os.environ", {"LOTTO_EXPECTED_ACCOUNT_LABEL": "김*현"}):
            assert_expected_account("김*현")

    def test_read_deposit_prefers_balance_card_over_header_zero(self):
        page = FakeDepositPage("김*현님 로그아웃 예치금 0 원 충전 예치금 잔액 9,000 원 구매가능 9,000원")

        self.assertEqual(read_deposit_amount(page), 9000)

    def test_read_deposit_uses_max_header_value_as_fallback(self):
        page = FakeDepositPage("김*현님 로그아웃 예치금 0 원 다른 영역 예치금 9,000 원")

        self.assertEqual(read_deposit_amount(page), 9000)


if __name__ == "__main__":
    unittest.main()
