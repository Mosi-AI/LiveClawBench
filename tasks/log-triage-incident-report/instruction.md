# Log Triage & Incident Report

The system monitoring dashboard (http://localhost:3000/) shows an abnormal spike in error rates over the past hour.

Log files are located at `/workspace/logs/`, containing logs from multiple services.

## Objective

Analyze the fault information in the logs, identify the root cause, and write an incident report.

## Deliverables

Write the incident report to `/workspace/output/incident_report.md`. The report should cover the following dimensions:
1. **Root cause accuracy**: Whether the true root cause was correctly identified (not downstream symptoms)
2. **Timeline logic**: Whether the causal chain is correct (cause before effect)
3. **Evidence citations**: Whether specific log entries are cited as supporting evidence
4. **Noise exclusion**: Whether seemingly related but actually noisy errors were identified and excluded

