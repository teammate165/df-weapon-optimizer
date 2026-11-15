import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
from update_operation_prices import parse_price


class OperationPricesTest(unittest.TestCase):
    def test_units_and_unavailable_quotes(self):
        for raw, expected in [('1.25万', 12500), ('12万', 120000),
                              ('68,035', 68035), ('{{NumQfw(25630)}}', 25630),
                              ('0', None), ('—', None), ('garbage', None)]:
            with self.subTest(raw=raw):
                self.assertEqual(parse_price(raw), expected)
