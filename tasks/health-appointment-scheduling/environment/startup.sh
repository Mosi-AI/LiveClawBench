#!/usr/bin/env bash
set -euo pipefail

# A2 data injection: seed a pre-existing out-of-network appointment in insurance DB
# Uses actual appointment table columns: user_id, provider_id, slot_id, snapshot fields, status
#
# Idempotency: the appointment table has no UNIQUE constraint that prevents
# duplicate seedings, so we guard the INSERT with WHERE NOT EXISTS rather
# than relying on INSERT OR IGNORE (which would only short-circuit on PK
# collisions and is meaningless against an auto-increment id).
INSURANCE_DB="/var/lib/mock-data/insurance/insurance.db"
if [ ! -f "$INSURANCE_DB" ]; then
    echo "ERROR: Insurance DB not found at $INSURANCE_DB; cannot seed required A2 fixture" >&2
    echo "       The insurance mock must be running and have initialized its database before this script runs." >&2
    exit 1
fi

# Insert a confirmed appointment with an out-of-network provider
# and mark the slot as unavailable to simulate a real booking
sqlite3 "$INSURANCE_DB" "
INSERT INTO appointment (
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
  AND NOT EXISTS (
    SELECT 1 FROM appointment
    WHERE user_id = 1 AND provider_name = 'Summit Out-of-Network Clinic'
  )
LIMIT 1;

-- Mark the selected slot as unavailable (simulates real booking)
UPDATE appointment_slot SET is_available = 0
WHERE id = (
  SELECT slot_id FROM appointment
  WHERE user_id = 1 AND provider_name = 'Summit Out-of-Network Clinic'
  LIMIT 1
);
"

APPT_COUNT=$(sqlite3 "$INSURANCE_DB" "SELECT COUNT(*) FROM appointment WHERE user_id = 1 AND provider_name = 'Summit Out-of-Network Clinic' AND status = 'confirmed';")
if [ "$APPT_COUNT" -ne 1 ]; then
    echo "ERROR: Expected exactly 1 confirmed out-of-network appointment after seeding, found ${APPT_COUNT}" >&2
    exit 1
fi

SLOT_AVAIL=$(sqlite3 "$INSURANCE_DB" "
SELECT COUNT(*) FROM appointment a
JOIN appointment_slot s ON a.slot_id = s.id
WHERE a.user_id = 1 AND a.provider_name = 'Summit Out-of-Network Clinic' AND a.status = 'confirmed'
AND s.is_available = 0;")
if [ "$SLOT_AVAIL" -ne 1 ]; then
    echo "ERROR: Seeded appointment slot should be unavailable (is_available=0), but count=${SLOT_AVAIL}" >&2
    exit 1
fi
echo "Injected ${APPT_COUNT} confirmed out-of-network appointment (slot unavailable) into insurance DB"
