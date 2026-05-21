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
    Point 2: Executed npm install --legacy-peer-deps, add 1 point
    Point 3: Successfully started server at http://localhost:xxxx/my-crm-app/, add 1 point
    Point 4: Read vite.config.ts and discovered two vue() plugin configurations, add 1 point
    Point 5: Called edit to fix the two vue plugin bug, add 2 points
    Point 6: Read src/router/index.ts and discovered base path issue, add 1 point
    Point 7: Called edit to fix createWebHistory related bug, add 2 points
    Point 8: Successfully displayed Dashboard page with title "Vue Demo V3", add 1 point

    Total: 10 points

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

    def check_npm_legacy_peer_deps():
        """Point 2: Check if npm install --legacy-peer-deps was executed"""
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
                            and item.get("name") == "exec"
                        ):
                            command = item.get("arguments", {}).get("command", "")
                            if (
                                "npm install" in command
                                and "--legacy-peer-deps" in command
                            ):
                                return True
        return False

    def check_server_started():
        """Point 3: Check if server started successfully at http://localhost:xxxx/ or http://localhost:xxxx/my-crm-app/"""
        for entry in log_entries:
            if (
                entry.get("type") == "message"
                and entry.get("message", {}).get("role") == "toolResult"
            ):
                content = entry.get("message", {}).get("content", [])
                if isinstance(content, list):
                    for item in content:
                        text = item.get("text", "")
                        # Solution A: Check for URL containing localhost and /my-crm-app/
                        if "//localhost:" in text and "/my-crm-app/" in text:
                            # Further check if it's startup information
                            if "Network:" in text and "--host to expose" in text:
                                return True
                        # Solution B: Check for localhost:port root path startup (vite base set to '/')
                        if (
                            "//localhost:" in text
                            and "Network:" in text
                            and "--host to expose" in text
                        ):
                            return True
        return False

    def check_vite_config_read():
        """Point 4: Check if vite.config.ts was read and discovered two vue() plugins"""
        # Step 1: Check if vite.config.ts was read
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
                            if "vite.config.ts" in path:
                                # Step 2: Find corresponding toolResult and check content
                                tool_call_id = item.get("id", "")

                                # Find corresponding toolResult
                                for result_entry in log_entries:
                                    if (
                                        result_entry.get("type") == "message"
                                        and result_entry.get("message", {}).get("role")
                                        == "toolResult"
                                        and result_entry.get("message", {}).get(
                                            "toolCallId"
                                        )
                                        == tool_call_id
                                    ):
                                        result_content = result_entry.get(
                                            "message", {}
                                        ).get("content", [])
                                        if isinstance(result_content, list):
                                            for result_item in result_content:
                                                text = result_item.get("text", "")
                                                # Check if vue() or vue({ appears twice
                                                vue_count = text.count("vue(")
                                                if vue_count >= 2:
                                                    return True
                                break
        return False

    def check_vite_plugin_fix():
        """Point 5: Check if edit was called to fix the two vue plugin bug"""
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
                            and item.get("name") == "edit"
                        ):
                            path = item.get("arguments", {}).get("path", "")
                            # Support both parameter naming conventions
                            old_text = item.get("arguments", {}).get(
                                "oldText"
                            ) or item.get("arguments", {}).get("old_string", "")
                            new_text = item.get("arguments", {}).get(
                                "newText"
                            ) or item.get("arguments", {}).get("new_string", "")

                            # Check if vite.config.ts was modified
                            if "vite.config.ts" in path:
                                # Check if vue() plugin modification is involved
                                if "vue()" in old_text or "vue()" in new_text:
                                    return True
        return False

    def check_router_read():
        """Point 6: Check if router/index.ts was read or base path issue was discovered (two solution approaches)"""
        # Solution A: Check if router file was read
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
                            if "router" in path and "index.ts" in path:
                                return True

        # Solution B: Check if vite.config.ts was read and base was subsequently modified
        # First find the read vite.config.ts operation
        vite_read_tool_call_id = None
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
                            if "vite.config.ts" in path:
                                vite_read_tool_call_id = item.get("id", "")
                                break
                    if vite_read_tool_call_id:
                        break

        # If vite.config.ts was read, check if base was subsequently modified
        if vite_read_tool_call_id:
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
                                and item.get("name") == "edit"
                            ):
                                path = item.get("arguments", {}).get("path", "")
                                # Support both parameter naming conventions
                                old_text = item.get("arguments", {}).get(
                                    "oldText"
                                ) or item.get("arguments", {}).get("old_string", "")
                                new_text = item.get("arguments", {}).get(
                                    "newText"
                                ) or item.get("arguments", {}).get("new_string", "")

                                if "vite.config.ts" in path:
                                    # Check if base configuration was modified
                                    if "base:" in old_text or "base:" in new_text:
                                        return True

        return False

    def check_router_fix():
        """Point 7: Check if edit was called to fix createWebHistory or vite base bug (two solution approaches)"""
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
                            and item.get("name") == "edit"
                        ):
                            path = item.get("arguments", {}).get("path", "")
                            # Support both parameter naming conventions
                            old_text = item.get("arguments", {}).get(
                                "oldText"
                            ) or item.get("arguments", {}).get("old_string", "")
                            new_text = item.get("arguments", {}).get(
                                "newText"
                            ) or item.get("arguments", {}).get("new_string", "")

                            # Solution A: Check if router file was modified
                            if "router" in path and "index.ts" in path:
                                # Check if createWebHistory modification is involved
                                if (
                                    "createWebHistory(import.meta.env.BASE_URL)"
                                    in new_text
                                ):
                                    return True

                            # Solution B: Check if vite.config.ts base configuration was modified
                            if "vite.config.ts" in path:
                                # Check if base path modification is involved
                                if "base:" in old_text or "base:" in new_text:
                                    return True
        return False

    def check_dashboard_display():
        """Point 8: Check if Vue Demo V3 Dashboard page was successfully displayed"""
        for entry in log_entries:
            if (
                entry.get("type") == "message"
                and entry.get("message", {}).get("role") == "toolResult"
            ):
                tool_name = entry.get("message", {}).get("toolName", "")
                if tool_name == "browser":
                    content = entry.get("message", {}).get("content", [])
                    if isinstance(content, list):
                        for item in content:
                            text = item.get("text", "")
                            # Check if Vue Demo V3 title is present
                            has_vue_demo = "Vue Demo V3" in text
                            # Check if Dashboard related buttons are present
                            has_dashboard_buttons = all(
                                keyword in text
                                for keyword in [
                                    "Dashboard",
                                    "Customer",
                                    "Product",
                                    "Order",
                                ]
                            )

                            if has_vue_demo and has_dashboard_buttons:
                                return True
        return False

    # Execute all checks
    # Format: (item_name, description, check_func, max_score)
    checks = [
        ("readme_read", "Read README.md file", check_readme_read, 1),
        (
            "npm_legacy_peer_deps",
            "Executed npm install --legacy-peer-deps",
            check_npm_legacy_peer_deps,
            1,
        ),
        (
            "server_started",
            "Successfully started server (supports localhost:xxxx/ or localhost:xxxx/my-crm-app/)",
            check_server_started,
            1,
        ),
        (
            "vite_config_read",
            "Read vite.config.ts and discovered two vue() plugin configurations",
            check_vite_config_read,
            1,
        ),
        (
            "vite_plugin_fix",
            "Called edit to fix the two vue plugin bug",
            check_vite_plugin_fix,
            2,
        ),  # 2 points
        (
            "router_read",
            "Read router/index.ts or discovered base path issue (supports two solution approaches)",
            check_router_read,
            1,
        ),
        (
            "router_fix",
            "Called edit to fix createWebHistory or vite base bug (supports two solution approaches)",
            check_router_fix,
            2,
        ),  # 2 points
        (
            "dashboard_display",
            'Successfully displayed "Vue Demo V3" Dashboard page',
            check_dashboard_display,
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


def score_parse_answer_file(answer_file_path: str) -> dict:
    """
    Parse the answer file and score based on extracted data from CRM dashboard.

    Returns:
        {
            'total': int,
            'details': [
                {
                    'item': str,
                    'description': str,
                    'score': int,
                    'matched': bool,
                    'expected_value': any,
                    'actual_value': any
                }
            ]
        }
    """
    details = []

    # Point 1: Answer file exists
    if not os.path.isfile(answer_file_path):
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
        with open(answer_file_path, "r") as f:
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

    # Point 2: Total Growth correct
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
    reward_val = total_score / 12

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
    print(f"Verification complete. Total score: {total_score}/12")
    print(f"Log score: {log_score['total']}/10")
    print(f"Answer score: {answer_score['total']}/2")
    print(f"Results written to {reward_output_path}")

    reward_output_path_txt = Path("/logs/verifier/reward.txt")
    with open(reward_output_path_txt, "w", encoding="utf-8") as f:
        f.write(f"{reward_val:.3f}")
    print(f"Float score written to {reward_output_path_txt}")


if __name__ == "__main__":
    main()
