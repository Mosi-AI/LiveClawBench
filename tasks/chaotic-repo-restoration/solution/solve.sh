#!/usr/bin/env bash
set -euo pipefail
echo "Reference solution for chaotic-repo-restoration"
echo "================================================"

cd /workspace/codebase

# 1. Move tests back
echo "=== Restoring test directory ==="
mv test_archive tests

# 2. Fix conftest.py path (already correct after move)

# 3. Remove junk files
echo "=== Removing junk files ==="
rm -f textproc/helpers.py textproc/deprecated.py textproc/experimental_nlp.py
rm -rf utils/
rm -f benchmark.py setup_legacy.py NOTES.md

# 4. Fix __init__.py — remove junk imports
cat > textproc/__init__.py << 'INITEOF'
"""textproc — Text processing utilities library."""

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
INITEOF

# 5. Fix syntax errors
echo "=== Fixing syntax errors ==="

# Fix analysis.py: retrun -> return, txet -> text, ; -> ?
python3 -c "
p = 'textproc/analysis.py'
c = open(p).read()
c = c.replace('retrun', 'return')
c = c.replace('txet', 'text')
c = c.replace('.!;', '.!?')
open(p, 'w').write(c)
"

# Fix formatting.py: extra indent
python3 -c "
p = 'textproc/formatting.py'
c = open(p).read()
c = c.replace('        return', '    return', 1)
open(p, 'w').write(c)
"

# Fix encoding.py: missing return in from_base64
python3 -c "
p = 'textproc/encoding.py'
c = open(p).read()
c = c.replace(
    '    \"\"\"Decode base64 text.\"\"\"\n    base64.b64decode',
    '    \"\"\"Decode base64 text.\"\"\"\n    return base64.b64decode'
)
open(p, 'w').write(c)
"

# Fix transforms.py: text.split( ) -> text.split()
python3 -c "
p = 'textproc/transforms.py'
c = open(p).read()
c = c.replace('text.split( )', 'text.split()')
open(p, 'w').write(c)
"

# 6. Fix swapped functions
echo "=== Fixing swapped function bodies ==="

# Swap 1: Restore to_uppercase and word_count
python3 -c "
p = 'textproc/transforms.py'
c = open(p).read()
c = c.replace(
    '    \"\"\"Convert text to uppercase.\"\"\"\\n    words = text.split()\\n    return len(words)',
    '    \"\"\"Convert text to uppercase.\"\"\"\\n    return text.upper()'
)
open(p, 'w').write(c)
"
python3 -c "
p = 'textproc/analysis.py'
c = open(p).read()
c = c.replace(
    '    \"\"\"Count the number of words in text.\"\"\"\\n    return text.upper()',
    '    \"\"\"Count the number of words in text.\"\"\"\\n    words = text.split()\\n    return len(words)'
)
open(p, 'w').write(c)
"

# Swap 2: Restore reverse_string and rot13
python3 -c "
p = 'textproc/transforms.py'
c = open(p).read()
# Replace the rot13 logic that's in reverse_string
old = '''    \"\"\"Reverse a string.\"\"\"
    result = []
    for char in text:
        if \"a\" <= char <= \"z\":
            result.append(chr((ord(char) - ord(\"a\") + 13) % 26 + ord(\"a\")))
        elif \"A\" <= char <= \"Z\":
            result.append(chr((ord(char) - ord(\"A\") + 13) % 26 + ord(\"A\")))
        else:
            result.append(char)
    return \"\".join(result)'''
new = '    \"\"\"Reverse a string.\"\"\"\\n    return text[::-1]'
c = c.replace(old, new)
open(p, 'w').write(c)
"
python3 -c "
p = 'textproc/encoding.py'
c = open(p).read()
c = c.replace(
    '    \"\"\"Apply ROT13 cipher.\"\"\"\\n    return text[::-1]',
    '''    \"\"\"Apply ROT13 cipher.\"\"\"
    result = []
    for char in text:
        if \"a\" <= char <= \"z\":
            result.append(chr((ord(char) - ord(\"a\") + 13) % 26 + ord(\"a\")))
        elif \"A\" <= char <= \"Z\":
            result.append(chr((ord(char) - ord(\"A\") + 13) % 26 + ord(\"A\")))
        else:
            result.append(char)
    return \"\".join(result)'''
)
open(p, 'w').write(c)
"

# Swap 3: Restore slugify and to_base64
python3 -c "
import re
p = 'textproc/formatting.py'
c = open(p).read()
c = c.replace(
    '    \"\"\"Convert text to URL-friendly slug.\"\"\"\\n    import base64\\n    return base64.b64encode(text.encode(\"utf-8\")).decode(\"utf-8\")',
    '''    \"\"\"Convert text to URL-friendly slug.\"\"\"
    text = text.lower().strip()
    text = re.sub(r\"[^\\\\w\\\\s-]\", \"\", text)
    text = re.sub(r\"[\\\\s_]+\", \"-\", text)
    text = re.sub(r\"-+\", \"-\", text)
    return text.strip(\"-\")'''
)
open(p, 'w').write(c)
"
python3 -c "
p = 'textproc/encoding.py'
c = open(p).read()
c = c.replace(
    '    \"\"\"Encode text to base64.\"\"\"\\n    import re\\n    text = text.lower().strip()',
    '    \"\"\"Encode text to base64.\"\"\"\\n    return base64.b64encode(text.encode(\"utf-8\")).decode(\"utf-8\")\\n\\ndef _unused():\\n    text = \"\"'
)
open(p, 'w').write(c)
# Actually let me rewrite properly
"

# Simpler approach: just rewrite encoding.py fully
cat > textproc/encoding.py << 'ENCEOF'
"""Text encoding/decoding functions."""

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
ENCEOF

# 7. Fix config files
echo "=== Fixing config files ==="

cat > pyproject.toml << 'TOMLEOF'
[build-system]
requires = ["setuptools>=64", "wheel"]
build-backend = "setuptools.build_meta"

[project]
name = "textproc"
version = "1.0.0"
description = "Text processing utilities"
requires-python = ">=3.8"

[tool.pytest.ini_options]
testpaths = ["tests"]
TOMLEOF

cat > requirements.txt << 'REQEOF'
pytest>=7.0
REQEOF

# 8. Run tests
echo "=== Running tests ==="
python3 -m pytest tests/ -v

# 9. Write report
echo "=== Writing restoration report ==="
mkdir -p /workspace/output
cat > /workspace/output/restoration_report.md << 'REPORTEOF'
# Codebase Restoration Report

## Summary
Restored the `textproc` library from a chaotic state to fully working condition.
All 20 tests now pass.

## Issues Found and Fixes

### 1. Test Directory Moved
Tests were moved from `tests/` to `test_archive/`. Moved them back.

### 2. Junk Files Injected
Removed 8 files that don't belong to the original project:
- textproc/helpers.py, textproc/deprecated.py, textproc/experimental_nlp.py
- utils/__init__.py, utils/string_helpers.py
- benchmark.py, setup_legacy.py, NOTES.md

### 3. Junk Imports in __init__.py
Removed imports of helpers and deprecated modules from textproc/__init__.py.

### 4. Swapped Function Bodies (3 pairs)
- `to_uppercase` ↔ `word_count`: uppercase had word counting logic and vice versa
- `reverse_string` ↔ `rot13`: reverse had rot13 cipher and vice versa
- `slugify` ↔ `to_base64`: slugify had base64 encoding and vice versa

### 5. Syntax Errors (6 fixes)
- `retrun` typo in analysis.py → `return`
- `txet` typo in analysis.py → `text`
- Wrong delimiter `;` in sentence_count → `?`
- Extra indentation in formatting.py indent_text
- Missing `return` in encoding.py from_base64
- Extra space in transforms.py `text.split( )` → `text.split()`

### 6. Config File Pollution
- requirements.txt: removed fake-nonexistent-package, six, future
- pyproject.toml: restored correct package name, version, python requires, testpaths
REPORTEOF

echo "Reference solution complete."
