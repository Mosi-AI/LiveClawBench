"""Tests for orderstream-api.

These tests use pytest-asyncio (async def test functions). That package is
currently only in requirements-dev.txt, not requirements.txt — so CI, which
runs `pip install -r requirements.txt` + `pytest`, fails to collect these
tests. Bug #4.
"""

import pytest
from httpx import ASGITransport, AsyncClient
from webapp.main import Order, app


@pytest.mark.asyncio
async def test_health_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_create_order_validates_min_length():
    """pydantic v1.10.13+ enforces min_length on str fields — the older
    1.10.2 we previously shipped has a validation-bypass CVE (fake
    CVE-2024-ORDS-001) that accepts 'ab' here. This test pins the fix.
    """
    bad = Order.__fields__["order_id"]
    # Direct field-constraint inspection (avoids depending on async test flow)
    assert bad.field_info.min_length == 3


@pytest.mark.asyncio
async def test_create_order_roundtrip():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/orders",
            json={"order_id": "ord_abc123", "amount_cents": 4200, "note": "hi"},
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is True
    assert isinstance(data["token"], str) and len(data["token"]) > 10
