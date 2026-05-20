import re
import unittest
from pathlib import Path


class GroceryReorderSeedOrderStatusTests(unittest.TestCase):
    def test_seeded_historical_orders_are_shipped(self) -> None:
        startup_path = Path(__file__).resolve().parents[1] / "environment" / "startup.sh"
        startup_text = startup_path.read_text()

        statuses = re.findall(r'"status":\s*"([^"]+)"', startup_text)

        self.assertGreater(len(statuses), 0)
        self.assertTrue(all(status == "Shipped" for status in statuses))


if __name__ == "__main__":
    unittest.main()
