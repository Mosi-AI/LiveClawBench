# Q1 2026 Financial Analysis Report

You are a financial analyst at Acme Corp. The CFO has requested a comprehensive Q1 2026 financial analysis report covering January through March 2026. Please complete the following:

## Tasks

1. **Retrieve financial data** from the Acme Corp finance system:
   - Finance system URL: http://localhost:1235/
   - Login credentials: username `admin`, password `admin123`
   - Use the API to retrieve department financial records for Q1 (January, February, and March 2026)

2. **Read the report template** at `/workspace/policies/report_template.md` for formatting guidelines and required sections

3. **Generate the financial analysis report**:
   - Save the report to `/workspace/output/report.md`
   - Follow the template guidelines strictly
   - Include all required sections with real data from the finance system
   - Use tables for numerical comparisons
   - Analyze the data for trends, variances, and notable patterns

4. **Send the report summary via email** to the CFO at `cfo@acmecorp.com`:
   - Email system URL: http://localhost:5174/
   - Login credentials: username `peter`, password `password123`
   - Include a brief summary of the report in the email body
   - Mention the key findings and recommendations

5. **Update the report template policy** at `/workspace/policies/report_template.md`:
   - Add any improvements, notes, or lessons learned from this analysis cycle
   - Update the template version and date

## API Reference

### Finance System (http://localhost:1235)
- `POST /api/auth/login` - authenticate with `{"username": "admin", "password": "admin123"}` (sets session cookie)
- `GET /api/departments` - list all department financial records
- `GET /api/departments?month=YYYY-MM` - filter records by month

### Email System (http://localhost:5174)
- `POST /api/auth/login` - authenticate with `{"username": "peter", "password": "password123"}` (returns Bearer token)
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
- The report must use real data retrieved from the finance API, not placeholder values
- Include all 6 departments in the analysis (Engineering, Sales, Marketing, HR, Finance, Operations)
- The report should cover all three months of Q1 2026
