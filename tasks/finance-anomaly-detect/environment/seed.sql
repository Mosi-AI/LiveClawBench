-- Contaminated transaction data for anomaly detection task.
-- Runs AFTER default seed, which inserts 10 normal transactions.
-- We clear defaults and inject our contaminated set.

DELETE FROM transaction_record;
DELETE FROM sqlite_sequence WHERE name = 'transaction_record';

-- Normal transactions (ids 1-7): varied amounts, realistic vendors
INSERT INTO transaction_record (trade_date, vendor_name, amount, category, status, approval_status, approval_note)
VALUES ('2026-01-05', 'Initech Solutions', 3420.75, 'software', 'pending', 'pending', '');

INSERT INTO transaction_record (trade_date, vendor_name, amount, category, status, approval_status, approval_note)
VALUES ('2026-01-10', 'Hooli Technologies', 1875.30, 'office_supplies', 'pending', 'pending', '');

INSERT INTO transaction_record (trade_date, vendor_name, amount, category, status, approval_status, approval_note)
VALUES ('2026-01-15', 'Globex Systems', 8900.00, 'professional_services', 'pending', 'pending', '');

INSERT INTO transaction_record (trade_date, vendor_name, amount, category, status, approval_status, approval_note)
VALUES ('2026-01-22', 'Massive Dynamic', 2340.50, 'marketing', 'pending', 'pending', '');

INSERT INTO transaction_record (trade_date, vendor_name, amount, category, status, approval_status, approval_note)
VALUES ('2026-02-03', 'Wayne Ent', 560.00, 'meals', 'pending', 'pending', '');

INSERT INTO transaction_record (trade_date, vendor_name, amount, category, status, approval_status, approval_note)
VALUES ('2026-02-08', 'Cyberdyne', 4200.00, 'transport', 'pending', 'pending', '');

INSERT INTO transaction_record (trade_date, vendor_name, amount, category, status, approval_status, approval_note)
VALUES ('2026-02-12', 'Oscorp', 6750.25, 'travel', 'pending', 'pending', '');

-- ANOMALY 1 (id 8): Duplicate amount for Acme Corp.
-- id=8 has the same vendor and amount as id=10 below: $12,500.50 for "Acme Corp"
INSERT INTO transaction_record (trade_date, vendor_name, amount, category, status, approval_status, approval_note)
VALUES ('2026-02-15', 'Acme Corp', 12500.50, 'software', 'pending', 'pending', '');

-- ANOMALY 2 (id 9): Unusually large round-number amount ($50,000.00)
-- No typical corporate expense is exactly $50,000.00
INSERT INTO transaction_record (trade_date, vendor_name, amount, category, status, approval_status, approval_note)
VALUES ('2026-02-20', 'Stark Ind', 50000.00, 'professional_services', 'pending', 'pending', '');

-- ANOMALY 1 companion (id 10): Duplicate amount for Acme Corp.
-- Same vendor, same amount as id=8 — classic duplicate payment anomaly
INSERT INTO transaction_record (trade_date, vendor_name, amount, category, status, approval_status, approval_note)
VALUES ('2026-02-22', 'Acme Corp', 12500.50, 'software', 'pending', 'pending', '');

-- ANOMALY 3 (id 11): Unusually large round-number amount ($100,000.00)
-- Extremely suspicious round number
INSERT INTO transaction_record (trade_date, vendor_name, amount, category, status, approval_status, approval_note)
VALUES ('2026-02-25', 'Umbrella', 100000.00, 'marketing', 'pending', 'pending', '');
