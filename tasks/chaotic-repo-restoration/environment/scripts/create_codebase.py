#!/usr/bin/env python3
"""
Create the clean `textproc` codebase and its test suite.
This runs during Docker build BEFORE inject_chaos.py.
"""

import hashlib
import json
import os

CODEBASE = "/workspace/codebase"
GOLDEN = "/workspace/environment/.golden"

os.makedirs(f"{CODEBASE}/textproc", exist_ok=True)
os.makedirs(f"{CODEBASE}/tests", exist_ok=True)
os.makedirs(GOLDEN, exist_ok=True)

# ---- textproc/__init__.py ----
init_py = '''"""textproc — Text processing utilities library."""

from textproc.transforms import (
    to_uppercase,
    to_lowercase,
    to_title_case,
    reverse_string,
    remove_whitespace,
)
from textproc.analysis import (
    word_count,
    char_frequency,
    sentence_count,
    average_word_length,
    find_longest_word,
)
from textproc.formatting import (
    wrap_text,
    indent_text,
    strip_html_tags,
    slugify,
    truncate,
)
from textproc.encoding import (
    to_base64,
    from_base64,
    rot13,
    caesar_cipher,
)
'''

# ---- textproc/transforms.py ----
transforms_py = '''"""String transformation functions."""

def to_uppercase(text):
    """Convert text to uppercase."""
    return text.upper()

def to_lowercase(text):
    """Convert text to lowercase."""
    return text.lower()

def to_title_case(text):
    """Convert text to title case."""
    return text.title()

def reverse_string(text):
    """Reverse a string."""
    return text[::-1]

def remove_whitespace(text):
    """Remove all whitespace from text."""
    return "".join(text.split())
'''

# ---- textproc/analysis.py ----
analysis_py = '''"""Text analysis functions."""

from collections import Counter

def word_count(text):
    """Count the number of words in text."""
    words = text.split()
    return len(words)

def char_frequency(text):
    """Return a dict of character frequencies (lowercase)."""
    return dict(Counter(text.lower()))

def sentence_count(text):
    """Count sentences (split by . ! ?)."""
    count = 0
    for char in text:
        if char in ".!?":
            count += 1
    return max(count, 1) if text.strip() else 0

def average_word_length(text):
    """Compute average word length."""
    words = text.split()
    if not words:
        return 0.0
    total = sum(len(w) for w in words)
    return total / len(words)

def find_longest_word(text):
    """Find the longest word in text."""
    words = text.split()
    if not words:
        return ""
    return max(words, key=len)
'''

# ---- textproc/formatting.py ----
formatting_py = '''"""Text formatting functions."""

import re
import textwrap

def wrap_text(text, width=72):
    """Wrap text to specified width."""
    return textwrap.fill(text, width=width)

def indent_text(text, prefix="    "):
    """Indent each line of text with prefix."""
    lines = text.split("\\n")
    return "\\n".join(prefix + line for line in lines)

def strip_html_tags(text):
    """Remove HTML tags from text."""
    return re.sub(r"<[^>]+>", "", text)

def slugify(text):
    """Convert text to URL-friendly slug."""
    text = text.lower().strip()
    text = re.sub(r"[^\\w\\s-]", "", text)
    text = re.sub(r"[\\s_]+", "-", text)
    text = re.sub(r"-+", "-", text)
    return text.strip("-")

def truncate(text, length=100, suffix="..."):
    """Truncate text to specified length."""
    if len(text) <= length:
        return text
    return text[:length - len(suffix)] + suffix
'''

# ---- textproc/encoding.py ----
encoding_py = '''"""Text encoding/decoding functions."""

import base64

def to_base64(text):
    """Encode text to base64."""
    return base64.b64encode(text.encode("utf-8")).decode("utf-8")

def from_base64(encoded):
    """Decode base64 text."""
    return base64.b64decode(encoded.encode("utf-8")).decode("utf-8")

def rot13(text):
    """Apply ROT13 cipher."""
    result = []
    for char in text:
        if "a" <= char <= "z":
            result.append(chr((ord(char) - ord("a") + 13) % 26 + ord("a")))
        elif "A" <= char <= "Z":
            result.append(chr((ord(char) - ord("A") + 13) % 26 + ord("A")))
        else:
            result.append(char)
    return "".join(result)

def caesar_cipher(text, shift=3):
    """Apply Caesar cipher with given shift."""
    result = []
    for char in text:
        if "a" <= char <= "z":
            result.append(chr((ord(char) - ord("a") + shift) % 26 + ord("a")))
        elif "A" <= char <= "Z":
            result.append(chr((ord(char) - ord("A") + shift) % 26 + ord("A")))
        else:
            result.append(char)
    return "".join(result)
'''

# ---- pyproject.toml ----
pyproject_toml = """[build-system]
requires = ["setuptools>=64", "wheel"]
build-backend = "setuptools.build_meta"

[project]
name = "textproc"
version = "1.0.0"
description = "Text processing utilities"
requires-python = ">=3.8"

[tool.pytest.ini_options]
testpaths = ["tests"]
"""

# ---- requirements.txt ----
requirements_txt = """pytest>=7.0
"""

# ---- tests/test_transforms.py ----
test_transforms = '''"""Tests for textproc.transforms."""
from textproc.transforms import to_uppercase, to_lowercase, to_title_case, reverse_string, remove_whitespace

def test_to_uppercase():
    assert to_uppercase("hello world") == "HELLO WORLD"

def test_to_lowercase():
    assert to_lowercase("HELLO WORLD") == "hello world"

def test_to_title_case():
    assert to_title_case("hello world") == "Hello World"

def test_reverse_string():
    assert reverse_string("hello") == "olleh"
    assert reverse_string("") == ""

def test_remove_whitespace():
    assert remove_whitespace("hello   world  ") == "helloworld"
'''

# ---- tests/test_analysis.py ----
test_analysis = '''"""Tests for textproc.analysis."""
from textproc.analysis import word_count, char_frequency, sentence_count, average_word_length, find_longest_word

def test_word_count():
    assert word_count("hello world foo") == 3
    assert word_count("") == 0

def test_char_frequency():
    freq = char_frequency("aab")
    assert freq["a"] == 2
    assert freq["b"] == 1

def test_sentence_count():
    assert sentence_count("Hello. World! Nice?") == 3
    assert sentence_count("Just one") == 1

def test_average_word_length():
    avg = average_word_length("hi there friend")
    assert abs(avg - 4.33) < 0.1

def test_find_longest_word():
    assert find_longest_word("I am magnificent") == "magnificent"
    assert find_longest_word("") == ""
'''

# ---- tests/test_formatting.py ----
test_formatting = '''"""Tests for textproc.formatting."""
from textproc.formatting import wrap_text, indent_text, strip_html_tags, slugify, truncate

def test_wrap_text():
    result = wrap_text("a " * 50, width=20)
    assert len(result.split("\\n")) > 1

def test_indent_text():
    result = indent_text("line1\\nline2")
    assert result == "    line1\\n    line2"

def test_strip_html_tags():
    assert strip_html_tags("<b>bold</b>") == "bold"
    assert strip_html_tags("no tags") == "no tags"

def test_slugify():
    assert slugify("Hello, World!") == "hello-world"
    assert slugify("  spaces  ") == "spaces"

def test_truncate():
    assert truncate("short", 100) == "short"
    assert len(truncate("a" * 200, 50)) == 50
    assert truncate("a" * 200, 50).endswith("...")
'''

# ---- tests/test_encoding.py ----
test_encoding = '''"""Tests for textproc.encoding."""
from textproc.encoding import to_base64, from_base64, rot13, caesar_cipher

def test_base64_roundtrip():
    text = "hello world"
    assert from_base64(to_base64(text)) == text

def test_rot13():
    assert rot13("hello") == "uryyb"
    assert rot13(rot13("hello")) == "hello"

def test_caesar_cipher():
    assert caesar_cipher("abc", shift=3) == "def"
    assert caesar_cipher("xyz", shift=3) == "abc"
'''

# ---- tests/conftest.py ----
conftest = '''"""Pytest configuration."""
import sys
import os

# Add the codebase root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
'''

# Write all files
files = {
    "textproc/__init__.py": init_py,
    "textproc/transforms.py": transforms_py,
    "textproc/analysis.py": analysis_py,
    "textproc/formatting.py": formatting_py,
    "textproc/encoding.py": encoding_py,
    "pyproject.toml": pyproject_toml,
    "requirements.txt": requirements_txt,
    "tests/test_transforms.py": test_transforms,
    "tests/test_analysis.py": test_analysis,
    "tests/test_formatting.py": test_formatting,
    "tests/test_encoding.py": test_encoding,
    "tests/conftest.py": conftest,
}

checksums = {}
for rel_path, content in files.items():
    full_path = os.path.join(CODEBASE, rel_path)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, "w") as f:
        f.write(content)
    checksums[rel_path] = hashlib.sha256(content.encode()).hexdigest()

# Save golden checksums
with open(os.path.join(GOLDEN, "golden_checksums.json"), "w") as f:
    json.dump(checksums, f, indent=2)

# Run pytest to verify clean state
import subprocess

result = subprocess.run(
    ["python3", "-m", "pytest", "tests/", "-v", "--tb=short"],
    cwd=CODEBASE,
    capture_output=True,
    text=True,
    timeout=30,
)
print(result.stdout)
if result.returncode != 0:
    print("ERROR: Clean codebase tests failed!")
    print(result.stderr)
    raise SystemExit(1)

# Save test count baseline
test_count = result.stdout.count(" PASSED")
with open(os.path.join(GOLDEN, "baseline_test_count.txt"), "w") as f:
    f.write(str(test_count))

print(f"Clean codebase created: {len(files)} files, {test_count} tests pass")
