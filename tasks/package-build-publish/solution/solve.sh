#!/usr/bin/env bash
set -euo pipefail
echo "Reference solution for package-build-publish"
echo "============================================="

cd /workspace/vectorops

# 1. Implement core.py
cat > vectorops/core.py << 'COREEOF'
"""Core vector operations."""

import math


def dot_product(a: list[float], b: list[float]) -> float:
    """Compute the dot product of two vectors."""
    if len(a) != len(b):
        raise ValueError("Vectors must have equal length")
    return sum(x * y for x, y in zip(a, b))


def cross_product(a: list[float], b: list[float]) -> list[float]:
    """Compute the cross product of two 3D vectors."""
    if len(a) != 3 or len(b) != 3:
        raise ValueError("Both vectors must have length 3")
    return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ]


def magnitude(v: list[float]) -> float:
    """Compute the Euclidean magnitude (L2 norm) of a vector."""
    return math.sqrt(sum(x * x for x in v))


def normalize(v: list[float]) -> list[float]:
    """Return the unit vector (normalized to magnitude 1)."""
    mag = magnitude(v)
    if mag == 0:
        raise ValueError("Cannot normalize zero vector")
    return [x / mag for x in v]


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Compute cosine similarity between two vectors."""
    if len(a) != len(b):
        raise ValueError("Vectors must have equal length")
    mag_a = magnitude(a)
    mag_b = magnitude(b)
    if mag_a == 0 or mag_b == 0:
        raise ValueError("Cannot compute cosine similarity with zero vector")
    return dot_product(a, b) / (mag_a * mag_b)


def vector_add(a: list[float], b: list[float]) -> list[float]:
    """Element-wise addition of two vectors."""
    if len(a) != len(b):
        raise ValueError("Vectors must have equal length")
    return [x + y for x, y in zip(a, b)]
COREEOF

# 2. Write tests
cat > tests/test_core.py << 'TESTEOF'
"""Tests for vectorops core functions."""
import math
import pytest
from vectorops.core import (
    dot_product, cross_product, magnitude,
    normalize, cosine_similarity, vector_add,
)


class TestDotProduct:
    def test_basic(self):
        assert dot_product([1, 2, 3], [4, 5, 6]) == 32.0

    def test_orthogonal(self):
        assert dot_product([1, 0], [0, 1]) == 0.0

    def test_different_length(self):
        with pytest.raises(ValueError):
            dot_product([1, 2], [1, 2, 3])


class TestCrossProduct:
    def test_unit_vectors(self):
        assert cross_product([1, 0, 0], [0, 1, 0]) == [0, 0, 1]

    def test_general(self):
        assert cross_product([1, 2, 3], [4, 5, 6]) == [-3, 6, -3]

    def test_not_3d(self):
        with pytest.raises(ValueError):
            cross_product([1, 2], [3, 4])


class TestMagnitude:
    def test_345(self):
        assert magnitude([3, 4]) == 5.0

    def test_unit(self):
        assert magnitude([1, 0, 0]) == 1.0

    def test_zero(self):
        assert magnitude([0, 0]) == 0.0


class TestNormalize:
    def test_basic(self):
        n = normalize([3, 4])
        assert abs(n[0] - 0.6) < 1e-9
        assert abs(n[1] - 0.8) < 1e-9

    def test_unit_stays(self):
        n = normalize([0, 1])
        assert abs(n[0]) < 1e-9
        assert abs(n[1] - 1.0) < 1e-9

    def test_zero_raises(self):
        with pytest.raises(ValueError):
            normalize([0, 0])


class TestCosineSimilarity:
    def test_orthogonal(self):
        assert abs(cosine_similarity([1, 0], [0, 1])) < 1e-9

    def test_identical(self):
        assert abs(cosine_similarity([1, 1], [1, 1]) - 1.0) < 1e-9

    def test_opposite(self):
        assert abs(cosine_similarity([1, 0], [-1, 0]) + 1.0) < 1e-9

    def test_zero_raises(self):
        with pytest.raises(ValueError):
            cosine_similarity([0, 0], [1, 1])


class TestVectorAdd:
    def test_basic(self):
        assert vector_add([1, 2, 3], [4, 5, 6]) == [5, 7, 9]

    def test_different_length(self):
        with pytest.raises(ValueError):
            vector_add([1], [1, 2])
TESTEOF

# 3. Run tests
python3 -m pytest tests/ -v

# 4. Build wheel
python3 -m build

# 5. Start PyPI server
mkdir -p /workspace/pypi-server/packages
bash /workspace/pypi-server/start.sh &
sleep 2

# 6. Upload to PyPI
twine upload --repository-url http://localhost:8080/ dist/*.whl --skip-existing

# 7. Verify installation
python3 -m venv /tmp/verify_venv
/tmp/verify_venv/bin/pip install --index-url http://localhost:8080/simple/ --trusted-host localhost vectorops
/tmp/verify_venv/bin/python -c "from vectorops import dot_product; print(dot_product([1,2],[3,4]))"

echo "Reference solution complete."
