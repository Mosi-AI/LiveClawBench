# Q1 2026 VAT Filing — Finance Administrator Task

I'm the finance administrator for our company. I received an email from the tax authority about Q1 2026 VAT filing. Please help me complete the following steps:

## Step 1: Review Email Notifications

Log in to the email system at **http://localhost:5174/** with credentials:
- Username: `peter`
- Password: `password123`

Check the inbox for the Q1 2026 VAT filing reminder from the tax authority and any vendor invoice emails.

## Step 2: Create Missing Invoice

Log in to the finance system at **http://localhost:1235/** with credentials:
- Username: `admin`
- Password: `admin123`

Check the existing invoices. The tax authority email references invoice INV-2026-010 from Acme Corp which may not yet be in the finance system. If it's missing, create it using the API:
- `POST /api/invoices`

Check the Acme Corp billing email in your inbox for the exact invoice details (vendor, invoice number, date, line items with category codes and amounts), then construct the POST request body accordingly.

## Step 3: Calculate VAT

Read the company tax policy at **/workspace/policies/tax_policy.md** to understand the current VAT rates.

For each of the three invoices referenced in the tax authority email (INV-2026-001, INV-2026-002, INV-2026-010), calculate the VAT based on the policy rates. You can retrieve the existing invoice data from the finance API (`GET /api/invoices` to list all invoices, then check line items).

## Step 4: Update Tax Policy

Update the tax policy file at **/workspace/policies/tax_policy.md** by replacing the PENDING section at the bottom with the Q1 2026 filing results, including:
- VAT breakdown per invoice
- Total Q1 2026 VAT amount
- Filing date

## Step 5: Reply to Tax Authority

Send a reply email to `notifications@tax-authority.gov` with the subject "Re: Q1 2026 VAT Filing Reminder - Action Required" containing the VAT calculation summary for all three invoices and the total amount.

## API Reference

### Finance System (http://localhost:1235)
- `POST /api/auth/login` — authenticate with `{"username": "admin", "password": "admin123"}` (sets session cookie)
- `GET /api/invoices` — list all invoices
- `GET /api/vendors` — list vendors
- `POST /api/invoices` — create invoice (requires cookie auth)

### Email System (http://localhost:5174)
- `POST /api/auth/login` — authenticate with `{"username": "peter", "password": "password123"}` (returns `access_token`)
- `GET /api/emails?folder=inbox` — list inbox emails
- `POST /api/emails` — send email with Bearer token authorization. Body format:
  ```json
  {
    "recipient": "email@example.com",
    "subject": "Subject line",
    "body": "Email content",
    "send_now": true
  }
  ```
  Use the `Authorization: Bearer <access_token>` header for authentication.

### Tax Policy Location
- `/workspace/policies/tax_policy.md`
