## Task Description

Your email inbox (http://localhost:5174/) contains an urgent alert from the DBA about corrupted databases.

## Objective

The databases at `/workspace/databases/` have suffered different types of corruption. Diagnose each database's specific corruption type and recover as much data as possible.

## Deliverables

1. **Recovered orders data** at `/workspace/output/orders.json` — complete JSON array of all order records
2. **Recovered users data** at `/workspace/output/users.json` — complete JSON array of all user records
3. **Foreign key integrity**: All `user_id` references in orders must point to valid users

