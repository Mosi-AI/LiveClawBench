# vectorops API Specification

## Overview

`vectorops` is a Python library that provides common vector operations for numerical computing.
All functions operate on Python lists of numbers (no NumPy dependency).

## Functions

### 1. `dot_product(a: list[float], b: list[float]) -> float`

Compute the dot product of two vectors.

- **Parameters**: Two lists of equal length
- **Returns**: Scalar dot product (sum of element-wise products)
- **Raises**: `ValueError` if vectors have different lengths
- **Example**:
  ```python
  dot_product([1, 2, 3], [4, 5, 6])  # => 32.0
  dot_product([1, 0], [0, 1])         # => 0.0
  ```

### 2. `cross_product(a: list[float], b: list[float]) -> list[float]`

Compute the cross product of two 3D vectors.

- **Parameters**: Two lists of exactly length 3
- **Returns**: A new list of length 3
- **Raises**: `ValueError` if either vector is not length 3
- **Example**:
  ```python
  cross_product([1, 0, 0], [0, 1, 0])  # => [0, 0, 1]
  cross_product([1, 2, 3], [4, 5, 6])  # => [-3, 6, -3]
  ```

### 3. `magnitude(v: list[float]) -> float`

Compute the Euclidean magnitude (L2 norm) of a vector.

- **Parameters**: A list of numbers
- **Returns**: The magnitude as a float
- **Example**:
  ```python
  magnitude([3, 4])     # => 5.0
  magnitude([1, 0, 0])  # => 1.0
  ```

### 4. `normalize(v: list[float]) -> list[float]`

Return the unit vector (normalized to magnitude 1).

- **Parameters**: A list of numbers (non-zero vector)
- **Returns**: A new list with the same direction, magnitude 1.0
- **Raises**: `ValueError` if vector has zero magnitude
- **Example**:
  ```python
  normalize([3, 4])  # => [0.6, 0.8]
  normalize([0, 5])  # => [0.0, 1.0]
  ```

### 5. `cosine_similarity(a: list[float], b: list[float]) -> float`

Compute the cosine similarity between two vectors.

- **Parameters**: Two lists of equal length (non-zero vectors)
- **Returns**: Float in range [-1.0, 1.0]
- **Raises**: `ValueError` if vectors have different lengths or either is zero
- **Example**:
  ```python
  cosine_similarity([1, 0], [0, 1])  # => 0.0
  cosine_similarity([1, 1], [1, 1])  # => 1.0
  ```

### 6. `vector_add(a: list[float], b: list[float]) -> list[float]`

Element-wise addition of two vectors.

- **Parameters**: Two lists of equal length
- **Returns**: A new list with element-wise sums
- **Raises**: `ValueError` if vectors have different lengths
- **Example**:
  ```python
  vector_add([1, 2, 3], [4, 5, 6])  # => [5, 7, 9]
  ```
