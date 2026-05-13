import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import evaluate as e


def test_find_skill_md_found(tmp_path):
    skill_file = tmp_path / "SKILL.md"
    skill_file.write_text("# Skill\n")
    found = e.find_skill_md(tmp_path)
    assert len(found) == 1
    assert found[0].name == "SKILL.md"


def test_find_skill_md_not_found(tmp_path):
    found = e.find_skill_md(tmp_path)
    assert found == []


def test_find_skill_md_nested(tmp_path):
    nested = tmp_path / "sub" / "dir"
    nested.mkdir(parents=True)
    skill_file = nested / "SKILL.md"
    skill_file.write_text("# Skill\n")
    found = e.find_skill_md(tmp_path)
    assert len(found) == 1


def test_evaluate_pass(tmp_path):
    skill_file = tmp_path / "SKILL.md"
    skill_file.write_text("# Skill\n")
    report = e.evaluate(tmp_path)
    assert report["passed"] is True
    assert "SKILL.md" in report["detail"]


def test_evaluate_fail(tmp_path):
    report = e.evaluate(tmp_path)
    assert report["passed"] is False
    assert "No SKILL.md found" in report["detail"]
