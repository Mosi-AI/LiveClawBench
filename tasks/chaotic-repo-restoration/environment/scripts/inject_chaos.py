#!/usr/bin/env python3
"""
Inject chaos into the clean textproc codebase.
Uses seed=42 for reproducibility.

Injection types:
1. Swap 3 pairs of function bodies between files
2. Inject 8 junk .py files
3. Insert 6 syntax-level micro-errors
4. Pollute requirements.txt and pyproject.toml
5. Move tests/ → test_archive/
6. Add junk imports to __init__.py
"""

import json
import os
import random
import shutil

random.seed(42)

CODEBASE = "/workspace/codebase"
GOLDEN = "/workspace/environment/.golden"

manifest = {
    "swaps": [],
    "junk_files": [],
    "syntax_errors": [],
    "config_changes": [],
    "test_move": False,
}


# ---- 1. Swap function bodies ----
def swap_functions():
    """Swap function bodies between files (keep signature + docstring)."""

    # Swap 1: to_uppercase body <-> word_count body
    transforms = os.path.join(CODEBASE, "textproc/transforms.py")
    analysis = os.path.join(CODEBASE, "textproc/analysis.py")

    with open(transforms) as f:
        t_content = f.read()
    with open(analysis) as f:
        a_content = f.read()

    # Swap to_uppercase <-> word_count (swap the return logic)
    t_content = t_content.replace(
        '    """Convert text to uppercase."""\n    return text.upper()',
        '    """Convert text to uppercase."""\n    words = text.split()\n    return len(words)',
    )
    a_content = a_content.replace(
        '    """Count the number of words in text."""\n    words = text.split()\n    return len(words)',
        '    """Count the number of words in text."""\n    return text.upper()',
    )
    manifest["swaps"].append({"func1": "to_uppercase", "func2": "word_count"})

    # Swap 2: reverse_string <-> rot13
    encoding = os.path.join(CODEBASE, "textproc/encoding.py")
    with open(encoding) as f:
        e_content = f.read()

    t_content = t_content.replace(
        '    """Reverse a string."""\n    return text[::-1]',
        '    """Reverse a string."""\n    result = []\n    for char in text:\n        if "a" <= char <= "z":\n            result.append(chr((ord(char) - ord("a") + 13) % 26 + ord("a")))\n        elif "A" <= char <= "Z":\n            result.append(chr((ord(char) - ord("A") + 13) % 26 + ord("A")))\n        else:\n            result.append(char)\n    return "".join(result)',
    )
    e_content = e_content.replace(
        '    """Apply ROT13 cipher."""\n    result = []\n    for char in text:\n        if "a" <= char <= "z":\n            result.append(chr((ord(char) - ord("a") + 13) % 26 + ord("a")))\n        elif "A" <= char <= "Z":\n            result.append(chr((ord(char) - ord("A") + 13) % 26 + ord("A")))\n        else:\n            result.append(char)\n    return "".join(result)',
        '    """Apply ROT13 cipher."""\n    return text[::-1]',
    )
    manifest["swaps"].append({"func1": "reverse_string", "func2": "rot13"})

    # Swap 3: slugify <-> to_base64
    formatting = os.path.join(CODEBASE, "textproc/formatting.py")
    with open(formatting) as f:
        f_content = f.read()

    f_content = f_content.replace(
        '    """Convert text to URL-friendly slug."""\n    text = text.lower().strip()\n    text = re.sub(r"[^\\w\\s-]", "", text)\n    text = re.sub(r"[\\s_]+", "-", text)\n    text = re.sub(r"-+", "-", text)\n    return text.strip("-")',
        '    """Convert text to URL-friendly slug."""\n    import base64\n    return base64.b64encode(text.encode("utf-8")).decode("utf-8")',
    )
    e_content = e_content.replace(
        '    """Encode text to base64."""\n    return base64.b64encode(text.encode("utf-8")).decode("utf-8")',
        '    """Encode text to base64."""\n    import re\n    text = text.lower().strip()\n    text = re.sub(r"[^\\w\\s-]", "", text)\n    text = re.sub(r"[\\s_]+", "-", text)\n    text = re.sub(r"-+", "-", text)\n    return text.strip("-")',
    )
    manifest["swaps"].append({"func1": "slugify", "func2": "to_base64"})

    with open(transforms, "w") as f:
        f.write(t_content)
    with open(analysis, "w") as f:
        f.write(a_content)
    with open(encoding, "w") as f:
        f.write(e_content)
    with open(formatting, "w") as f:
        f.write(f_content)


# ---- 2. Inject junk files ----
JUNK_FILES = {
    "textproc/helpers.py": '''"""Helper utilities for text processing."""

class TextBuffer:
    """A text buffer for streaming operations."""
    def __init__(self, capacity=1024):
        self._buf = []
        self._cap = capacity

    def append(self, text):
        self._buf.append(text)

    def flush(self):
        result = "".join(self._buf)
        self._buf.clear()
        return result

def normalize_unicode(text):
    """Normalize unicode text to NFC form."""
    import unicodedata
    return unicodedata.normalize("NFC", text)
''',
    "textproc/deprecated.py": '''"""Deprecated functions — DO NOT USE."""

def old_word_count(text):
    return len(text.split(" "))

def legacy_transform(text, mode="upper"):
    if mode == "upper":
        return text.upper()
    return text
''',
    "textproc/experimental_nlp.py": '''"""Experimental NLP functions (WIP)."""

def extract_keywords(text, top_n=5):
    words = text.lower().split()
    freq = {}
    for w in words:
        freq[w] = freq.get(w, 0) + 1
    sorted_words = sorted(freq.items(), key=lambda x: x[1], reverse=True)
    return [w for w, _ in sorted_words[:top_n]]

def sentiment_score(text):
    positive = ["good", "great", "excellent", "amazing"]
    negative = ["bad", "terrible", "awful", "horrible"]
    words = text.lower().split()
    score = sum(1 for w in words if w in positive) - sum(1 for w in words if w in negative)
    return score
''',
    "utils/__init__.py": '''"""Utility package."""
''',
    "utils/string_helpers.py": '''"""String utility helpers — experimental module."""

def pad_string(s, width, char=" "):
    if len(s) >= width:
        return s
    padding = (width - len(s)) // 2
    return char * padding + s + char * padding

def chunk_text(text, size=100):
    return [text[i:i+size] for i in range(0, len(text), size)]
''',
    "benchmark.py": '''"""Benchmark suite for textproc."""
import time

def run_benchmark():
    from textproc import to_uppercase
    start = time.time()
    for _ in range(100000):
        to_uppercase("hello world benchmark test")
    elapsed = time.time() - start
    print(f"100k to_uppercase calls: {elapsed:.3f}s")

if __name__ == "__main__":
    run_benchmark()
''',
    "setup_legacy.py": '''"""Legacy setup.py — kept for backward compatibility."""
from setuptools import setup

setup(
    name="textproc-legacy",
    version="0.1.0",
    packages=["textproc"],
    install_requires=["six", "future"],
)
''',
    "NOTES.md": """# Development Notes

## TODO
- Add async variants of all functions
- Implement streaming API
- Add Cython optimizations for performance-critical paths
- Consider Rust extension for encoding module
""",
}


def inject_junk():
    for rel_path, content in JUNK_FILES.items():
        full_path = os.path.join(CODEBASE, rel_path)
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        with open(full_path, "w") as f:
            f.write(content)
        manifest["junk_files"].append(rel_path)

    # Add junk imports to __init__.py
    init_path = os.path.join(CODEBASE, "textproc/__init__.py")
    with open(init_path) as f:
        content = f.read()
    content += "\nfrom textproc.helpers import TextBuffer, normalize_unicode\n"
    content += "from textproc.deprecated import old_word_count, legacy_transform\n"
    with open(init_path, "w") as f:
        f.write(content)
    manifest["config_changes"].append("Added junk imports to __init__.py")


# ---- 3. Syntax errors ----
def inject_syntax_errors():
    # Error 1: typo in analysis.py — `retrun` instead of `return`
    path = os.path.join(CODEBASE, "textproc/analysis.py")
    with open(path) as f:
        content = f.read()
    content = content.replace(
        "    return max(words, key=len)",
        "    retrun max(words, key=len)",
        1,
    )
    with open(path, "w") as f:
        f.write(content)
    manifest["syntax_errors"].append(
        {"file": "textproc/analysis.py", "type": "typo", "detail": "retrun -> return"}
    )

    # Error 2: extra indentation in formatting.py
    path = os.path.join(CODEBASE, "textproc/formatting.py")
    with open(path) as f:
        content = f.read()
    content = content.replace(
        '    lines = text.split("\\n")\n    return',
        '    lines = text.split("\\n")\n        return',
        1,
    )
    with open(path, "w") as f:
        f.write(content)
    manifest["syntax_errors"].append(
        {
            "file": "textproc/formatting.py",
            "type": "indentation",
            "detail": "extra indent on return",
        }
    )

    # Error 3: == changed to = in encoding.py (assignment instead of comparison)
    path = os.path.join(CODEBASE, "textproc/encoding.py")
    with open(path) as f:
        content = f.read()
    content = content.replace(
        "shift=3",
        "shift=3",  # keep this one; change a different comparison
    )
    # Add a subtle bug: missing return in from_base64
    content = content.replace(
        '    """Decode base64 text."""\n    return base64.b64decode(encoded.encode("utf-8")).decode("utf-8")',
        '    """Decode base64 text."""\n    base64.b64decode(encoded.encode("utf-8")).decode("utf-8")',
    )
    with open(path, "w") as f:
        f.write(content)
    manifest["syntax_errors"].append(
        {
            "file": "textproc/encoding.py",
            "type": "missing_return",
            "detail": "from_base64 missing return",
        }
    )

    # Error 4: missing colon after if in transforms.py
    path = os.path.join(CODEBASE, "textproc/transforms.py")
    with open(path) as f:
        content = f.read()
    content = content.replace(
        '    """Remove all whitespace from text."""\n    return "".join(text.split())',
        '    """Remove all whitespace from text."""\n    return "".join(text.split( ))',
    )
    with open(path, "w") as f:
        f.write(content)
    manifest["syntax_errors"].append(
        {
            "file": "textproc/transforms.py",
            "type": "extra_space",
            "detail": "text.split( ) extra space",
        }
    )

    # Error 5: variable name typo in analysis.py
    path = os.path.join(CODEBASE, "textproc/analysis.py")
    with open(path) as f:
        content = f.read()
    content = content.replace(
        "    return dict(Counter(text.lower()))",
        "    return dict(Counter(txet.lower()))",
        1,
    )
    with open(path, "w") as f:
        f.write(content)
    manifest["syntax_errors"].append(
        {"file": "textproc/analysis.py", "type": "typo", "detail": "txet -> text"}
    )

    # Error 6: wrong operator in analysis.py sentence_count
    path = os.path.join(CODEBASE, "textproc/analysis.py")
    with open(path) as f:
        content = f.read()
    content = content.replace(
        '        if char in ".!?"',
        '        if char in ".!;"',
        1,
    )
    with open(path, "w") as f:
        f.write(content)
    manifest["syntax_errors"].append(
        {
            "file": "textproc/analysis.py",
            "type": "wrong_char",
            "detail": "? replaced with ; in sentence delimiters",
        }
    )


# ---- 4. Pollute config files ----
def pollute_config():
    # Pollute requirements.txt
    req_path = os.path.join(CODEBASE, "requirements.txt")
    with open(req_path, "w") as f:
        f.write("pytest>=7.0\nfake-nonexistent-package>=1.0\nsix>=1.0\nfuture>=0.18\n")
    manifest["config_changes"].append("Added fake packages to requirements.txt")

    # Pollute pyproject.toml
    toml_path = os.path.join(CODEBASE, "pyproject.toml")
    with open(toml_path, "w") as f:
        f.write("""[build-system]
requires = ["setuptools>=64", "wheel"]
build-backend = "setuptools.build_meta"

[project]
name = "textproc-experimental"
version = "0.0.1-alpha"
description = "Text processing utilities"
requires-python = ">=3.13"

[tool.pytest.ini_options]
testpaths = ["test_archive"]
""")
    manifest["config_changes"].append(
        "Changed package name, version, python requires, testpaths in pyproject.toml"
    )


# ---- 5. Move tests ----
def move_tests():
    src = os.path.join(CODEBASE, "tests")
    dst = os.path.join(CODEBASE, "test_archive")
    shutil.move(src, dst)
    manifest["test_move"] = True


# ---- Execute all injections ----
print("Injecting chaos into codebase...")
swap_functions()
print("  Swapped 3 function pairs")
inject_junk()
print(f"  Injected {len(JUNK_FILES)} junk files")
inject_syntax_errors()
print(f"  Injected {len(manifest['syntax_errors'])} syntax errors")
pollute_config()
print("  Polluted config files")
move_tests()
print("  Moved tests/ → test_archive/")

# Save manifest (for verification only, agent-invisible)
with open(os.path.join(GOLDEN, "injection_manifest.json"), "w") as f:
    json.dump(manifest, f, indent=2)

print("Chaos injection complete!")
