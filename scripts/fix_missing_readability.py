#!/usr/bin/env python3
"""Generate missing readability criteria for 3 tasks."""

import json
import os
import re
import sys
import time
from pathlib import Path

import requests

TASKS_DIR = Path("tasks")

MISSING_TASKS = [
    "autonomous-weapons-ethics",
    "formal-verification-vs-fuzzing",
    "long-covid-neurological-hypotheses",
]

RETRY_ATTEMPTS = 5
RETRY_DELAY = 5
MAX_OUTPUT_TOKENS = 64000
HTTP_TIMEOUT_S = 600


class AIClient:
    def __init__(self, api_key: str, model: str, base_url: str):
        self.api_key = api_key
        self.model = model
        self.base_url = base_url.rstrip("/")

    def _headers(self):
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def generate(self, user_prompt: str, system_prompt: str = "") -> str:
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": user_prompt})

        payload = {
            "model": self.model,
            "messages": messages,
            "max_completion_tokens": MAX_OUTPUT_TOKENS,
            "temperature": 0,
        }

        url = f"{self.base_url}/chat/completions"
        resp = requests.post(
            url, headers=self._headers(), json=payload, timeout=HTTP_TIMEOUT_S
        )
        if resp.status_code != 200:
            raise Exception(f"API {resp.status_code}: {resp.text[:500]}")

        data = resp.json()
        content = data["choices"][0]["message"].get("content", "")
        return content


def parse_llm_output_as_json(text: str, expected_type: type = list):
    match = re.search(
        r"<json_output>(.*?)</json_output>", text, re.DOTALL | re.IGNORECASE
    )
    if match:
        json_str = match.group(1).strip()
    else:
        json_str = text.strip()
        if json_str.startswith("```json"):
            json_str = json_str[7:]
        if json_str.startswith("```"):
            json_str = json_str[3:]
        if json_str.endswith("```"):
            json_str = json_str[:-3]
        json_str = json_str.strip()

    parsed_data = json.loads(json_str)
    if not isinstance(parsed_data, expected_type) or (
        isinstance(parsed_data, (list, dict)) and not parsed_data
    ):
        return None
    return parsed_data


def validate_weights(data, expected_sum=1.0, tolerance=1e-6):
    if isinstance(data, list):
        if not data or not all(
            isinstance(item, dict) and "weight" in item for item in data
        ):
            return False
        total_weight = sum(float(item["weight"]) for item in data)
        return abs(total_weight - expected_sum) < tolerance
    return False


_PROMPT = """
<system_role>
You are an experienced research article evaluation expert.
</system_role>

<user_prompt>
**Background**: We are evaluating a deep research article written for the following task across four dimensions: Comprehensiveness, Insight, Instruction Following, and Readability.

<task>
"{task_prompt}"
</task>

<instruction>
**Your Goal**: For the **Readability** dimension of this research article, develop a set of detailed, specific, and relatively general evaluation criteria, while also considering the characteristics of the `<task>`. You need to:
1.  **Analyze Readability Elements**: Identify key elements that constitute the readability of a high-quality research report.
2.  **Formulate Criteria**: Based on the analysis, propose specific criteria covering language clarity, content structure, information presentation, formatting, and audience adaptation.
3.  **Explain Rationale**: Provide a brief explanation (`explanation`) for each criterion, stating why it is important for enhancing report readability.
4.  **Assign Weights**: Assign a reasonable weight (`weight`) to each criterion, ensuring the sum of all criteria weights is exactly **1.0**.
5.  **Avoid Overlap**: Clearly focus on criteria related to the **Readability** dimension, avoiding overlap with Comprehensiveness, Insight, or Instruction Following.

**Standard Format Output**: First output `<analysis>` text, then immediately provide `<json_output>`.
</instruction>

Please output your `<analysis>` and `<json_output>`.
</user_prompt>
"""


def generate_readability(ai_client: AIClient, prompt: str) -> list:
    user_prompt = _PROMPT.format(task_prompt=prompt)
    for attempt in range(RETRY_ATTEMPTS):
        try:
            output = ai_client.generate(user_prompt=user_prompt, system_prompt="")
            parsed = parse_llm_output_as_json(output, expected_type=list)
            if parsed and validate_weights(parsed):
                cleaned = []
                for c in parsed:
                    cleaned.append(
                        {
                            "criterion": c.get("criterion", ""),
                            "weight": c.get("weight", 0.0),
                        }
                    )
                return cleaned
        except Exception as exc:
            print(f"    attempt {attempt + 1} failed: {exc}")
            if attempt == RETRY_ATTEMPTS - 1:
                raise
        if attempt < RETRY_ATTEMPTS - 1:
            time.sleep(RETRY_DELAY)
    return []


def read_instruction(task_name: str) -> str:
    path = TASKS_DIR / task_name / "instruction.md"
    return path.read_text(encoding="utf-8").strip()


def main():
    api_key = os.environ.get("OPENAI_API_KEY", "")
    base_url = os.environ.get("OPENAI_BASE_URL", "")
    model = os.environ.get("RACE_MODEL", "gpt-5.4")

    if not api_key:
        print("ERROR: OPENAI_API_KEY not set")
        sys.exit(1)

    ai_client = AIClient(api_key=api_key, model=model, base_url=base_url)

    for task in MISSING_TASKS:
        print(f"Processing {task} ...")
        prompt = read_instruction(task)
        criteria = generate_readability(ai_client, prompt)
        print(f"  generated {len(criteria)} readability criteria")

        rubric_path = TASKS_DIR / task / "tests" / "rubric.json"
        data = json.loads(rubric_path.read_text())
        data["criteria"]["readability"] = criteria
        rubric_path.write_text(
            json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        print(f"  written -> {rubric_path}")

    print("All done.")


if __name__ == "__main__":
    main()
