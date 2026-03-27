#!/usr/bin/env python3
"""
Verification script for vue-crm build error task.
Scores based on:
1. Openclaw agent log file (browser automation traces)
2. Answer file (extracted data from the CRM dashboard)
"""

import json
import os
from pathlib import Path


def score_parse_log_file(log_file_path: str) -> dict:
    """
    Parse the openclaw agent log file and score based on browser automation traces.

    Scoring criteria:
    Point 1: Read README.md, add 1 point
    Point 2: Successfully started server at http://localhost:xxxx/, add 1 point

    Total: 2 points

    Returns:
        {
            'total': int,
            'details': [
                {
                    'item': str,
                    'description': str,
                    'score': int,
                    'matched': bool,
                    'max_score': int
                }
            ]
        }
    """
    details = []

    # Read log file content
    if not Path(log_file_path).exists():
        return {
            "total": 0,
            "details": [
                {
                    "item": "log_file_exists",
                    "description": "Log file exists",
                    "score": 0,
                    "matched": False,
                }
            ],
        }

    log_entries = []
    try:
        with open(log_file_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        log_entries.append(json.loads(line))
                    except json.JSONDecodeError:
                        continue
    except IOError as e:
        return {
            "total": 0,
            "details": [
                {
                    "item": "log_file_readable",
                    "description": "Log file readable",
                    "score": 0,
                    "matched": False,
                    "error": str(e),
                }
            ],
        }

    # Helper function: Check message content
    def check_readme_read():
        """Point 1: Check if README.md was read"""
        for entry in log_entries:
            if (
                entry.get("type") == "message"
                and entry.get("message", {}).get("role") == "assistant"
            ):
                content = entry.get("message", {}).get("content", [])
                if isinstance(content, list):
                    for item in content:
                        if (
                            item.get("type") == "toolCall"
                            and item.get("name") == "read"
                        ):
                            path = item.get("arguments", {}).get("path", "")
                            if "README.md" in path:
                                return True
        return False

    def check_server_started():
        """Point 2: Check if server started successfully at http://localhost:xxxx/"""
        for entry in log_entries:
            if (
                entry.get("type") == "message"
                and entry.get("message", {}).get("role") == "toolResult"
            ):
                content = entry.get("message", {}).get("content", [])
                if isinstance(content, list):
                    for item in content:
                        text = item.get("text", "")
                        if (
                            "//localhost:" in text
                            and "Network:" in text
                            and "--host to expose" in text
                        ):
                            return True
        return False

    # Execute all checks
    # Format: (item_name, description, check_func, max_score)
    checks = [
        ("readme_read", "Read README.md file", check_readme_read, 1),
        (
            "server_started",
            "Successfully started server (supports localhost:xxxx/ )",
            check_server_started,
            1,
        ),
    ]

    for item_name, description, check_func, max_score in checks:
        matched = check_func()
        details.append(
            {
                "item": item_name,
                "description": description,
                "score": max_score if matched else 0,
                "matched": matched,
                "max_score": max_score,
            }
        )

    total = sum(d["score"] for d in details)
    return {"total": total, "details": details}


def score_parse_answer_file(local_answer_file):
    """
    Parse scoring points in answer file
    Returns: {'total': int, 'details': list}
    """
    details = []

    # Scoring point 1: Answer file exists
    if not os.path.isfile(local_answer_file):
        details.append(
            {
                "item": "answer_file_exists",
                "description": "Answer file exists",
                "score": 0,
                "matched": False,
            }
        )
        return {"total": 0, "details": details}

    details.append(
        {
            "item": "answer_file_exists",
            "description": "Answer file exists",
            "score": 1,
            "matched": True,
        }
    )

    # Read and parse answer file
    try:
        with open(local_answer_file, "r") as f:
            result_json = json.load(f)
    except Exception as e:
        details = []
        details.append(
            {
                "item": "answer_file_valid_json",
                "description": "Answer file is valid JSON format",
                "score": 0,
                "matched": False,
                "error": str(e),
            }
        )
        total = sum(d["score"] for d in details)
        return {"total": total, "details": details}

    print("Result String is :", result_json)

    # Scoring point 2: Total Growth correct
    if "Total Growth" in result_json:
        ans = result_json["Total Growth"]
        if ("2,324" in str(ans)) or ("2324" in str(ans)):
            details.append(
                {
                    "item": "total_growth_correct",
                    "description": "Total Growth value correct (expected: 2,324 or 2324)",
                    "score": 1,
                    "matched": True,
                    "expected_value": "2,324 / 2324",
                    "actual_value": ans,
                }
            )
        else:
            details.append(
                {
                    "item": "total_growth_correct",
                    "description": "Total Growth value correct (expected: 2,324 or 2324)",
                    "score": 0,
                    "matched": False,
                    "expected_value": "2,324 / 2324",
                    "actual_value": ans,
                }
            )
    else:
        details.append(
            {
                "item": "total_growth_correct",
                "description": "Total Growth value correct (expected: 2,324 or 2324)",
                "score": 0,
                "matched": False,
                "expected_value": "2,324 / 2324",
                "actual_value": None,
            }
        )

    # Scoring point 3: Total Page Views correct
    if "Total Page Views" in result_json:
        ans = result_json["Total Page Views"]
        if ("4,42,236" in str(ans)) or ("442236" in str(ans)):
            details.append(
                {
                    "item": "total_page_views_correct",
                    "description": "Total Page Views value correct (expected: 4,42,236 or 442236)",
                    "score": 1,
                    "matched": True,
                    "expected_value": "4,42,236 / 442236",
                    "actual_value": ans,
                }
            )
        else:
            details.append(
                {
                    "item": "total_page_views_correct",
                    "description": "Total Page Views value correct (expected: 4,42,236 or 442236)",
                    "score": 0,
                    "matched": False,
                    "expected_value": "4,42,236 / 442236",
                    "actual_value": ans,
                }
            )
    else:
        details.append(
            {
                "item": "total_page_views_correct",
                "description": "Total Page Views value correct (expected: 4,42,236 or 442236)",
                "score": 0,
                "matched": False,
                "expected_value": "4,42,236 / 442236",
                "actual_value": None,
            }
        )

    # Scoring point 4: Total Sales correct
    if "Total Sales" in result_json:
        ans = result_json["Total Sales"]
        if ("35,078" in str(ans)) or ("35078" in str(ans)):
            details.append(
                {
                    "item": "total_sales_correct",
                    "description": "Total Sales value correct (expected: 35,078 or 35078)",
                    "score": 1,
                    "matched": True,
                    "expected_value": "35,078 / 35078",
                    "actual_value": ans,
                }
            )
        else:
            details.append(
                {
                    "item": "total_sales_correct",
                    "description": "Total Sales value correct (expected: 35,078 or 35078)",
                    "score": 0,
                    "matched": False,
                    "expected_value": "35,078 / 35078",
                    "actual_value": ans,
                }
            )
    else:
        details.append(
            {
                "item": "total_sales_correct",
                "description": "Total Sales value correct (expected: 35,078 or 35078)",
                "score": 0,
                "matched": False,
                "expected_value": "35,078 / 35078",
                "actual_value": None,
            }
        )

    # Get Customer sub-dictionary
    sub_dict = result_json.get("Customer", {})

    # Scoring point 5: Betty Hammes Email correct
    if "Betty Hammes" in sub_dict and "Email" in sub_dict["Betty Hammes"]:
        ans = sub_dict["Betty Hammes"]["Email"]
        if "Thelma.Langworth@test.com".lower() in str(ans).lower():
            details.append(
                {
                    "item": "betty_hammes_email_correct",
                    "description": "Betty Hammes Email correct (expected: Thelma.Langworth@test.com)",
                    "score": 1,
                    "matched": True,
                    "expected_value": "Thelma.Langworth@test.com",
                    "actual_value": ans,
                }
            )
        else:
            details.append(
                {
                    "item": "betty_hammes_email_correct",
                    "description": "Betty Hammes Email correct (expected: Thelma.Langworth@test.com)",
                    "score": 0,
                    "matched": False,
                    "expected_value": "Thelma.Langworth@test.com",
                    "actual_value": ans,
                }
            )
    else:
        details.append(
            {
                "item": "betty_hammes_email_correct",
                "description": "Betty Hammes Email correct (expected: Thelma.Langworth@test.com)",
                "score": 0,
                "matched": False,
                "expected_value": "Thelma.Langworth@test.com",
                "actual_value": sub_dict.get("Betty Hammes", {}).get("Email", None)
                if "Betty Hammes" in sub_dict
                else None,
            }
        )

    # Scoring point 6: Betty Hammes Membership correct
    if "Betty Hammes" in sub_dict and "Membership" in sub_dict["Betty Hammes"]:
        ans = sub_dict["Betty Hammes"]["Membership"]
        if "vip" in str(ans).lower():
            details.append(
                {
                    "item": "betty_hammes_membership_correct",
                    "description": "Betty Hammes Membership correct (expected: vip)",
                    "score": 1,
                    "matched": True,
                    "expected_value": "vip",
                    "actual_value": ans,
                }
            )
        else:
            details.append(
                {
                    "item": "betty_hammes_membership_correct",
                    "description": "Betty Hammes Membership correct (expected: vip)",
                    "score": 0,
                    "matched": False,
                    "expected_value": "vip",
                    "actual_value": ans,
                }
            )
    else:
        details.append(
            {
                "item": "betty_hammes_membership_correct",
                "description": "Betty Hammes Membership correct (expected: vip)",
                "score": 0,
                "matched": False,
                "expected_value": "vip",
                "actual_value": sub_dict.get("Betty Hammes", {}).get("Membership", None)
                if "Betty Hammes" in sub_dict
                else None,
            }
        )

    # Scoring point 7: Betty Hammes Rewards correct
    if "Betty Hammes" in sub_dict and (
        "Reward" in sub_dict["Betty Hammes"] or "Rewards" in sub_dict["Betty Hammes"]
    ):
        ans = sub_dict["Betty Hammes"].get("Reward", None) or sub_dict[
            "Betty Hammes"
        ].get("Rewards", None)
        try:
            if 16 == int(ans):
                details.append(
                    {
                        "item": "betty_hammes_rewards_correct",
                        "description": "Betty Hammes Rewards correct (expected: 16)",
                        "score": 1,
                        "matched": True,
                        "expected_value": 16,
                        "actual_value": ans,
                    }
                )
            else:
                details.append(
                    {
                        "item": "betty_hammes_rewards_correct",
                        "description": "Betty Hammes Rewards correct (expected: 16)",
                        "score": 0,
                        "matched": False,
                        "expected_value": 16,
                        "actual_value": ans,
                    }
                )
        except (ValueError, TypeError):
            details.append(
                {
                    "item": "betty_hammes_rewards_correct",
                    "description": "Betty Hammes Rewards correct (expected: 16)",
                    "score": 0,
                    "matched": False,
                    "expected_value": 16,
                    "actual_value": ans,
                    "error": "Cannot convert to integer",
                }
            )
    else:
        details.append(
            {
                "item": "betty_hammes_rewards_correct",
                "description": "Betty Hammes Rewards correct (expected: 16)",
                "score": 0,
                "matched": False,
                "expected_value": 16,
                "actual_value": sub_dict.get("Betty Hammes", {}).get("Reward")
                or sub_dict.get("Betty Hammes", {}).get("Rewards")
                if "Betty Hammes" in sub_dict
                else None,
            }
        )

    total = sum(d["score"] for d in details)
    return {"total": total, "details": details}


def main():
    """Main verification entry point."""
    # Define file paths
    # In Harbor environment with openclaw base image, log files are typically in:
    log_file_path = Path("/workspace/.openclaw/agents/main/sessions/harbor.jsonl")
    # Fallback paths to check

    fallback_log_paths = [
        Path("/root/.openclaw/agents/main/sessions/harbor.jsonl"),
        Path("/workspace/.openclaw/agents/main/sessions/harbor.jsonl"),
        Path("/logs/agent/openclaw-state/agents/main/sessions/harbor.jsonl"),
    ]

    answer_file_path = Path("/workspace/answer_file.json")
    reward_output_path = Path("/logs/verifier/reward.json")

    # Ensure output directory exists
    reward_output_path.parent.mkdir(parents=True, exist_ok=True)

    # Find the log file if primary path doesn't exist
    actual_log_path = log_file_path
    if not actual_log_path.exists():
        for fallback in fallback_log_paths:
            if fallback.exists():
                actual_log_path = fallback
                break

    print("Log file is", actual_log_path)
    # Compute scores
    log_score = score_parse_log_file(str(actual_log_path))
    answer_score = score_parse_answer_file(str(answer_file_path))

    total_score = log_score.get("total", 0) + answer_score.get("total", 0)
    reward_val = total_score / 9

    # Merge all score details into final structure
    score_stat = {
        "total_reward": total_score,
        "total_score": total_score,
        "log_score": log_score["total"],
        "answer_score": answer_score["total"],
        "answer_score_details": answer_score["details"],
        "log_score_details": log_score["details"],
    }

    score_stat_with_reward = {"reward": reward_val, "_meta_": score_stat}

    # Write to reward.json
    with open(reward_output_path, "w", encoding="utf-8") as f:
        json.dump(score_stat_with_reward, f, indent=2, ensure_ascii=False)

    # Also print for debugging
    print(f"Verification complete. Total score: {total_score}/9")
    print(f"Log score: {log_score['total']}/2")
    print(f"Answer score: {answer_score['total']}/7")
    print(f"Results written to {reward_output_path}")

    reward_output_path_txt = Path("/logs/verifier/reward.txt")
    with open(reward_output_path_txt, "w", encoding="utf-8") as f:
        f.write(f"{reward_val:.3f}")
    print(f"Float score written to {reward_output_path_txt}")


if __name__ == "__main__":
    main()
