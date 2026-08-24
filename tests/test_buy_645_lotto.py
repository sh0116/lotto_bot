import unittest

from buy_645_lotto import (
    is_max_games_per_purchase_message,
    is_purchase_limit_message,
)


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


if __name__ == "__main__":
    unittest.main()
