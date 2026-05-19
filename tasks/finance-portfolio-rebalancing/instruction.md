# Portfolio Rebalancing

The CFO has set new target allocations for the company investment portfolio. Please log in to the finance system (http://localhost:1235/), review the current portfolio holdings, and rebalance the portfolio to the following targets:

- Equities: 45%
- Fixed Income: 30%
- Cash: 15%
- Alternatives: 10%

Do not place any order smaller than $1,000. Round all order amounts to the nearest dollar.

## Authentication

Use the login endpoint with credentials:
- Username: `admin`
- Password: `admin123`

## API Endpoints

- `POST /api/auth/login` — authenticate (returns session cookie)
- `GET /api/portfolio` — read current holdings
- `POST /api/portfolio/orders` — place an order

## Order Payload

```json
{
  "asset_class_code": "eq",
  "direction": "buy",
  "amount": 12500
}
```

Valid asset class codes: `eq` (Equities), `fi` (Fixed Income), `ca` (Cash), `al` (Alternatives).
Valid directions: `buy`, `sell`.
