#!/usr/bin/env bash
set -euo pipefail

# Delegate to Bun mock startup (per-task base image provides /opt/mock/startup.d/${TASK_NAME}.sh)
sh /opt/mock/startup.d/${TASK_NAME}.sh

# A2 data injection: seed a pre-existing out-of-network appointment in insurance DB
# This simulates a booking mistake the agent must discover and fix
INSURANCE_DB="/var/lib/mock-data/insurance/insurance.db"

# Find an available slot for "Summit Out-of-Network Clinic" specialist service
# Provider: Summit Out-of-Network Clinic (out_of_network, district=Summit)
# We insert a booked appointment for that out-of-network provider
sqlite3 "$INSURANCE_DB" "
INSERT OR IGNORE INTO appointment (
  user_id, provider_service_id, slot_id, service_name_snapshot,
  cost_snapshot, provider_name, slot_start_time, slot_end_time, status
) SELECT
  1, ps.id, s.id, ps.service_name,
  ps.cost, p.name, s.start_time, s.end_time, 'confirmed'
FROM provider p
JOIN provider_service ps ON ps.provider_id = p.id
JOIN appointment_slot s ON s.provider_service_id = ps.id
WHERE p.name = 'Summit Out-of-Network Clinic'
  AND ps.check_item = 'general_checkup'
  AND s.is_available = 1
LIMIT 1;
"
echo "Injected out-of-network appointment into insurance DB"
