#!/usr/bin/env python3
"""Regenerate rubrics for the 10 original deep-research tasks using the
DeepResearch Bench criteria-generation pipeline.

Usage:
    cd /Users/xumufan/Github/lcb-dr/LiveClawBench
    OPENAI_BASE_URL=https://www.dmxapi.cn/v1 \
    OPENAI_API_KEY=$(grep '^API_KEY=' .env | cut -d= -f2) \
    RACE_MODEL=gpt-5.4 \
    LLM_BACKEND=openai \
    python3 scripts/regenerate_rubrics.py
"""

import json
import os
import re
import sys
import time
from pathlib import Path

import requests

TASKS_DIR = Path("tasks")

TASKS = [
    "crispr-off-target-mitigation",
    "autonomous-weapons-ethics",
    "cross-border-data-privacy-comparison",
    "defi-systemic-risk-contagion",
    "formal-verification-vs-fuzzing",
    "mrna-cancer-vaccines-landscape",
    "digital-religion-ai-vr",
    "fusion-energy-commercial-viability",
    "ai-copyright-international-jurisprudence",
    "long-covid-neurological-hypotheses",
]

# ── Config ─────────────────────────────────────────────────────────
RETRY_ATTEMPTS = 5
RETRY_DELAY = 5
DEFAULT_SAMPLE_COUNT = 1
MAX_OUTPUT_TOKENS = 64000
HTTP_TIMEOUT_S = 600


# ── AI Client ──────────────────────────────────────────────────────
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


# ── JSON Parser ────────────────────────────────────────────────────
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
    if isinstance(data, dict):
        if not data:
            return False
        total_weight = sum(float(value) for value in data.values())
        return abs(total_weight - expected_sum) < tolerance
    elif isinstance(data, list):
        if not data or not all(
            isinstance(item, dict) and "weight" in item for item in data
        ):
            return False
        total_weight = sum(float(item["weight"]) for item in data)
        return abs(total_weight - expected_sum) < tolerance
    return False


def round_weights_and_adjust(weights, decimal_places=2):
    rounded_weights = {
        dim: round(float(weight), decimal_places) for dim, weight in weights.items()
    }
    total = sum(rounded_weights.values())
    diff = 1.0 - total
    if abs(diff) > 1e-10:
        # Add diff to the last key alphabetically to ensure determinism
        last_key = sorted(rounded_weights.keys())[-1]
        rounded_weights[last_key] = round(
            rounded_weights[last_key] + diff, decimal_places
        )
    return rounded_weights


# ── Prompts (from criteria_prompt_en.py) ───────────────────────────
_EN_WEIGHT_PROMPT = """
<system_role>
You are an experienced research article evaluation expert. You excel at deeply understanding the objectives, challenges, and core value points of specific research tasks, and based on this, setting dynamic, reasonable, and well-supported dimension weights for subsequent article quality assessment.
</system_role>

<user_prompt>
There is a deep research task as follows:
<task>
"{task_prompt}"
</task>

<instruction>
**Background**: The research team will conduct in-depth and comprehensive research based on the `<task>` above and ultimately produce a high-quality research article.
**Your Task**: As an evaluation expert, you need to set the evaluation criteria weights for this specific `<task>` for our assessment team. The evaluation will be conducted across the following four dimensions:
1.  **Comprehensiveness:** The breadth, depth, and relevance of information coverage.
2.  **Insight:** The depth, originality, logic, and value of the analysis and conclusions.
3.  **Instruction Following:** Whether the report accurately and completely responds to all requirements and constraints of the task.
4.  **Readability:** Clarity of structure, fluency of language, effectiveness of data presentation, and overall ease of understanding.

**Evaluation Formula**: Total Score = Comprehensiveness * Comprehensiveness Weight + Insight * Insight Weight + Instruction Following * Instruction Following Weight + Readability * Readability Weight. (**Note: The sum of all weights must be exactly 1.0**)

**Core Requirements**:
1.  **In-depth Task Analysis**: Carefully study the specific content of the `<task>`, its implicit goals, potential difficulties, and the core value of its outcomes.
2.  **Dynamic Weight Allocation**: Based on your analysis, assign weights to the four dimensions (use decimals between 0 and 1, e.g., 0.3). **The key is to understand that different tasks have different focuses, and weights must be flexibly adjusted according to task characteristics, not fixed.**
3.  **Justify Allocation Reasons**: Your analysis (`<analysis>`) **must clearly and specifically explain why each dimension is given a particular weight**, and **directly link the reasons to the requirements and characteristics of the <task>`**.
4.  **Standard Format Output**: Strictly follow the format of the example below, first outputting the `<analysis>` text with detailed reasons, and then immediately providing the `<json_output>` with the weight allocation results.

</instruction>

Please output your `<analysis>` and `<json_output>`.
</user_prompt>
"""

_EN_COMP_PROMPT = """
<system_role>
You are an experienced research article evaluation expert. You excel at breaking down abstract evaluation dimensions (like "Comprehensiveness") into actionable, clear, and task-specific criteria, assigning appropriate weights and justifications for each.
</system_role>

<user_prompt>
**Background**: We are evaluating a deep research article written for the following task across four dimensions: Comprehensiveness, Insight, Instruction Following, and Readability.

<task>
"{task_prompt}"
</task>

<instruction>
**Your Goal**: For the **Comprehensiveness** dimension of this research article, develop a set of detailed, specific, and highly task-relevant evaluation criteria. You need to:
1.  **Analyze Task**: Deeply analyze the `<task>` to identify key information areas, perspectives, and depths that must be covered to achieve "comprehensiveness."
2.  **Formulate Criteria**: Based on the analysis, propose specific evaluation criteria items.
3.  **Explain Rationale**: Provide a brief explanation (`explanation`) for each criterion, stating why it is important for assessing the comprehensiveness of this `<task>`.
4.  **Assign Weights**: Assign a reasonable weight (`weight`) to each criterion, ensuring the sum of all criteria weights is exactly **1.0**.
5.  **Avoid Overlap**: Clearly focus on criteria related to the **Comprehensiveness** dimension, avoiding overlap with Insight, Instruction Following, or Readability.

**Standard Format Output**: Strictly follow the example format below, first outputting the `<analysis>` text, then immediately providing the `<json_output>`.
</instruction>

Please output your `<analysis>` and `<json_output>`.
</user_prompt>
"""

_EN_INSIGHT_PROMPT = """
<system_role>
You are an experienced research article evaluation expert. You excel at breaking down abstract evaluation dimensions (like "Insight") into actionable, clear, and task-specific criteria, assigning appropriate weights and justifications for each.
</system_role>

<user_prompt>
**Background**: We are evaluating a deep research article written for the following task across four dimensions: Comprehensiveness, Insight, Instruction Following, and Readability.

<task>
"{task_prompt}"
</task>

<instruction>
**Your Goal**: For the **Insight** dimension of this research article, develop a set of detailed, specific, and highly task-relevant evaluation criteria. You need to:
1.  **Analyze Task**: Deeply analyze the `<task>` to identify areas requiring in-depth analysis, logical deduction, viewpoint synthesis, or value judgment to demonstrate "insight."
2.  **Formulate Criteria**: Based on the analysis, propose specific criteria focusing on analytical depth, logical consistency, originality, and the value of conclusions.
3.  **Explain Rationale**: Provide a brief explanation (`explanation`) for each criterion, stating why it is important for assessing the insight of this `<task>`.
4.  **Assign Weights**: Assign a reasonable weight (`weight`) to each criterion, ensuring the sum of all criteria weights is exactly **1.0**.
5.  **Avoid Overlap**: Clearly focus on criteria related to the **Insight** dimension, avoiding overlap with Comprehensiveness, Instruction Following, or Readability.

**Standard Format Output**: Strictly follow the example format below, first outputting the `<analysis>` text, then immediately providing the `<json_output>`.
</instruction>

Please output your `<analysis>` and `<json_output>`.
</user_prompt>
"""

_EN_INST_PROMPT = """
<system_role>
You are an experienced research article evaluation expert. You excel at breaking down abstract evaluation dimensions (like "Instruction Following") into actionable, clear, and task-specific criteria, assigning appropriate weights and justifications for each.
</system_role>

<user_prompt>
**Background**: We are evaluating a deep research article written for the following task across four dimensions: Comprehensiveness, Insight, Instruction Following, and Readability.

<task>
"{task_prompt}"
</task>

<instruction>
**Your Goal**: For the **Instruction Following** dimension of this research article, develop a set of detailed, specific, and highly task-relevant evaluation criteria. You need to:
1.  **Analyze Task**: Deeply analyze the specific instructions, questions, scope limitations, and core objectives within the `<task>`.
2.  **Formulate Criteria**: Based on the analysis, propose specific criteria focusing on whether the article accurately, completely, and directly responds to all task instructions.
3.  **Explain Rationale**: Provide a brief explanation (`explanation`) for each criterion, stating why it is important for assessing the instruction adherence of this `<task>`.
4.  **Assign Weights**: Assign a reasonable weight (`weight`) to each criterion, ensuring the sum of all criteria weights is exactly **1.0**.
5.  **Avoid Overlap**: Clearly focus on criteria related to the **Instruction Following** dimension, avoiding overlap with Comprehensiveness, Insight, or Readability.

**Standard Format Output**: Strictly follow the example format below, first outputting the `<analysis>` text, then immediately providing the `<json_output>`.
</instruction>

Please output your `<analysis>` and `<json_output>`.
</user_prompt>
"""

_EN_READABILITY_PROMPT = """
<system_role>
You are an experienced research article evaluation expert. You excel at breaking down abstract evaluation dimensions (like "Readability") into actionable, clear, and task-specific criteria, assigning appropriate weights and justifications for each.
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

**Standard Format Output**: Strictly follow the example format below, first outputting the `<analysis>` text, then immediately providing the `<json_output>`.
</instruction>

Please output your `<analysis>` and `<json_output>`.
</user_prompt>
"""


def get_prompts():
    return {
        "weight_prompt": _EN_WEIGHT_PROMPT,
        "criteria_prompts": {
            "comprehensiveness": _EN_COMP_PROMPT,
            "insight": _EN_INSIGHT_PROMPT,
            "instruction_following": _EN_INST_PROMPT,
            "readability": _EN_READABILITY_PROMPT,
        },
    }


# ── Generation logic ───────────────────────────────────────────────
def generate_weights_for_task(
    ai_client: AIClient, prompt: str, sample_count: int = DEFAULT_SAMPLE_COUNT
) -> dict | None:
    prompts = get_prompts()
    weight_prompt_template = prompts["weight_prompt"]
    user_prompt = weight_prompt_template.format(task_prompt=prompt)

    weights_samples = []
    for _ in range(sample_count):
        for attempt in range(RETRY_ATTEMPTS):
            try:
                weights_output = ai_client.generate(
                    user_prompt=user_prompt, system_prompt=""
                )
                parsed_weights = parse_llm_output_as_json(
                    weights_output, expected_type=dict
                )
                if parsed_weights and validate_weights(parsed_weights):
                    weights_samples.append(parsed_weights)
                    break
            except Exception as exc:
                print(f"    weight attempt {attempt + 1} failed: {exc}")
                if attempt == RETRY_ATTEMPTS - 1:
                    raise
            if attempt < RETRY_ATTEMPTS - 1:
                time.sleep(RETRY_DELAY)

    if not weights_samples:
        return None

    dimensions = set()
    for sample in weights_samples:
        dimensions.update(sample.keys())

    avg_weights = {}
    for dim in dimensions:
        values = [sample.get(dim, 0) for sample in weights_samples if dim in sample]
        if len(values) == len(weights_samples):
            avg_weights[dim] = sum(values) / len(values)

    weight_sum = sum(avg_weights.values())
    for dim in avg_weights:
        avg_weights[dim] = avg_weights[dim] / weight_sum

    return round_weights_and_adjust(avg_weights, decimal_places=2)


def generate_criteria_for_task(ai_client: AIClient, prompt: str) -> dict:
    prompts = get_prompts()
    criteria_prompts = prompts["criteria_prompts"]
    current_criterions = {}

    for dim_name, criteria_prompt_template in criteria_prompts.items():
        user_prompt_criteria = criteria_prompt_template.format(task_prompt=prompt)
        for attempt in range(RETRY_ATTEMPTS):
            try:
                criteria_output = ai_client.generate(
                    user_prompt=user_prompt_criteria, system_prompt=""
                )
                parsed_criteria = parse_llm_output_as_json(
                    criteria_output, expected_type=list
                )
                if parsed_criteria and validate_weights(parsed_criteria):
                    cleaned = []
                    for c in parsed_criteria:
                        cleaned.append(
                            {
                                "criterion": c.get("criterion", ""),
                                "weight": c.get("weight", 0.0),
                            }
                        )
                    current_criterions[dim_name] = cleaned
                    break
            except Exception as exc:
                print(f"    {dim_name} attempt {attempt + 1} failed: {exc}")
                if attempt == RETRY_ATTEMPTS - 1:
                    raise
            if attempt < RETRY_ATTEMPTS - 1:
                time.sleep(RETRY_DELAY)

    return current_criterions


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

    print("Using backend: openai")
    print(f"Base URL: {base_url}")
    print(f"Model: {model}")
    print(f"Tasks to process: {len(TASKS)}")
    print()

    ai_client = AIClient(api_key=api_key, model=model, base_url=base_url)

    for task in TASKS:
        print(f"Processing {task} ...")
        prompt = read_instruction(task)

        # Phase 1: weights
        weights = generate_weights_for_task(ai_client, prompt)
        if weights is None:
            print(f"  FAILED to generate weights for {task}")
            continue
        print(f"  weights: {weights}")

        # Phase 2: criteria
        criterions = generate_criteria_for_task(ai_client, prompt)
        print(f"  criteria dims: {list(criterions.keys())}")

        # Build final rubric in LiveClawBench format
        rubric = {
            "dimension_weights": weights,
            "criteria": criterions,
        }

        # Write back
        rubric_path = TASKS_DIR / task / "tests" / "rubric.json"
        rubric_path.write_text(
            json.dumps(rubric, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        print(f"  written -> {rubric_path}")
        print()

    print("All done.")


if __name__ == "__main__":
    main()
