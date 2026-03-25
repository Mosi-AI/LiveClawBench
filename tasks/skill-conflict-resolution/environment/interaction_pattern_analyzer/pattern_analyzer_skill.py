#!/usr/bin/env python3
"""
Interaction Pattern Analyzer Skill
===================================
Analyzes user interaction history to discover repeating temporal and content
patterns. Outputs a pattern report with confidence scores and suggestions
for automation.

Usage:
  python3 pattern_analyzer_skill.py -i <history.json> [-o <output_dir>]
"""

from __future__ import annotations

import argparse
import json
import re
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Dict, List, Set, Tuple

import skill_tracer

SKILL_METADATA = {
    "name": "interaction-pattern-analyzer",
    "version": "0.1.0",
    "description": "Analyzes interaction history to discover repeating patterns and suggest automation.",
}

# Simple English stopwords for keyword extraction
STOPWORDS = {
    "i",
    "me",
    "my",
    "we",
    "our",
    "you",
    "your",
    "he",
    "she",
    "it",
    "they",
    "this",
    "that",
    "these",
    "those",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "being",
    "have",
    "has",
    "had",
    "do",
    "does",
    "did",
    "will",
    "would",
    "could",
    "should",
    "may",
    "might",
    "shall",
    "can",
    "a",
    "an",
    "the",
    "and",
    "but",
    "or",
    "nor",
    "not",
    "so",
    "if",
    "then",
    "than",
    "too",
    "very",
    "just",
    "about",
    "above",
    "after",
    "again",
    "all",
    "also",
    "am",
    "any",
    "as",
    "at",
    "back",
    "because",
    "before",
    "between",
    "both",
    "by",
    "down",
    "each",
    "few",
    "for",
    "from",
    "get",
    "go",
    "here",
    "her",
    "him",
    "his",
    "how",
    "in",
    "into",
    "its",
    "let",
    "like",
    "make",
    "more",
    "most",
    "much",
    "need",
    "no",
    "of",
    "off",
    "on",
    "one",
    "only",
    "other",
    "out",
    "over",
    "own",
    "same",
    "some",
    "still",
    "such",
    "take",
    "tell",
    "to",
    "two",
    "up",
    "us",
    "use",
    "want",
    "what",
    "when",
    "where",
    "which",
    "while",
    "who",
    "why",
    "with",
    "help",
    "please",
    "can",
    "check",
    "look",
    "find",
    "see",
    "new",
    "me",
    "there",
    "them",
}

# Minimum occurrences to consider a (weekday, hour) slot as a spike
MIN_SPIKE_COUNT = 4

# Minimum keyword overlap ratio to cluster messages
MIN_KEYWORD_OVERLAP = 0.3


def stem_word(word: str) -> str:
    """Very simple stemming: strip common suffixes."""
    for suffix in ("ing", "tion", "ly", "ed", "es", "s"):
        if word.endswith(suffix) and len(word) - len(suffix) >= 3:
            return word[: -len(suffix)]
    return word


def extract_keywords(text: str) -> Set[str]:
    """Extract meaningful keywords from a message (with basic stemming)."""
    words = re.findall(r"[a-zA-Z]+", text.lower())
    stemmed = set()
    for w in words:
        if w not in STOPWORDS and len(w) > 2:
            stemmed.add(stem_word(w))
    return stemmed


def parse_timestamp(ts_str: str) -> Tuple[str, int]:
    """Extract weekday name and hour from ISO timestamp string."""
    # Parse "2025-11-24T09:15:32+08:00"
    # We only need the date part and hour
    date_part = ts_str[:10]  # "2025-11-24"
    hour = int(ts_str[11:13])
    # Get weekday from the record itself (it's included)
    return date_part, hour


def analyze_patterns(records: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Analyze interaction records for repeating patterns.

    Strategy:
      1. Build (weekday, hour) frequency heatmap
      2. Identify spikes (count >= MIN_SPIKE_COUNT)
      3. For each spike, cluster messages by keyword overlap
      4. Report clusters with high overlap as patterns
    """
    # Group records by (weekday, hour)
    slot_records: Dict[Tuple[str, int], List[Dict]] = defaultdict(list)
    for rec in records:
        weekday = rec.get("weekday", "")
        _, hour = parse_timestamp(rec["timestamp"])
        slot_records[(weekday, hour)].append(rec)

    # Find spikes
    spikes = {
        slot: recs
        for slot, recs in slot_records.items()
        if len(recs) >= MIN_SPIKE_COUNT
    }

    patterns = []
    pattern_id = 1

    for (weekday, hour), spike_recs in sorted(spikes.items()):
        # Extract keywords for each message in this slot
        msg_keywords = []
        for rec in spike_recs:
            kws = extract_keywords(rec["user_message"])
            msg_keywords.append((rec, kws))

        # Try to find a cluster: messages sharing significant keyword overlap
        # Use the first message's keywords as seed, then expand
        if not msg_keywords:
            continue

        # Find the most common keywords across all messages in this slot
        all_kw_counts = Counter()
        for _, kws in msg_keywords:
            all_kw_counts.update(kws)

        # Core keywords: appear in at least MIN_SPIKE_COUNT messages
        # (not half, because a spike slot may contain mixed topics)
        threshold = MIN_SPIKE_COUNT
        core_keywords = {kw for kw, cnt in all_kw_counts.items() if cnt >= threshold}

        if len(core_keywords) < 2:
            continue

        # Find messages that match the core keywords
        matching_msgs = []
        for rec, kws in msg_keywords:
            overlap = len(kws & core_keywords) / max(len(core_keywords), 1)
            if overlap >= MIN_KEYWORD_OVERLAP:
                matching_msgs.append(rec)

        if len(matching_msgs) < MIN_SPIKE_COUNT:
            continue

        # Determine time window
        hours_seen = set()
        minutes_seen = []
        for rec in matching_msgs:
            h = int(rec["timestamp"][11:13])
            m = int(rec["timestamp"][14:16])
            hours_seen.add(h)
            minutes_seen.append(h * 60 + m)

        min_time = min(minutes_seen)
        max_time = max(minutes_seen)
        time_window = f"{min_time // 60:02d}:{min_time % 60:02d}-{max_time // 60:02d}:{max_time % 60:02d}"

        # Generate suggested skill name from core keywords
        name_parts = sorted(
            core_keywords - {"related", "latest", "recent", "week", "past"}
        )[:3]
        suggested_name = (
            "weekly_" + "_".join(name_parts)
            if name_parts
            else f"weekly_task_{pattern_id}"
        )

        pattern = {
            "pattern_id": f"PAT-{pattern_id:03d}",
            "recurrence": "weekly",
            "day_of_week": weekday,
            "time_window": time_window,
            "frequency": len(matching_msgs),
            "confidence": round(len(matching_msgs) / len(spike_recs), 2),
            "core_keywords": sorted(core_keywords),
            "representative_messages": [r["user_message"] for r in matching_msgs[:3]],
            "suggested_skill_name": suggested_name,
            "suggested_description": (
                f"Automatically handle recurring {weekday} morning task: "
                f"{', '.join(sorted(core_keywords)[:3])}"
            ),
        }
        patterns.append(pattern)
        pattern_id += 1

    # Build analysis metadata
    dates = [rec["timestamp"][:10] for rec in records]
    result = {
        "skill": {
            "name": SKILL_METADATA["name"],
            "version": SKILL_METADATA["version"],
        },
        "analysis_period": {
            "start": min(dates) if dates else "",
            "end": max(dates) if dates else "",
            "total_records": len(records),
            "total_days": len(set(dates)),
        },
        "patterns": patterns,
        "total_patterns_found": len(patterns),
    }

    return result


def run(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Main entry point for the skill."""
    nonce = skill_tracer.log_invocation(
        skill_file=__file__,
        version=SKILL_METADATA["version"],
        payload=payload,
    )

    history_file = Path(payload["history_file"])
    output_dir = Path(payload.get("output_dir", "."))
    output_dir.mkdir(parents=True, exist_ok=True)

    # Load history
    with open(history_file, "r", encoding="utf-8") as f:
        records = json.load(f)

    # Analyze
    result = analyze_patterns(records)

    # Write report
    report_path = output_dir / "pattern_report.json"
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    # Wrap with trace
    result = skill_tracer.wrap_skill_output(
        result=result,
        nonce=nonce,
        skill_file=__file__,
        version=SKILL_METADATA["version"],
    )

    return result


def main():
    parser = argparse.ArgumentParser(
        description="Analyze interaction history for repeating patterns"
    )
    parser.add_argument(
        "-i",
        "--input",
        required=True,
        help="Path to history.json",
    )
    parser.add_argument(
        "-o",
        "--output-dir",
        default=".",
        help="Directory to write pattern_report.json",
    )
    args = parser.parse_args()

    payload = {
        "history_file": args.input,
        "output_dir": args.output_dir,
    }

    result = run(payload)

    print(json.dumps(result, indent=2, ensure_ascii=False))
    print(f"\nPattern report saved to: {Path(args.output_dir) / 'pattern_report.json'}")


if __name__ == "__main__":
    main()
