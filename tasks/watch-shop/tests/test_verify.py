import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import verify as v


def test_full_score(tmp_path):
    orders = [
        {
            "order_id": "ORD000008",
            "items": [{"id": "prod_0068"}],
            "status": "Pending Shipment",
        }
    ]
    orders_path = tmp_path / "mosi_shop_orders.json"
    orders_path.write_text(json.dumps(orders))
    assert (
        v.compute_score(str(orders_path), str(tmp_path / "nonexistent_cart.json"))
        == 1.0
    )


def test_partial_score_cart_only(tmp_path):
    cart = [{"id": "prod_0068"}]
    cart_path = tmp_path / "mosi_shop_cart.json"
    cart_path.write_text(json.dumps(cart))
    assert (
        v.compute_score(str(tmp_path / "nonexistent_orders.json"), str(cart_path))
        == 0.5
    )


def test_zero_score(tmp_path):
    assert (
        v.compute_score(
            str(tmp_path / "nonexistent_orders.json"),
            str(tmp_path / "nonexistent_cart.json"),
        )
        == 0.0
    )


def test_wrong_product_id(tmp_path):
    orders = [
        {
            "order_id": "ORD000008",
            "items": [{"id": "prod_0001"}],
            "status": "Pending Shipment",
        }
    ]
    orders_path = tmp_path / "mosi_shop_orders.json"
    orders_path.write_text(json.dumps(orders))
    assert (
        v.compute_score(str(orders_path), str(tmp_path / "nonexistent_cart.json"))
        == 0.0
    )
