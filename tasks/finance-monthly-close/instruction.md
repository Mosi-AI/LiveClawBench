# Monthly Close

It's month-end close. Please log in to the finance system (http://localhost:1235/) and complete the following tasks:

1. Review all account balances. Flag any account where the absolute difference between system balance and statement balance exceeds $400.
2. Review all pending transactions. Flag any pending transaction with amount greater than $50,000.
3. Create a new expense report for "March Marketing Trip" with these items: Flight $1,200, Hotel $900, Meals $350.
4. Submit the expense report.
5. Create a new invoice for vendor "Globex Systems" with invoice number "INV-2026-004", date 2026-03-01, and line items: Travel Expenses $5,000 (category 5100), Consulting $3,000 (category 5400).

## Authentication

Use the login endpoint with credentials:
- Username: `admin`
- Password: `admin123`

## API Endpoints

- `POST /api/auth/login` — authenticate (returns session cookie)
- `GET /api/accounts` — list account balances
- `POST /api/accounts/{id}/flag` — flag an account
- `GET /api/transactions?status=pending` — list pending transactions
- `POST /api/transactions/{id}/flag` — flag a transaction
- `POST /api/expense-reports` — create expense report
- `POST /api/expense-reports/{id}/submit` — submit expense report
- `GET /api/vendors` — list vendors
- `POST /api/invoices` — create invoice

## Expense Report Payload

```json
{
  "trip_name": "March Marketing Trip",
  "items": [
    {"expense_category": "flight", "amount": 1200},
    {"expense_category": "hotel", "amount": 900},
    {"expense_category": "meals", "amount": 350}
  ]
}
```

## Invoice Payload

First find the vendor ID for "Globex Systems" via `GET /api/vendors`, then:

```json
{
  "vendor_id": 2,
  "invoice_number": "INV-2026-004",
  "invoice_date": "2026-03-01",
  "items": [
    {"description": "Travel Expenses", "category_code": "5100", "amount": 5000},
    {"description": "Consulting", "category_code": "5400", "amount": 3000}
  ]
}
```
