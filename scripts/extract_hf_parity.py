"""Extract per-task success patterns from HuggingFace leaderboard trajectories.

Downloads the LiveClawBench trajectory dataset, filters for the 5 airline tasks,
and analyzes agent behavior to determine success/failure rates per task per model.
"""

import csv
import json
from collections import defaultdict

from datasets import load_dataset

AIRLINE_TASKS = [
    "baggage-tracking-application",
    "flight-booking",
    "flight-seat-selection",
    "flight-seat-selection-failed",
    "flight-cancel-claim",
]

LEADERBOARD_MODELS = [
    "qwen3.5-397b-a17b",
    "MiniMax-M2.7",
    "glm_5_reasoning_true_moonshot",
    "glm-5-turbo",
    "qwen3.5-122b-a10b",
    "qwen3.5-27b",
    "qwen3.5-35b-a3b",
]


def parse_trajectory(raw: str | dict) -> dict:
    if isinstance(raw, str):
        return json.loads(raw)
    return raw


def classify_baggage_tracking(traj: dict) -> float:
    """Check if agent successfully tracked baggage."""
    steps = traj.get("steps", [])
    all_text = ""
    for step in steps:
        all_text += step.get("message", "") + " "
        if step.get("source") == "agent":
            obs = step.get("observation", {})
            if isinstance(obs, dict):
                for r in obs.get("results", []):
                    all_text += r.get("content", "") + " "
            tool_calls = step.get("tool_calls", [])
            for tc in tool_calls:
                all_text += json.dumps(tc.get("arguments", {})) + " "

    lower = all_text.lower()
    # Success indicators: found luggage with correct status
    if "delivered" in lower or "arrived" in lower:
        if "baggage" in lower or "luggage" in lower:
            return 1.0
    if "tracking" in lower and ("found" in lower or "locate" in lower):
        return 1.0
    # Check for successful API interaction with tracking endpoint
    if "/baggage" in lower or "baggage_tracking" in lower:
        if any(status in lower for status in ["delivered", "arrived", "carousel"]):
            return 1.0
    return 0.0


def classify_flight_booking(traj: dict) -> float:
    """Check if agent made a successful flight booking."""
    steps = traj.get("steps", [])
    all_text = ""
    for step in steps:
        all_text += step.get("message", "") + " "
        if step.get("source") == "agent":
            obs = step.get("observation", {})
            if isinstance(obs, dict):
                for r in obs.get("results", []):
                    all_text += r.get("content", "") + " "
            tool_calls = step.get("tool_calls", [])
            for tc in tool_calls:
                all_text += json.dumps(tc.get("arguments", {})) + " "

    lower = all_text.lower()
    # Success: booking reference/confirmation found
    booking_indicators = [
        "booking reference",
        "booking confirmation",
        "booking_ref",
        "bookingref",
        "booking successful",
        "successfully booked",
        "reservation confirmed",
        "pnr",
        "confirmation number",
    ]
    for indicator in booking_indicators:
        if indicator in lower:
            return 1.0

    # Partial credit: agent attempted booking
    if "book" in lower and ("flight" in lower or "airline" in lower):
        # Check if there was an error
        if "error" in lower or "failed" in lower:
            return 0.0
        # Check for booking-related API call
        if "/booking" in lower or "create_booking" in lower:
            return 0.8

    return 0.0


def classify_flight_seat_selection(traj: dict) -> float:
    """Check if agent selected a seat."""
    steps = traj.get("steps", [])
    all_text = ""
    for step in steps:
        all_text += step.get("message", "") + " "
        if step.get("source") == "agent":
            obs = step.get("observation", {})
            if isinstance(obs, dict):
                for r in obs.get("results", []):
                    all_text += r.get("content", "") + " "
            tool_calls = step.get("tool_calls", [])
            for tc in tool_calls:
                all_text += json.dumps(tc.get("arguments", {})) + " "

    lower = all_text.lower()
    # Success: seat selected/confirmed
    seat_indicators = [
        "seat selected",
        "seat confirmed",
        "seat_selection",
        "successfully selected",
        "seat has been selected",
        "your seat",
        "seat assignment",
    ]
    for indicator in seat_indicators:
        if indicator in lower:
            return 1.0

    # Check for seat selection API call
    if "/seat" in lower or "select_seat" in lower:
        return 0.8

    return 0.0


def classify_seat_selection_failed(traj: dict) -> float:
    """Check if agent mentioned upgrade fee '350'."""
    steps = traj.get("steps", [])
    all_text = ""
    for step in steps:
        all_text += step.get("message", "") + " "

    # The key criterion: agent must mention the upgrade fee "350"
    if "350" in all_text:
        return 1.0

    # Partial: agent recognized seat was unavailable
    lower = all_text.lower()
    if "unavailable" in lower or "occupied" in lower or "not available" in lower:
        if "upgrade" in lower or "fee" in lower:
            return 0.5

    return 0.0


def classify_flight_cancel_claim(traj: dict) -> float:
    """Check if agent sent claim email."""
    steps = traj.get("steps", [])
    all_text = ""
    for step in steps:
        all_text += step.get("message", "") + " "
        if step.get("source") == "agent":
            obs = step.get("observation", {})
            if isinstance(obs, dict):
                for r in obs.get("results", []):
                    all_text += r.get("content", "") + " "
            tool_calls = step.get("tool_calls", [])
            for tc in tool_calls:
                all_text += json.dumps(tc.get("arguments", {})) + " "

    lower = all_text.lower()
    # Success: agent sent claim email
    if "email" in lower and (
        "claim" in lower or "compensation" in lower or "refund" in lower
    ):
        # Check for email sending indicators
        email_sent = any(
            x in lower
            for x in [
                "email sent",
                "sent email",
                "email has been sent",
                "/send",
                "compose",
            ]
        )
        if email_sent:
            return 1.0

    # Check for email API call with claim content
    if "/email" in lower and "send" in lower:
        if "claim" in lower or "cancel" in lower:
            return 0.8

    return 0.0


CLASSIFIERS = {
    "baggage-tracking-application": classify_baggage_tracking,
    "flight-booking": classify_flight_booking,
    "flight-seat-selection": classify_flight_seat_selection,
    "flight-seat-selection-failed": classify_seat_selection_failed,
    "flight-cancel-claim": classify_flight_cancel_claim,
}


def main():
    import os

    parquet_path = "/tmp/hf_liveclawbench.parquet"
    if os.path.exists(parquet_path):
        print(f"Loading from local parquet: {parquet_path}")
        import pandas as pd

        df = pd.read_parquet(parquet_path)
        print(f"Total records: {len(df)}")
        df = df[df["case_name"].isin(AIRLINE_TASKS)]
        print(f"Airline task records: {len(df)}")
        records = df.to_dict("records")
    else:
        print("Loading HuggingFace dataset...")
        ds = load_dataset("Mosi-AI/LiveClawBench", split="v0.1.0")
        print(f"Total records: {len(ds)}")
        airline_ds = ds.filter(lambda x: x["case_name"] in AIRLINE_TASKS)
        print(f"Airline task records: {len(airline_ds)}")
        records = airline_ds

    # Analyze each record
    results = defaultdict(lambda: defaultdict(list))

    for record in records:
        model = record["model_name"]
        task = record["case_name"]
        run_id = record["sample_id"].split("_")[-1]
        classifier = CLASSIFIERS[task]

        traj = parse_trajectory(record["trajectory"])
        score = classifier(traj)

        results[model][task].append(
            {"run_id": run_id, "sample_id": record["sample_id"], "score": score}
        )

    # Output per-task success rate matrix
    print("\n=== Per-Task Trajectory-Based Success Rates (Flask Backend) ===\n")
    header = ["model"] + AIRLINE_TASKS
    rows = []

    for model in LEADERBOARD_MODELS:
        row = [model]
        for task in AIRLINE_TASKS:
            runs = results.get(model, {}).get(task, [])
            if runs:
                scores = [r["score"] for r in runs]
                avg = sum(scores) / len(scores)
                row.append(f"{avg:.2f}")
            else:
                row.append("N/A")
        rows.append(row)
        print(f"  {row[0]:25s} | " + " | ".join(f"{v:>8s}" for v in row[1:]))

    # Write CSV
    output_path = "scripts/hf_parity_matrix.csv"
    with open(output_path, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(header)
        writer.writerows(rows)
    print(f"\nCSV written to {output_path}")

    # Print detailed results
    print("\n=== Detailed Per-Run Scores ===\n")
    for model in LEADERBOARD_MODELS:
        for task in AIRLINE_TASKS:
            runs = results.get(model, {}).get(task, [])
            if runs:
                for r in runs:
                    print(
                        f"  {model:25s} {task:35s} run={r['run_id']} score={r['score']:.1f}"
                    )


if __name__ == "__main__":
    main()
