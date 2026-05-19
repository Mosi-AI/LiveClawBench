import re
import unittest
from pathlib import Path


class SmarthomeTestSeedConsistency(unittest.TestCase):
    def test_inventory_count_constants_match_seed(self) -> None:
        verify_path = Path(__file__).resolve().parent / "verify.py"
        seed_path = Path(__file__).resolve().parents[1] / "environment" / "seed.sql"

        verify_text = verify_path.read_text()
        seed_text = seed_path.read_text()

        fridge_match = re.search(
            r"EXPECTED_FRIDGE_COUNT\s*=\s*\(?\s*(\d+)",
            verify_text,
            re.DOTALL,
        )
        pantry_match = re.search(r"EXPECTED_PANTRY_COUNT\s*=\s*(\d+)", verify_text)

        self.assertIsNotNone(fridge_match)
        self.assertIsNotNone(pantry_match)

        inventory_section = re.search(
            r"INSERT OR IGNORE INTO inventory_item .*?VALUES\n(.*?);",
            seed_text,
            re.DOTALL,
        )
        self.assertIsNotNone(inventory_section)

        rows = inventory_section.group(1)
        fridge_count = len(re.findall(r"'fridge'", rows))
        pantry_count = len(re.findall(r"'pantry'", rows))

        self.assertEqual(int(fridge_match.group(1)), fridge_count)
        self.assertEqual(int(pantry_match.group(1)), pantry_count)


if __name__ == "__main__":
    unittest.main()
