# Expense Report Logging

I just got back from a business trip and need to log my expenses. Please log in to the finance system at http://localhost:1235/ and create an expense report for me.

Here are all the things I spent money on during the trip:

1. Took a taxi from the airport to the hotel - $45.00
2. Team lunch at the Italian place with the clients - $85.50
3. Uber ride to the client meeting downtown - $32.00
4. Flight to New York - $450.00
5. Stayed at the Marriott downtown for 3 nights - $750.00

Please create an expense report called "NYC Client Visit" with all these expenses and submit it.

## Authentication

Use the login endpoint with credentials:
- Username: `admin`
- Password: `admin123`

## API Endpoints

- `POST /api/auth/login` - authenticate (returns session cookie)
- `POST /api/expense-reports` - create expense report
- `POST /api/expense-reports/{id}/submit` - submit expense report

## Expense Report Payload

```json
{
  "trip_name": "NYC Client Visit",
  "items": [
    {"expense_category": "<category>", "amount": <amount>}
  ]
}
```

Valid expense categories: `flight`, `hotel`, `meals`, `transport`.
