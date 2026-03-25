#!/usr/bin/env python3
"""
text-sentiment-scorer skill — Keyword-based sentiment analysis on text files.
(This is a distractor skill for the skill-combination benchmark case.)
"""

import argparse
import json
import re
import sys
from pathlib import Path

POSITIVE_WORDS = {
    "good",
    "great",
    "excellent",
    "wonderful",
    "fantastic",
    "amazing",
    "love",
    "happy",
    "pleased",
    "impressive",
    "outstanding",
    "perfect",
    "brilliant",
    "superb",
    "delighted",
    "awesome",
    "best",
    "fast",
    "reliable",
    "efficient",
    "smooth",
    "easy",
    "helpful",
}

NEGATIVE_WORDS = {
    "bad",
    "terrible",
    "horrible",
    "awful",
    "poor",
    "worst",
    "hate",
    "angry",
    "disappointed",
    "frustrating",
    "broken",
    "slow",
    "unreliable",
    "difficult",
    "confusing",
    "error",
    "fail",
    "crash",
    "bug",
    "issue",
    "problem",
    "complaint",
    "unusable",
    "annoying",
}


def score_sentence(sentence: str) -> float:
    words = set(re.findall(r"\b\w+\b", sentence.lower()))
    pos = len(words & POSITIVE_WORDS)
    neg = len(words & NEGATIVE_WORDS)
    total = pos + neg
    if total == 0:
        return 0.0
    return round((pos - neg) / total, 2)


def main():
    parser = argparse.ArgumentParser(description="Keyword-based sentiment analysis")
    parser.add_argument("-i", "--input", required=True, help="Input text file")
    parser.add_argument("-o", "--output", required=True, help="Output JSON report")
    parser.add_argument("--lang", default="en", help="Language code")
    args = parser.parse_args()

    input_path = Path(args.input)
    if not input_path.exists():
        print(f"Error: input file not found: {args.input}", file=sys.stderr)
        sys.exit(1)

    text = input_path.read_text(encoding="utf-8")
    sentences = [s.strip() for s in re.split(r"[.!?]+", text) if s.strip()]

    scored = []
    for s in sentences:
        scored.append({"text": s, "score": score_sentence(s)})

    scores = [s["score"] for s in scored]
    overall = round(sum(scores) / len(scores), 2) if scores else 0.0
    confidence = round(
        min(1.0, len([s for s in scores if s != 0]) / max(len(scores), 1)), 2
    )

    label = (
        "positive" if overall > 0.1 else ("negative" if overall < -0.1 else "neutral")
    )

    report = {
        "source": str(input_path),
        "overall_sentiment": overall,
        "confidence": confidence,
        "label": label,
        "sentences": scored,
    }

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    print(f"Sentiment analysis complete: {label} ({overall})")


if __name__ == "__main__":
    main()
