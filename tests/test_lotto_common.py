import os
import unittest
from unittest.mock import patch

from lotto_common import env_bool, env_int, env_int_list, parse_money


class LottoCommonTest(unittest.TestCase):
    def test_parse_money_keeps_only_digits(self):
        self.assertEqual(parse_money("1,234원"), 1234)
        self.assertEqual(parse_money("미당첨"), 0)

    def test_env_bool(self):
        with patch.dict(os.environ, {"X": "true"}):
            self.assertTrue(env_bool("X"))
        with patch.dict(os.environ, {"X": "0"}):
            self.assertFalse(env_bool("X", default=True))

    def test_env_int(self):
        with patch.dict(os.environ, {"COUNT": "5"}):
            self.assertEqual(env_int("COUNT", 1, minimum=1), 5)

    def test_env_int_list(self):
        with patch.dict(os.environ, {"NUMBERS": "1, 16,45"}):
            self.assertEqual(env_int_list("NUMBERS"), [1, 16, 45])


if __name__ == "__main__":
    unittest.main()
