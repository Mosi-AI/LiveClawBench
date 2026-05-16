#!/usr/bin/env bash
set -euo pipefail

# A2 data injection: seed a pre-existing out-of-network appointment in insurance DB
# Uses actual appointment table columns: user_id, provider_id, slot_id, snapshot fields, status
INSURANCE_DB="/var/lib/mock-data/insurance/insurance.db"

# Insert a confirmed appointment with an out-of-network provider
# and mark the slot as unavailable to simulate a real booking
sqlite3 "$INSURANCE_DB" "
INSERT OR IGNORE INTO appointment (
  user_id, provider_id, slot_id, provider_name, service_name_snapshot,
  check_item, slot_start_time, slot_end_time, cost_snapshot, distance_km_snapshot, status
) SELECT
  1, p.id, s.id, p.name, ps.service_name,
  ps.check_item, s.start_time, s.end_time, ps.cost, p.distance_km, 'confirmed'
FROM provider p
JOIN provider_service ps ON ps.provider_id = p.id
JOIN appointment_slot s ON s.provider_service_id = ps.id
WHERE p.name = 'Summit Out-of-Network Clinic'
  AND ps.check_item = 'general_checkup'
  AND s.is_available = 1
LIMIT 1;

-- Mark the selected slot as unavailable (simulates real booking)
UPDATE appointment_slot SET is_available = 0
WHERE id = (
  SELECT slot_id FROM appointment
  WHERE user_id = 1 AND provider_name = 'Summit Out-of-Network Clinic'
  LIMIT 1
);
"
echo "Injected out-of-network appointment into insurance DB"
