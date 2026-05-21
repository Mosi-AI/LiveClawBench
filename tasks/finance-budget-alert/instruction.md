# Budget Alert Review

I'm the financial controller and I need you to review the March 2026 department budget reports and send alert emails to managers of departments with budget violations. Please complete the following steps:

1. **Login to the finance system** at http://localhost:1235/ using credentials: username `admin`, password `admin123`.
2. **Retrieve department financial records** for March 2026 using the API endpoint `GET /api/departments?month=2026-03`.
3. **Identify departments with budget violations**. A department has a budget violation if:
   - The `actual_expense_amount` is **negative** (data integrity issue), OR
   - The `actual_expense_amount` exceeds the `budget_amount` (over budget).
4. **Login to the email system** at http://localhost:5174/ using credentials: username `peter`, password `password123`.
5. **Send an alert email** to each violating department's manager (use the `manager_email` field from the financial records). Each email should:
   - Clearly state which department has a violation
   - Describe the type of violation (negative expense or over budget)
   - Include the relevant amounts (budget and actual)

## API Reference

### Finance System (http://localhost:1235)
- `POST /api/auth/login` - authenticate with `{"username": "admin", "password": "admin123"}` (sets session cookie)
- `GET /api/departments?month=YYYY-MM` - list department financial records for a given month

### Email System (http://localhost:5174)
- `POST /api/auth/login` - authenticate with `{"username": "peter", "password": "password123"}` (returns `access_token`)
- `POST /api/emails` - send email with Bearer token authorization. Body format:
  ```json
  {
    "recipient": "email@example.com",
    "subject": "Subject line",
    "body": "Email content",
    "send_now": true
  }
  ```
  Use the `Authorization: Bearer <access_token>` header for authentication.

## Important Notes
- Only send emails for departments that have actual violations (negative expense OR over budget).
- Do NOT send emails for departments with normal budgets.
- Each violating department should receive exactly one alert email.
- The email subject should clearly indicate it is a budget alert.
