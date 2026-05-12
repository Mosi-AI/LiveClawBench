# Fix Log Round 1: grocery-reorder

## Fixed Findings

| issue_id | change made | spec sections changed |
|---|---|---|
| F1 | Removed precise threshold "less than 1 dozen" from instruction; changed to "running low on eggs" | 3. Agent Instruction Draft |
| F2 | Clarified that only Smart Home Mock (port 5004) is needed; removed Shop Mock reference; port 5004 matches smarthome mock snapshot | 1. Case Metadata, 4. Environment And Data Setup |
| F3 | Added explicit task-binary-map.json entry with smarthome binary and seed.sql asset | 4. Environment And Data Setup |
| F4 | Added Docker Image Architecture section explaining three-layer build: base → per-task → task | 4. Environment And Data Setup |
| F5 | Specified exact verifier state read path: `/tmp/mosi_smart_home.sqlite` with table names `grocery_orders` and `grocery_order_items` | 6. Verifier Design |
| F6 | Clarified that Smart Home Mock provides BOTH inventory API AND grocery ordering API; removed misleading "shop-web" reference | 1. Case Metadata, 4. Environment And Data Setup |
| F7 | Set case_id to 32 (next available after case_id 31 smarthome-test) | 1. Case Metadata |
| F8 | Removed `environment/startup.sh` from required files; startup is handled by `/opt/mock/startup.d/grocery-reorder.sh` per architecture | 7. Required Files |

## Unresolved Findings

| issue_id | reason not fixed | user action needed |
|---|---|---|
| — | All findings addressed | — |