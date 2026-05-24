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


def hashtag_set_f1(expected_hashtags: list[str], text: str) -> float:
    """Extract hashtags from text and compute set F1 against expected hashtags."""
    import re

    found = set(re.findall(r"#\w+", text.lower()))
    expected = set(h.lower() for h in expected_hashtags)
    if not expected or not found:
        return 0.0
    matched = expected & found
    if matched == expected:
        precision = 1.0
    else:
        precision = len(matched) / len(found) if found else 0.0
    recall = len(matched) / len(expected)
    if precision + recall == 0:
        return 0.0
    return 2 * precision * recall / (precision + recall)
