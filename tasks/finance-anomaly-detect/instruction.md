# Anomaly Detection

I've been reviewing our recent transactions and something feels off. A few entries look suspicious — duplicate charges, weird vendors, round-number amounts that don't match our typical spending patterns.

Could you log in to the finance system and take a look? Flag any transactions that seem anomalous.

## Authentication

Use the login endpoint with credentials:
- Username: `admin`
- Password: `admin123`

## API Endpoints

- `POST /api/auth/login` -- authenticate (returns session cookie)
- `GET /api/transactions` -- list all transactions
- `GET /api/transactions/{id}` -- get transaction detail
- `POST /api/transactions/{id}/flag` -- flag a suspicious transaction

## Finance System URL

http://localhost:1235/
