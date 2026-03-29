---
name: text-sentiment-scorer
description: Analyse text files for sentiment polarity (positive/negative/neutral) using keyword-based scoring.
version: 1.0.0
---

# Text Sentiment Scorer

## Skill Summary

Performs keyword-based sentiment analysis on plain text files. Assigns each
sentence a polarity score (-1.0 to +1.0) and computes an overall document
sentiment. Useful for customer feedback analysis, social media monitoring,
and support ticket triage.

## Inputs

| Parameter | Flag   | Required | Description                            |
|-----------|--------|----------|----------------------------------------|
| input     | `-i`   | Yes      | Path to the input text file            |
| output    | `-o`   | Yes      | Path to the output JSON report         |
| language  | `--lang`| No      | Language code (default: `en`)          |

## Computed Metrics

- Per-sentence polarity score (-1.0 to +1.0)
- Overall document sentiment (weighted average)
- Keyword hit counts (positive / negative / neutral)
- Confidence score (0.0 to 1.0)

## Output

```json
{
  "source": "<input_file>",
  "overall_sentiment": 0.35,
  "confidence": 0.72,
  "label": "positive",
  "sentences": [
    {"text": "Great product!", "score": 0.8},
    {"text": "Delivery was slow.", "score": -0.3}
  ]
}
```

## Implementation

```bash
python3 ./skills/text-sentiment-scorer/sentiment_scorer.py -i <input.txt> -o <report.json> \
    [--lang en]
```

## Dependencies

- Python 3.10+ (standard library only)
