"""
Standalone E-Commerce Mock Backend Application
FastAPI backend service for product search and display
"""

import json
import os
import re
import tempfile
from collections import Counter
from datetime import datetime
from math import ceil
from typing import Any, Dict, List, Optional, Tuple

from fastapi import FastAPI, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel

app = FastAPI(
    title="E-Commerce Mosi Shop",
    description="E-Commerce Simulation API",
    version="1.0.0",
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files and templates
app.mount("/static", StaticFiles(directory="../frontend/static"), name="static")
templates = Jinja2Templates(directory="../frontend/templates")

# Configuration
PRODUCTS_PER_PAGE = 30
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend", "data")

# Temporary cart storage
CART_FILE = os.path.join(tempfile.gettempdir(), "mosi_shop_cart.json")

# User and Orders storage
USER_FILE = os.path.join(tempfile.gettempdir(), "mosi_shop_user.json")
ORDERS_FILE = os.path.join(tempfile.gettempdir(), "mosi_shop_orders.json")


class Product(BaseModel):
    """Product data model"""

    id: str
    title: str
    price: float
    rating: float
    rating_count: str
    image_url: str
    sponsored: bool = False
    best_seller: bool = False
    overall_pick: bool = False
    limited_time: bool = False
    discounted: bool = False
    low_stock: bool = False
    stock_quantity: Optional[int] = None


class CartItem(BaseModel):
    """Cart item model"""

    id: str
    title: str
    price: float
    rating: float
    image_url: str
    quantity: int = 1


class User(BaseModel):
    """User data model"""

    username: str
    gender: str
    address: str
    email: str = ""
    phone: str = ""


class OrderItem(BaseModel):
    """Order item model"""

    product_id: str
    title: str
    price: float
    quantity: int
    image_url: str


class Order(BaseModel):
    """Order data model"""

    order_id: str
    user_id: str
    items: List[OrderItem]
    total_amount: float
    status: str
    create_time: str
    shipping_address: str


def load_sample_products() -> List[Dict[str, Any]]:
    """Load sample product data"""
    sample_file = os.path.join(DATA_DIR, "sample_products.json")

    if not os.path.exists(sample_file):
        print(f"Sample data file not found: {sample_file}")
        return []

    try:
        with open(sample_file, "r", encoding="utf-8") as f:
            products = json.load(f)
            print(f"Successfully loaded {len(products)} products")
            return products
    except json.JSONDecodeError as e:
        print(f"JSON parsing error: {e}")
        return []
    except Exception as e:
        print(f"Data loading error: {e}")
        return []


def load_cart() -> List[Dict[str, Any]]:
    """Load cart from temporary file"""
    if os.path.exists(CART_FILE):
        try:
            with open(CART_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return []
    return []


def save_cart(cart: List[Dict[str, Any]]):
    """Save cart to temporary file"""
    with open(CART_FILE, "w", encoding="utf-8") as f:
        json.dump(cart, f, indent=2, ensure_ascii=False)


def clear_cart():
    """Clear cart file"""
    if os.path.exists(CART_FILE):
        os.remove(CART_FILE)


def initialize_user():
    """Initialize user data for Peter Griffin"""
    if not os.path.exists(USER_FILE):
        user_data = {
            "username": "Peter Griffin",
            "gender": "Male",
            "address": "1234 Innovation Drive, San Francisco, CA 94105, USA",
            "email": "peter.griffin@example.com",
            "phone": "11111111111",
            "payment_methods": [
                {
                    "type": "gift card",
                    "account": "GIFT-****-****-7892",
                    "balance": "$50.00",
                },
                {"type": "paypal account", "account": "peter.griffin@email.com"},
                {"type": "credit card", "account": "Visa ending in 4532"},
            ],
        }
        with open(USER_FILE, "w", encoding="utf-8") as f:
            json.dump(user_data, f, indent=2, ensure_ascii=False)
        return user_data

    try:
        with open(USER_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {
            "username": "Peter Griffin",
            "gender": "Male",
            "address": "1234 Innovation Drive, San Francisco, CA 94105, USA",
            "email": "peter.griffin@example.com",
            "phone": "11111111111",
            "payment_methods": [
                {
                    "type": "gift card",
                    "account": "GIFT-****-****-7892",
                    "balance": "$50.00",
                },
                {"type": "paypal account", "account": "peter.griffin@email.com"},
                {"type": "credit card", "account": "Visa ending in 4532"},
            ],
        }


def initialize_orders():
    """Initialize fixed orders for the user"""
    if not os.path.exists(ORDERS_FILE):
        # Load sample products to create orders
        all_products = load_sample_products()
        if not all_products:
            return []

        from datetime import datetime, timedelta

        # Create fixed orders with single items
        orders = []

        # Find specific products for diverse orders
        product_map = {p["id"]: p for p in all_products}

        # Select diverse products: stapler, toilet paper, washer
        # Order them so washer gets ORD000005 (3rd position when sorted by ID desc)
        # Order ID descending: ORD000007, ORD000006, ORD000005, ORD000004, ORD000003, ORD000002, ORD000001
        order_configs = [
            {
                "product_id": "prod_0009",
                "order_num": 7,
                "days_ago": 0,
                "status": "Delivered",
            },  # Stapler - ORD000007 (1st)
            {
                "product_id": "prod_0017",
                "order_num": 6,
                "days_ago": 1,
                "status": "Pending Shipment",
            },  # Toilet Paper - ORD000006 (2nd)
            {
                "product_id": "prod_0031",
                "order_num": 5,
                "days_ago": 2,
                "status": "Shipped",
            },  # Washer - ORD000005 (3rd)
            {
                "product_id": "prod_0015",
                "order_num": 4,
                "days_ago": 3,
                "status": "Delivered",
            },  # Stapler - ORD000004 (4th)
            {
                "product_id": "prod_0018",
                "order_num": 3,
                "days_ago": 5,
                "status": "Completed",
            },  # Toilet Paper - ORD000003 (5th)
            {
                "product_id": "prod_0020",
                "order_num": 2,
                "days_ago": 7,
                "status": "Pending Shipment",
            },  # Toilet Paper - ORD000002 (6th)
            {
                "product_id": "prod_0001",
                "order_num": 1,
                "days_ago": 10,
                "status": "Shipped",
            },  # Toothpaste - ORD000001 (7th)
        ]

        for config in order_configs:
            product_id = config["product_id"]
            if product_id not in product_map:
                continue

            product = product_map[product_id]
            order_date = datetime.now() - timedelta(days=config["days_ago"])

            # Each order contains only one item
            order_item = {
                "product_id": product["id"],
                "title": product["title"],
                "price": product["price"],
                "quantity": 1,
                "image_url": product["image_url"],
            }

            order = {
                "order_id": f"ORD{str(config['order_num']).zfill(6)}",
                "user_id": "Peter Griffin",
                "items": [order_item],
                "total_amount": round(product["price"], 2),
                "status": config["status"],
                "create_time": order_date.strftime("%Y-%m-%d %H:%M:%S"),
                "shipping_address": "1234 Innovation Drive, San Francisco, CA 94105, USA",
            }
            orders.append(order)

        # Sort by order_id (descending - newest/highest ID first)
        orders.sort(key=lambda x: x["order_id"], reverse=True)

        with open(ORDERS_FILE, "w", encoding="utf-8") as f:
            json.dump(orders, f, indent=2, ensure_ascii=False)

        return orders

    try:
        with open(ORDERS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


def calculate_relevance_score(product: Dict[str, Any], query: str) -> float:
    """
    Calculate relevance score for a product based on query.

    Scoring factors:
    1. Exact title match (100 points)
    2. Exact word matches in title (20 points each)
    3. Partial word matches in title (10 points each)
    4. Word frequency in title
    5. Word position in title (earlier = higher score)
    6. Rating boost (higher rating = higher score)
    7. Best seller / Overall pick bonus
    """
    if not query or not query.strip():
        return 0.0

    query_lower = query.lower().strip()
    title = product.get("title", "").lower()

    if not title:
        return 0.0

    score = 0.0

    # Exact title match
    if query_lower == title:
        score += 100.0

    # Tokenize query and title
    query_words = re.findall(r"\w+", query_lower)
    title_words = re.findall(r"\w+", title)

    if not query_words or not title_words:
        return score

    # Count word frequencies
    query_word_count = Counter(query_words)
    title_word_count = Counter(title_words)

    # Exact word matches
    matched_words = 0
    for q_word in query_words:
        if q_word in title_words:
            matched_words += 1
            # Position bonus: earlier in title = higher score
            positions = [i for i, t_word in enumerate(title_words) if t_word == q_word]
            if positions:
                position_bonus = max(
                    0, 10 - positions[0]
                )  # Max 10 points for first position
                score += 20 + position_bonus

    # Partial word matches (substring)
    for q_word in query_words:
        if len(q_word) >= 3:  # Only for words with 3+ chars
            for t_word in title_words:
                if q_word != t_word and q_word in t_word:
                    score += 10
                    break

    # Coverage: what percentage of query words are found
    coverage = matched_words / len(query_words) if query_words else 0
    score += coverage * 30

    # Word frequency boost: if query words appear multiple times
    for q_word in query_words:
        if q_word in title_word_count:
            freq = title_word_count[q_word]
            score += min(freq * 5, 20)  # Max 20 points per word

    # Product quality boosts
    rating = product.get("rating", 0)
    score += rating * 2  # Max ~10 points from rating

    if product.get("best_seller"):
        score += 15

    if product.get("overall_pick"):
        score += 15

    return score


def search_products(
    products: List[Dict[str, Any]], query: str, min_relevance: float = 10.0
) -> List[Tuple[Dict[str, Any], float]]:
    """
    Search products based on query and return products with relevance scores.

    Returns: List of (product, relevance_score) tuples
    """
    if not query or not query.strip():
        return [(p, 0.0) for p in products]

    scored_products = []

    for product in products:
        relevance = calculate_relevance_score(product, query)
        if relevance >= min_relevance:
            scored_products.append((product, relevance))

    # Sort by relevance score (descending)
    scored_products.sort(key=lambda x: x[1], reverse=True)

    return scored_products


def filter_and_sort_products(
    products: List[Dict[str, Any]],
    query: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    min_rating: Optional[float] = None,
    sort_by: str = "similarity",
    use_search: bool = True,
) -> List[Dict[str, Any]]:
    """
    Filter and sort products.

    Args:
        products: List of products to filter/sort
        query: Search query string
        min_price: Minimum price filter
        max_price: Maximum price filter
        min_rating: Minimum rating filter
        sort_by: Sort method ('similarity', 'price_asc', 'price_desc', 'rating')
        use_search: Whether to apply relevance search
    """

    # Step 1: Apply search if query provided
    if query and query.strip() and use_search:
        # Search and get relevance scores
        scored_products = search_products(products, query, min_relevance=10.0)
        # Extract just the products (without scores for now)
        products_with_scores = {p["id"]: score for p, score in scored_products}
        products = [p for p, score in scored_products]

        # If no results found, try with lower threshold
        if not products:
            scored_products = search_products(products, query, min_relevance=0.0)
            products_with_scores = {p["id"]: score for p, score in scored_products}
            products = [p for p, score in scored_products]
    else:
        products_with_scores = {}

    # Step 2: Apply filters
    if min_price is not None:
        products = [p for p in products if p.get("price", 0) >= min_price]
    if max_price is not None:
        products = [p for p in products if p.get("price", 0) <= max_price]
    if min_rating is not None:
        products = [p for p in products if p.get("rating", 0) >= min_rating]

    # Step 3: Sort
    if sort_by == "similarity":
        # Sort by relevance score (already sorted from search, but re-sort after filtering)
        if products_with_scores:
            products.sort(
                key=lambda x: products_with_scores.get(x["id"], 0), reverse=True
            )
        else:
            # Fallback: sort by rating if no search performed
            products.sort(key=lambda x: x.get("rating", 0), reverse=True)
    elif sort_by == "price_asc":
        products.sort(key=lambda x: x.get("price", 0))
    elif sort_by == "price_desc":
        products.sort(key=lambda x: x.get("price", 0), reverse=True)
    elif sort_by == "rating":
        products.sort(key=lambda x: x.get("rating", 0), reverse=True)

    return products


@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    """Home page - search interface"""
    return templates.TemplateResponse("search.html", {"request": request})


@app.get("/search", response_class=HTMLResponse)
async def search(
    request: Request,
    q: str = Query("", description="Search query"),
    sort: str = Query("similarity", description="Sort method"),
    page: int = Query(1, ge=1, description="Page number"),
    min_price: Optional[float] = Query(None, description="Minimum price"),
    max_price: Optional[float] = Query(None, description="Maximum price"),
    min_rating: Optional[float] = Query(None, description="Minimum rating"),
):
    """Search products page"""
    query = q
    sort_by = sort

    if query:
        # Load product data
        all_results = load_sample_products()

        # Filter and sort with search
        all_results = filter_and_sort_products(
            all_results,
            query=query,
            min_price=min_price,
            max_price=max_price,
            min_rating=min_rating,
            sort_by=sort_by,
            use_search=True,
        )

        # Pagination
        total_products = len(all_results)
        total_pages = (
            ceil(total_products / PRODUCTS_PER_PAGE) if total_products > 0 else 0
        )

        start_idx = (page - 1) * PRODUCTS_PER_PAGE
        end_idx = start_idx + PRODUCTS_PER_PAGE
        current_products = all_results[start_idx:end_idx]
    else:
        current_products = []
        total_pages = 0
        page = 1

    return templates.TemplateResponse(
        "results.html",
        {
            "request": request,
            "query": query,
            "products": current_products,
            "current_sort": sort_by,
            "current_page": page,
            "total_pages": total_pages,
            "min_price": min_price,
            "max_price": max_price,
            "min_rating": min_rating,
        },
    )


@app.get("/cart", response_class=HTMLResponse)
async def cart_page(request: Request):
    """Cart page"""
    cart_items = load_cart()
    total = sum(item["price"] * item["quantity"] for item in cart_items)

    return templates.TemplateResponse(
        "cart.html", {"request": request, "cart_items": cart_items, "total": total}
    )


@app.get("/api/products", response_class=JSONResponse)
async def get_products(
    q: str = Query("", description="Search query"),
    sort: str = Query("similarity", description="Sort method"),
    page: int = Query(1, ge=1, description="Page number"),
    min_price: Optional[float] = Query(None, description="Minimum price"),
    max_price: Optional[float] = Query(None, description="Maximum price"),
    min_rating: Optional[float] = Query(None, description="Minimum rating"),
):
    """Get product list API"""
    all_products = load_sample_products()

    # Filter and sort with search
    filtered_products = filter_and_sort_products(
        all_products,
        query=q,
        min_price=min_price,
        max_price=max_price,
        min_rating=min_rating,
        sort_by=sort,
        use_search=True,
    )

    # Pagination
    total_products = len(filtered_products)
    total_pages = ceil(total_products / PRODUCTS_PER_PAGE) if total_products > 0 else 0

    start_idx = (page - 1) * PRODUCTS_PER_PAGE
    end_idx = start_idx + PRODUCTS_PER_PAGE
    page_products = filtered_products[start_idx:end_idx]

    return {
        "products": page_products,
        "total_products": total_products,
        "total_pages": total_pages,
        "current_page": page,
        "products_per_page": PRODUCTS_PER_PAGE,
    }


@app.get("/api/product/{product_id}", response_class=JSONResponse)
async def get_product_detail(product_id: str):
    """Get single product detail API"""
    all_products = load_sample_products()

    for product in all_products:
        if product.get("id") == product_id:
            return product

    return {"error": "Product not found"}, 404


@app.post("/api/cart/add", response_class=JSONResponse)
async def add_to_cart(request: Request):
    """Add product to cart API"""
    body = await request.json()
    product_id = body.get("product_id")

    # Get product details
    all_products = load_sample_products()
    product = None
    for p in all_products:
        if p["id"] == product_id:
            product = p
            break

    if not product:
        return {"success": False, "message": "Product not found"}

    # Load current cart
    cart = load_cart()

    # Check if product already in cart
    existing_item = None
    for item in cart:
        if item["id"] == product_id:
            existing_item = item
            break

    if existing_item:
        # Update quantity
        existing_item["quantity"] += 1
    else:
        # Add new item
        cart.append(
            {
                "id": product["id"],
                "title": product["title"],
                "price": product["price"],
                "rating": product["rating"],
                "image_url": product["image_url"],
                "quantity": 1,
            }
        )

    # Save cart
    save_cart(cart)

    return {
        "success": True,
        "message": f"Added {product['title'][:50]}... to cart",
        "cart_count": sum(item["quantity"] for item in cart),
    }


@app.get("/api/cart", response_class=JSONResponse)
async def get_cart():
    """Get cart items API"""
    cart = load_cart()
    total = sum(item["price"] * item["quantity"] for item in cart)

    return {
        "items": cart,
        "total": total,
        "count": sum(item["quantity"] for item in cart),
    }


@app.delete("/api/cart/remove/{product_id}", response_class=JSONResponse)
async def remove_from_cart(product_id: str):
    """Remove product from cart API"""
    cart = load_cart()
    cart = [item for item in cart if item["id"] != product_id]
    save_cart(cart)

    return {
        "success": True,
        "message": "Item removed from cart",
        "cart_count": sum(item["quantity"] for item in cart),
    }


@app.put("/api/cart/update", response_class=JSONResponse)
async def update_cart_quantity(request: Request):
    """Update cart item quantity API"""
    body = await request.json()
    product_id = body.get("product_id")
    quantity = body.get("quantity", 1)

    cart = load_cart()

    for item in cart:
        if item["id"] == product_id:
            if quantity <= 0:
                cart.remove(item)
            else:
                item["quantity"] = quantity
            break

    save_cart(cart)

    return {
        "success": True,
        "message": "Cart updated",
        "cart_count": sum(item["quantity"] for item in cart),
    }


@app.post("/api/cart/clear", response_class=JSONResponse)
async def clear_cart_api():
    """Clear cart API"""
    clear_cart()
    return {"success": True, "message": "Cart cleared"}


@app.post("/api/checkout", response_class=JSONResponse)
async def checkout():
    """Checkout and create order from cart"""
    cart = load_cart()

    if not cart:
        return {"success": False, "message": "Cart is empty"}

    # Load existing orders
    orders = initialize_orders()

    # Get user info
    user = initialize_user()

    # Generate new order ID
    existing_ids = [int(o["order_id"].replace("ORD", "")) for o in orders]
    new_order_num = max(existing_ids) + 1 if existing_ids else 1
    order_id = f"ORD{str(new_order_num).zfill(6)}"

    # Create order from cart
    total_amount = sum(item["price"] * item["quantity"] for item in cart)

    order = {
        "order_id": order_id,
        "user_id": user["username"],
        "items": cart,
        "total_amount": round(total_amount, 2),
        "status": "Pending Shipment",  # New orders start as Pending Shipment
        "create_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "shipping_address": user.get(
            "address", "1234 Innovation Drive, San Francisco, CA 94105, USA"
        ),
    }

    orders.append(order)

    # Sort by order_id (descending - newest/highest ID first)
    orders.sort(key=lambda x: x["order_id"], reverse=True)

    # Save orders
    with open(ORDERS_FILE, "w", encoding="utf-8") as f:
        json.dump(orders, f, indent=2, ensure_ascii=False)

    # Clear cart
    clear_cart()

    return {
        "success": True,
        "message": "Order placed successfully!",
        "order_id": order_id,
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "shop-mosi-backend"}


@app.get("/api/user")
async def get_user():
    """Get current user info API"""
    user = initialize_user()
    return user


@app.post("/api/user/update", response_class=JSONResponse)
async def update_user(request: Request):
    """Update user information"""
    body = await request.json()
    field = body.get("field")
    value = body.get("value")

    if not field or not value:
        return {"success": False, "message": "Field and value are required"}

    # Load current user data
    user = initialize_user()

    # Validate field name
    allowed_fields = ["username", "gender", "email", "phone", "address"]
    if field not in allowed_fields:
        return {"success": False, "message": "Invalid field"}

    # Update field
    user[field] = value

    # Save updated user data
    with open(USER_FILE, "w", encoding="utf-8") as f:
        json.dump(user, f, indent=2, ensure_ascii=False)

    return {"success": True, "message": f"{field} updated successfully"}


@app.get("/api/orders")
async def get_orders():
    """Get user's order history API"""
    orders = initialize_orders()
    return {"orders": orders, "total": len(orders)}


@app.get("/profile", response_class=HTMLResponse)
async def profile_page(request: Request):
    """User profile page"""
    user = initialize_user()
    return templates.TemplateResponse(
        "profile.html", {"request": request, "user": user}
    )


@app.get("/orders", response_class=HTMLResponse)
async def orders_page(request: Request):
    """User orders history page"""
    user = initialize_user()
    orders = initialize_orders()
    return templates.TemplateResponse(
        "orders.html", {"request": request, "user": user, "orders": orders}
    )


@app.post("/api/orders/{order_id}/return", response_class=JSONResponse)
async def request_return(order_id: str):
    """Request return for an order"""
    orders = initialize_orders()

    # Find the order
    order_found = None
    for order in orders:
        if order["order_id"] == order_id:
            order_found = order
            break

    if not order_found:
        return {"success": False, "message": "Order not found"}

    # Check if order status allows return (Pending Shipment, Delivered, Shipped, or Completed)
    if order_found["status"] not in [
        "Pending Shipment",
        "Delivered",
        "Shipped",
        "Completed",
    ]:
        return {"success": False, "message": "This order cannot be returned"}

    # Update order status to 'Returning'
    order_found["status"] = "Returning"

    # Save updated orders
    with open(ORDERS_FILE, "w", encoding="utf-8") as f:
        json.dump(orders, f, indent=2, ensure_ascii=False)

    return {
        "success": True,
        "message": "Return request received. Customer service will contact you regarding the return.",
    }


@app.post("/api/orders/{order_id}/confirm", response_class=JSONResponse)
async def confirm_delivery(order_id: str):
    """Confirm delivery for an order"""
    orders = initialize_orders()

    # Find the order
    order_found = None
    for order in orders:
        if order["order_id"] == order_id:
            order_found = order
            break

    if not order_found:
        return {"success": False, "message": "Order not found"}

    # Check if order status is 'Delivered'
    if order_found["status"] != "Delivered":
        return {"success": False, "message": "Only delivered orders can be confirmed"}

    # Update order status to 'Completed'
    order_found["status"] = "Completed"

    # Save updated orders
    with open(ORDERS_FILE, "w", encoding="utf-8") as f:
        json.dump(orders, f, indent=2, ensure_ascii=False)

    return {"success": True, "message": "Order confirmed as completed."}


if __name__ == "__main__":
    import uvicorn

    print("=" * 60)
    print("E-Commerce Mosi Shop Backend")
    print("=" * 60)
    print(f"Data directory: {DATA_DIR}")
    print(f"Products per page: {PRODUCTS_PER_PAGE}")
    print(f"Cart file: {CART_FILE}")
    print("=" * 60)
    uvicorn.run("app:app", host="0.0.0.0", port=1234, reload=True)
