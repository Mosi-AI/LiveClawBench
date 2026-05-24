def token_f1(expected: str, actual: str) -> float:
    """Compute token-level F1 between two strings."""
    expected_tokens = set(expected.lower().split())
    actual_tokens = set(actual.lower().split())
    if not expected_tokens or not actual_tokens:
        return 0.0
    matched = expected_tokens & actual_tokens
    precision = len(matched) / len(actual_tokens)
    recall = len(matched) / len(expected_tokens)
    if precision + recall == 0:
        return 0.0
    return 2 * precision * recall / (precision + recall)
