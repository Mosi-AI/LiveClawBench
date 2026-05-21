# Microservice Stack

## Architecture

```
Browser → Nginx (:80) → Flask API → gRPC KV Store
```

## Services

### kv-store/ (gRPC Backend)
Key-value store service using gRPC. Proto file needs to be compiled before use.
Binds to port **9000** (migrated off 50051 in 2026-03 — see deploy log).

### api-server/ (Flask REST API)
REST API that communicates with the KV Store backend via gRPC.

**Endpoints:**
- `POST /api/set` — Store a key-value pair
- `GET /api/get?key=...` — Retrieve a value
- `GET /api/health` — Health check

### frontend/ (Static HTML)
Browser-based KV management interface.

## Deployment Notes (Last Updated: 2026-02)

> ⚠️ These notes may be outdated. The stack was originally deployed as Docker Compose services.
> If running as a single container, service hostnames won't resolve — you'll need to adjust
> connection addresses accordingly.

The original docker-compose setup used service names for inter-service communication.
Port assignments may have changed since the last deployment. Check each service's
startup for the actual port binding.

Nginx was previously configured by the platform team with a custom template.
The current config in `/etc/nginx/` may reflect the old multi-container setup.
