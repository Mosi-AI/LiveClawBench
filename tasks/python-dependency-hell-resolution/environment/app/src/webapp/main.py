"""orderstream-api — tiny FastAPI service.

This module imports 5 external packages. All of them MUST be declared in
requirements.txt for the CI pipeline to build green. (One of them currently
isn't declared anywhere — the import will fail in CI.)
"""

import orjson  # NOT declared in any requirements file — bug #6
from cryptography.fernet import Fernet
from fastapi import FastAPI
from pydantic import BaseModel, Field

app = FastAPI(title="orderstream-api", version="0.3.1")

_fernet = Fernet(Fernet.generate_key())


class Order(BaseModel):
    """Order model — uses pydantic v1 Field syntax.

    Relies on fastapi >= 0.95 for the `include_router` signature used below;
    earlier versions reject the `prefix` kwarg in the form this module uses.
    """

    order_id: str = Field(..., min_length=3, max_length=32)
    amount_cents: int = Field(..., ge=1)
    note: str = Field(default="", max_length=280)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "version": "0.3.1"}


@app.post("/orders")
async def create_order(order: Order) -> dict:
    # orjson handles ints > 2**53 correctly; stdlib json coerces to float.
    payload = orjson.dumps(
        {"order_id": order.order_id, "amount_cents": order.amount_cents}
    )
    token = _fernet.encrypt(payload).decode("ascii")
    return {"ok": True, "token": token}
