#!/usr/bin/env python3
"""
Verification script for cd-pipeline-setup task.

Scoring criteria (total 1.0):
  1. Main branch content served at http://localhost:8080/          -> 0.25
  2. Dev branch content served at http://localhost:8080/dev/        -> 0.25
  3. Post-receive hook works (push triggers update)                 -> 0.25
  4. Deployment runbook exists and is non-trivial                   -> 0.25
"""

import os
import subprocess
import sys
import time


def run_cmd(cmd, timeout=30):
    """Run a shell command and return (returncode, stdout, stderr)."""
    try:
        result = subprocess.run(
            cmd, shell=True, capture_output=True, text=True, timeout=timeout
        )
        return result.returncode, result.stdout.strip(), result.stderr.strip()
    except subprocess.TimeoutExpired:
        return -1, "", "timeout"
    except Exception as e:
        return -1, "", str(e)


def check_main_branch_content():
    """Check that http://localhost:8080/ serves the main branch content."""
    rc, stdout, _ = run_cmd("curl -s -o /dev/stdout -w '' http://localhost:8080/")
    if rc == 0 and "PROD-CD-2026-A7X9K2" in stdout:
        print("PASS: Main branch content found at :8080/")
        return 0.25
    print(f"FAIL: Main branch content not found at :8080/ (rc={rc})")
    return 0.0


def check_dev_branch_content():
    """Check that http://localhost:8080/dev/ serves the dev branch content."""
    rc, stdout, _ = run_cmd("curl -s -o /dev/stdout -w '' http://localhost:8080/dev/")
    if rc == 0 and "DEV-CD-2026-M3P5W8" in stdout:
        print("PASS: Dev branch content found at :8080/dev/")
        return 0.25
    # Also try without trailing slash
    rc, stdout, _ = run_cmd("curl -s -o /dev/stdout -w '' http://localhost:8080/dev")
    if rc == 0 and "DEV-CD-2026-M3P5W8" in stdout:
        print("PASS: Dev branch content found at :8080/dev")
        return 0.25
    print(f"FAIL: Dev branch content not found at :8080/dev/ (rc={rc})")
    return 0.0


def check_hook_works():
    """Test that pushing new content triggers automatic deployment.

    Modify the webapp, push to the bare repo, and check if the served
    content updates within a few seconds.
    """
    MARKER = "HOOK-TEST-MARKER-2026-VERIFY"

    # Modify the main branch and push
    cmds = f"""
    cd /workspace/webapp && \
    git checkout main && \
    echo '<p>{MARKER}</p>' >> index.html && \
    git add -A && \
    git commit -m "Hook verification test" && \
    git push origin main 2>/dev/null
    """
    rc, _, stderr = run_cmd(cmds, timeout=15)
    if rc != 0:
        # Try alternative remote names
        for remote in ["bare", "deploy", "git@localhost:/srv/git/webapp.git"]:
            rc2, _, _ = run_cmd(
                f"cd /workspace/webapp && git push {remote} main 2>/dev/null",
                timeout=10,
            )
            if rc2 == 0:
                rc = 0
                break

    if rc != 0:
        print(f"FAIL: Could not push to bare repo (stderr: {stderr[:200]})")
        return 0.0

    # Wait for hook to deploy
    time.sleep(3)

    rc, stdout, _ = run_cmd("curl -s http://localhost:8080/")
    if MARKER in stdout:
        print("PASS: Post-receive hook deployed new content after push")
        return 0.25
    print("FAIL: Post-receive hook did not deploy new content")
    return 0.0


def check_runbook():
    """Check that the deployment runbook exists and has meaningful content."""
    runbook_path = "/workspace/runbook/deploy_guide.md"
    if not os.path.exists(runbook_path):
        print(f"FAIL: Runbook not found at {runbook_path}")
        return 0.0

    with open(runbook_path) as f:
        content = f.read()

    word_count = len(content.split())
    if word_count < 50:
        print(f"FAIL: Runbook too short ({word_count} words, need >= 50)")
        return 0.0

    print(f"PASS: Runbook exists with {word_count} words")
    return 0.25


def main():
    score = 0.0
    score += check_main_branch_content()
    score += check_dev_branch_content()
    score += check_hook_works()
    score += check_runbook()

    print(f"\nScore: {score:.2f}/1.0")
    sys.exit(0 if score >= 0.5 else 1)


if __name__ == "__main__":
    main()
