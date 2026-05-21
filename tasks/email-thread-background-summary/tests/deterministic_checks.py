from pathlib import Path

OUTPUT_FILE = Path.home() / ".openclaw" / "output" / "project_background.txt"

PROJECT_KEYWORDS = ["nova analytics platform", "nova analytics"]

# Key facts seeded across the four nova_*.md corpus files
CORPUS_FACTS = [
    "sarah kim",
    "q3 2026",
    "kafka",
    "bigquery",
    "dbt",
    "2 million",
    "marcus osei",
    "data migration",
]


def check_output_file() -> float:
    return 1.0 if OUTPUT_FILE.exists() else 0.0


def check_project_identified() -> float:
    if not OUTPUT_FILE.exists():
        return 0.0
    content = OUTPUT_FILE.read_text(encoding="utf-8", errors="replace").lower()
    return 1.0 if any(kw in content for kw in PROJECT_KEYWORDS) else 0.0


def check_corpus_coverage() -> float:
    if not OUTPUT_FILE.exists():
        return 0.0
    content = OUTPUT_FILE.read_text(encoding="utf-8", errors="replace").lower()
    found = sum(1 for fact in CORPUS_FACTS if fact in content)
    # Scale: need at least 3 facts for full credit
    return min(found / 3.0, 1.0)


def run_checks() -> dict:
    return {
        "output_file_exists": check_output_file(),
        "project_identified": check_project_identified(),
        "corpus_coverage_score": check_corpus_coverage(),
    }
