"""Verifier for vue-fix-rebreak (A2+C1).

Multi-dimensional scoring:
  a2_fix (0.30): initial A2 build error fixed
  c1_detection (0.30): detected re-broken build after C1 trigger
  build_success (0.40): final build succeeds
"""

import json
import subprocess
import sys


def main():
    score = 0.0
    dimensions = {}

    # Check if npm run build succeeds
    try:
        result = subprocess.run(
            ["npm", "run", "build"],
            capture_output=True,
            text=True,
            timeout=120,
            cwd="/workspace/vue-crm",
        )
        build_ok = result.returncode == 0
    except Exception:
        build_ok = False

    if build_ok:
        # If build passes, both A2 fix and C1 recovery were done
        score = 1.0
        dimensions["a2_fix"] = 0.30
        dimensions["c1_detection"] = 0.30
        dimensions["build_success"] = 0.40
    else:
        # Partial: check if initial fix was attempted
        # (build might fail for a different reason than the original A2)
        try:
            with open("/workspace/vue-crm/src/components/FixedComponent.vue") as f:
                content = f.read()
            has_fix_marker = "fix_marker" in content
            has_fix_pattern = any(
                p in content.lower()
                for p in ["is_fixed", "isfixed", ":fixed", "fixed="]
            )
            if has_fix_marker or has_fix_pattern:
                dimensions["a2_fix"] = 0.30
                score += 0.30
        except Exception:
            pass

    # Write reward.json
    try:
        import os

        os.makedirs("/logs/verifier", exist_ok=True)
        reward_json = {"reward": round(score, 2)}
        reward_json.update(dimensions)
        with open("/logs/verifier/reward.json", "w") as f:
            json.dump(reward_json, f, indent=2)
    except Exception:
        pass

    print(f"Score: {score:.2f}/1.0")
    sys.exit(0 if score >= 0.5 else 1)


if __name__ == "__main__":
    main()
