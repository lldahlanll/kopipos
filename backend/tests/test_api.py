from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "app": "KopiPOS"}

def test_login_invalid_credentials():
    response = client.post("/api/auth/login", json={"email": "wrong@kopipos.com", "password": "wrongpassword"})
    assert response.status_code == 401
    assert "salah" in response.json()["detail"].lower()


from app.database import SessionLocal
from app.models import User
from app.utils.auth import create_access_token, hash_password

def get_or_create_test_user(email: str, role: str) -> User:
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            user = User(name=f"Test {role}", email=email, password_hash=hash_password("password123"), role=role)
            db.add(user)
            db.commit()
            db.refresh(user)
        return user
    finally:
        db.close()

def test_kitchen_role_restrictions():
    kitchen_user = get_or_create_test_user("test_kitchen@kopipos.com", "kitchen")
    token = create_access_token(data={"sub": str(kitchen_user.id), "role": kitchen_user.role})
    headers = {"Authorization": f"Bearer {token}"}

    # Kitchen should be forbidden from accessing POS endpoints like categories or creating orders
    res_cat = client.get("/api/categories", headers=headers)
    assert res_cat.status_code == 403
    assert "Akses ditolak" in res_cat.json()["detail"]

    res_order = client.post("/api/orders", json={"order_type": "dine_in", "payment_method": "cash", "items": []}, headers=headers)
    assert res_order.status_code == 403

    # Kitchen should be allowed to access active kitchen orders
    res_kds = client.get("/api/orders/kitchen/active", headers=headers)
    assert res_kds.status_code == 200


def test_order_modifiers_validation_and_snapshots():
    # Get cashier user token
    cashier_user = get_or_create_test_user("test_cashier@kopipos.com", "cashier")
    token = create_access_token(data={"sub": str(cashier_user.id), "role": cashier_user.role})
    headers = {"Authorization": f"Bearer {token}"}

    # 1. We must open a shift first if not opened
    db = SessionLocal()
    try:
        from app.models import Shift
        shift = db.query(Shift).filter(Shift.cashier_id == cashier_user.id, Shift.status == "open").first()
        if not shift:
            shift = Shift(cashier_id=cashier_user.id, opening_balance=100000.0, status="open")
            db.add(shift)
            db.commit()
    finally:
        db.close()

    # 2. Try to checkout with invalid modifier (e.g. empty radio selection for a required group like Size)
    # Es Kopi Susu Aren Spesial is product_id = 1 (seeded).
    payload_invalid = {
        "order_type": "dine_in",
        "payment_method": "cash",
        "items": [
            {
                "product_id": 1,
                "quantity": 1,
                "modifier_ids": []
            }
        ]
    }
    res = client.post("/api/orders", json=payload_invalid, headers=headers)
    assert res.status_code == 400
    assert "wajib memilih 1 opsi" in res.json()["detail"].lower()

    # 3. Post with valid modifiers: Regular Size and Normal Sugar
    db = SessionLocal()
    try:
        from app.models import Modifier, Product
        p = db.query(Product).filter(Product.name == "Es Kopi Susu Aren Spesial").first()
        assert p is not None
        
        mod_reg = db.query(Modifier).filter(Modifier.name == "Regular").first()
        mod_sug = db.query(Modifier).filter(Modifier.name == "Normal Sugar").first()
        
        assert mod_reg is not None
        assert mod_sug is not None
        
        payload_valid = {
            "order_type": "dine_in",
            "payment_method": "cash",
            "customer_name": "Test Customer",
            "notes": "Testing",
            "items": [
                {
                    "product_id": p.id,
                    "quantity": 2,
                    "modifier_ids": [mod_reg.id, mod_sug.id]
                }
            ]
        }
    finally:
        db.close()

    res_valid = client.post("/api/orders", json=payload_valid, headers=headers)
    assert res_valid.status_code == 201
    order_data = res_valid.json()
    assert order_data["customer_name"] == "Test Customer"
    assert len(order_data["items"]) == 1
    
    item = order_data["items"][0]
    assert item["product_name"] == "Es Kopi Susu Aren Spesial"
    assert item["base_price"] == 22000.0
    assert item["unit_price"] == 22000.0 # regular (0) + normal sugar (0) = 22000
    assert item["subtotal"] == 44000.0   # 22000 * 2
    assert len(item["modifiers"]) == 2


def test_public_endpoints_and_checkout():
    # 1. Test /api/public/store-info
    res_info = client.get("/api/public/store-info")
    assert res_info.status_code == 200
    data_info = res_info.json()
    assert "store_name" in data_info
    assert "store_logo" in data_info
    assert "theme_color" in data_info

    # 2. Test /api/public/menu and verify variants mapping
    res_menu = client.get("/api/public/menu")
    assert res_menu.status_code == 200
    data_menu = res_menu.json()
    assert "categories" in data_menu
    assert "products" in data_menu
    assert "modifiers" in data_menu
    
    # Verify that products have variants and modifiers lists populated
    kopi_susu = next((p for p in data_menu["products"] if p["name"] == "Es Kopi Susu Aren Spesial"), None)
    assert kopi_susu is not None
    assert "variants" in kopi_susu
    assert "modifiers" in kopi_susu
    assert len(kopi_susu["variants"]) > 0
    assert len(kopi_susu["modifiers"]) > 0

    size_mod = kopi_susu["variants"][0]
    sugar_mod = kopi_susu["modifiers"][0]

    # 3. Test /api/public/validate-session
    res_session = client.get("/api/public/validate-session?table=1&token=xyz")
    assert res_session.status_code == 200
    data_session = res_session.json()
    assert data_session["status"] == "success"
    assert data_session["valid"] is True

    # 4. Register a member to do the checkout
    import uuid
    random_phone = f"0812345{uuid.uuid4().hex[:5]}"
    # Clean the random phone string to only digits as expected by register_member
    random_phone = "".join(ch for ch in random_phone if ch.isdigit())
    if len(random_phone) > 15:
        random_phone = random_phone[:15]
    elif len(random_phone) < 9:
        random_phone = random_phone + "12345"

    res_reg = client.post("/api/member/register", json={
        "name": "Self Order Test Customer",
        "phone": random_phone,
        "pin": "123456"
    })
    assert res_reg.status_code == 201
    token = res_reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 5. Place order using variant_id (representing size) and modifier_ids
    order_payload = {
        "customer_name": "Test Customer",
        "order_type": "dine_in",
        "payment_method": "cash",
        "items": [
            {
                "product_id": kopi_susu["id"],
                "quantity": 1,
                "variant_id": size_mod["id"],
                "modifier_ids": [sugar_mod["id"]]
            }
        ]
    }
    res_order = client.post("/api/public/orders", json=order_payload, headers=headers)
    assert res_order.status_code == 201
    order_data = res_order.json()
    assert order_data["status"] == "pending"

    # 6. Verify the order items and their modifiers directly from the database
    from app.database import SessionLocal
    db = SessionLocal()
    try:
        from app.models import Order
        order = db.query(Order).filter(Order.id == order_data["id"]).first()
        assert order is not None
        assert len(order.items) == 1
        item = order.items[0]
        assert item.product_id == kopi_susu["id"]
        assert len(item.modifiers) == 2
        mod_names = {m.modifier_name for m in item.modifiers}
        assert size_mod["name"] in mod_names
        assert sugar_mod["name"] in mod_names
    finally:
        db.close()

    # 7. Test /api/public/orders to retrieve the member's orders
    res_orders = client.get("/api/public/orders", headers=headers)
    assert res_orders.status_code == 200
    orders_list = res_orders.json()
    assert len(orders_list) >= 1
    assert orders_list[0]["id"] == order_data["id"]
    assert orders_list[0]["status"] == "pending"


def test_shift_details_and_reconciliation():
    # 1. Get cashier user token
    cashier_user = get_or_create_test_user("test_cashier@kopipos.com", "cashier")
    token = create_access_token(data={"sub": str(cashier_user.id), "role": cashier_user.role})
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Make sure any current shift is closed
    db = SessionLocal()
    try:
        from app.models import Shift
        active = db.query(Shift).filter(Shift.cashier_id == cashier_user.id, Shift.status == "open").first()
        if active:
            active.status = "closed"
            db.commit()
    finally:
        db.close()

    # 3. Start a new shift
    res_start = client.post("/api/shifts/start", json={"opening_balance": 150000.0}, headers=headers)
    assert res_start.status_code == 200
    shift_id = res_start.json()["id"]

    # 4. Add a cash paid order
    # Let's create an order associated with this shift
    # ES Kopi Susu Aren Spesial product_id = 1, regular modifier = 2, normal sugar = 5 (typical seeds)
    # We can just check out using the public/member or normal cashier endpoint
    # First, let's look up modifier ids for the seeded product 1 to checkout correctly
    db = SessionLocal()
    try:
        from app.models import Modifier, Product
        p = db.query(Product).filter(Product.name == "Es Kopi Susu Aren Spesial").first()
        mod_reg = db.query(Modifier).filter(Modifier.name == "Regular").first()
        mod_sug = db.query(Modifier).filter(Modifier.name == "Normal Sugar").first()
        
        payload = {
            "order_type": "dine_in",
            "payment_method": "cash",
            "customer_name": "Shift Tester",
            "items": [
                {
                    "product_id": p.id,
                    "quantity": 1,
                    "modifier_ids": [mod_reg.id, mod_sug.id]
                }
            ]
        }
    finally:
        db.close()

    res_order = client.post("/api/orders", json=payload, headers=headers)
    assert res_order.status_code == 201
    order_total = res_order.json()["total"]

    # 5. Add an expense
    res_expense = client.post(f"/api/shifts/{shift_id}/expenses", json={"amount": 25000.0, "description": "Beli tissue"}, headers=headers)
    assert res_expense.status_code == 200

    # 6. Retrieve active shift and verify calculations
    res_active = client.get("/api/shifts/active", headers=headers)
    assert res_active.status_code == 200
    active_data = res_active.json()
    
    assert active_data["opening_balance"] == 150000.0
    assert active_data["cash_sales"] == order_total
    assert active_data["total_expenses"] == 25000.0
    assert len(active_data["expenses"]) == 1
    assert active_data["expenses"][0]["amount"] == 25000.0
    assert active_data["expenses"][0]["description"] == "Beli tissue"

    # 7. End the shift
    res_end = client.post(f"/api/shifts/{shift_id}/end", json={"closing_actual": 140000.0}, headers=headers)
    assert res_end.status_code == 200
    end_data = res_end.json()
    assert end_data["status"] == "closed"
    assert end_data["closing_expected"] == 150000.0 + order_total - 25000.0
    assert end_data["closing_actual"] == 140000.0


def test_midtrans_self_order_checkout_and_callback():
    from unittest.mock import patch
    
    # 1. Register member & get headers
    import uuid
    random_phone = f"0812345{uuid.uuid4().hex[:5]}"
    random_phone = "".join(ch for ch in random_phone if ch.isdigit())
    if len(random_phone) > 15:
        random_phone = random_phone[:15]
    elif len(random_phone) < 9:
        random_phone = random_phone + "12345"
        
    res_reg = client.post("/api/member/register", json={
        "name": "Midtrans Test Customer",
        "phone": random_phone,
        "pin": "123456"
    })
    token = res_reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Get product & variants for payload
    res_menu = client.get("/api/public/menu")
    p = res_menu.json()["products"][0]
    variant_id = p["variants"][0]["id"] if p.get("variants") else None
    modifier_ids = [p["modifiers"][0]["id"]] if p.get("modifiers") else []
    
    payload = {
        "customer_name": "Midtrans Test Customer",
        "order_type": "dine_in",
        "payment_method": "qris",
        "items": [
            {
                "product_id": p["id"],
                "quantity": 1,
                "variant_id": variant_id,
                "modifier_ids": modifier_ids
            }
        ]
    }

    # 2. Mock MidtransService.create_transaction and submit checkout
    mock_response = {
        "token": "test-snap-token-123",
        "redirect_url": "https://app.sandbox.midtrans.com/snap/v2/vtweb/test-snap-token-123"
    }
    
    with patch("app.services.MidtransService.create_transaction", return_value=mock_response) as mock_create:
        res_checkout = client.post("/api/public/orders", json=payload, headers=headers)
        assert res_checkout.status_code == 201
        order_data = res_checkout.json()
        assert order_data["status"] == "pending"
        assert order_data["payment_token"] == "test-snap-token-123"
        assert order_data["payment_url"] == "https://app.sandbox.midtrans.com/snap/v2/vtweb/test-snap-token-123"
        mock_create.assert_called_once()
        
        # Verify customer_details and item_details were passed to Midtrans
        kwargs = mock_create.call_args[1]
        assert "customer_details" in kwargs
        assert "item_details" in kwargs
        assert kwargs["customer_details"]["first_name"] == "Midtrans Test Customer"
        assert len(kwargs["item_details"]) > 0

    # 3. Simulate callback from Midtrans
    from app.config import settings
    import hashlib
    
    test_server_key = "test_server_key_123"
    settings.MIDTRANS_SERVER_KEY = test_server_key
    
    order_number = order_data["order_number"]
    status_code = "200"
    gross_amount = str(float(order_data["total"]))
    
    # Calculate signature: order_id + status_code + gross_amount + server_key
    raw_str = f"{order_number}{status_code}{gross_amount}{test_server_key}"
    signature_key = hashlib.sha512(raw_str.encode("utf-8")).hexdigest()
    
    callback_payload = {
        "order_id": order_number,
        "status_code": status_code,
        "gross_amount": gross_amount,
        "signature_key": signature_key,
        "transaction_status": "settlement",
        "payment_type": "gopay",
        "transaction_id": "test-transaction-id-abc"
    }
    
    res_callback = client.post("/api/public/payments/midtrans-callback", json=callback_payload)
    assert res_callback.status_code == 200
    assert res_callback.json() == {"status": "success", "message": "Callback processed"}

    # 4. Verify order status has changed to confirmed
    res_status = client.get(f"/api/public/orders/{order_data['id']}/status", headers=headers)
    assert res_status.status_code == 200
    assert res_status.json()["status"] == "confirmed"


def test_self_order_dine_in_payment_restrictions():
    # 1. Register member & get headers
    import uuid
    random_phone = f"0812345{uuid.uuid4().hex[:5]}"
    random_phone = "".join(ch for ch in random_phone if ch.isdigit())
    if len(random_phone) > 15:
        random_phone = random_phone[:15]
    elif len(random_phone) < 9:
        random_phone = random_phone + "12345"
        
    res_reg = client.post("/api/member/register", json={
        "name": "Restriction Customer",
        "phone": random_phone,
        "pin": "123456"
    })
    token = res_reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    res_menu = client.get("/api/public/menu")
    p = res_menu.json()["products"][0]
    variant_id = p["variants"][0]["id"] if p.get("variants") else None
    
    # 2. Try to checkout with dine_in & cashier payment method
    payload_invalid = {
        "customer_name": "Restriction Customer",
        "order_type": "dine_in",
        "payment_method": "cashier",
        "items": [
            {
                "product_id": p["id"],
                "quantity": 1,
                "variant_id": variant_id
            }
        ]
    }
    
    res = client.post("/api/public/orders", json=payload_invalid, headers=headers)
    assert res.status_code == 400
    assert "tidak diperbolehkan untuk Dine In" in res.json()["detail"]


def test_cashier_self_order_integration():
    from app.database import SessionLocal
    from app.models import Shift, Order, Member
    from unittest.mock import patch
    import uuid

    # 1. Setup Cashier and active shift
    cashier_user = get_or_create_test_user("test_cashier_integration@kopipos.com", "cashier")
    cashier_token = create_access_token(data={"sub": str(cashier_user.id), "role": cashier_user.role})
    cashier_headers = {"Authorization": f"Bearer {cashier_token}"}

    db = SessionLocal()
    try:
        shift = db.query(Shift).filter(Shift.cashier_id == cashier_user.id, Shift.status == "open").first()
        if not shift:
            shift = Shift(cashier_id=cashier_user.id, opening_balance=100000.0, status="open")
            db.add(shift)
            db.commit()
    finally:
        db.close()

    # Register member for self-order
    import random
    random_phone = f"08123456{random.randint(100, 999)}"
    res_reg = client.post("/api/member/register", json={
        "name": "Integration Customer",
        "phone": random_phone,
        "pin": "123456"
    })
    member_token = res_reg.json()["access_token"]
    member_headers = {"Authorization": f"Bearer {member_token}"}

    res_menu = client.get("/api/public/menu")
    p = res_menu.json()["products"][0]
    variant_id = p["variants"][0]["id"] if p.get("variants") else None
    modifier_ids = [p["modifiers"][0]["id"]] if p.get("modifiers") else []

    # 2. Create QRIS pending order
    qris_payload = {
        "customer_name": "Integration Customer",
        "order_type": "takeaway",
        "payment_method": "qris",
        "items": [{
            "product_id": p["id"],
            "quantity": 1,
            "variant_id": variant_id,
            "modifier_ids": modifier_ids
        }]
    }
    
    mock_response = {
        "token": "snap-tok-1",
        "redirect_url": "https://midtrans.com/snap-tok-1"
    }
    with patch("app.services.MidtransService.create_transaction", return_value=mock_response):
        res_checkout_qris = client.post("/api/public/orders", json=qris_payload, headers=member_headers)
        if res_checkout_qris.status_code != 201:
            print("Checkout failed: ", res_checkout_qris.json())
        assert res_checkout_qris.status_code == 201
        qris_order = res_checkout_qris.json()

    # 3. Create Cashier pending order
    cashier_payload = {
        "customer_name": "Integration Customer",
        "order_type": "takeaway",
        "payment_method": "cashier",
        "items": [{
            "product_id": p["id"],
            "quantity": 1,
            "variant_id": variant_id,
            "modifier_ids": modifier_ids
        }]
    }
    res_checkout_cashier = client.post("/api/public/orders", json=cashier_payload, headers=member_headers)
    assert res_checkout_cashier.status_code == 201
    cashier_order = res_checkout_cashier.json()

    # 4. Check incoming pending orders in cashier screen
    res_incoming = client.get("/api/orders/incoming/pending", headers=cashier_headers)
    assert res_incoming.status_code == 200
    incoming_ids = [o["id"] for o in res_incoming.json()]
    
    # Cashier pending order should be in the list
    assert cashier_order["id"] in incoming_ids
    # QRIS pending order should NOT be in the list (since payment is not completed yet)
    assert qris_order["id"] not in incoming_ids

    # 5. Simulate Midtrans success callback to confirm QRIS order
    from app.config import settings
    import hashlib
    test_server_key = "test_server_key_123"
    settings.MIDTRANS_SERVER_KEY = test_server_key
    order_number = qris_order["order_number"]
    status_code = "200"
    gross_amount = str(float(qris_order["total"]))
    raw_str = f"{order_number}{status_code}{gross_amount}{test_server_key}"
    sig = hashlib.sha512(raw_str.encode("utf-8")).hexdigest()
    
    callback_payload = {
        "order_id": order_number,
        "status_code": status_code,
        "gross_amount": gross_amount,
        "signature_key": sig,
        "transaction_status": "settlement",
        "payment_type": "gopay",
        "transaction_id": "tx-123"
    }
    res_callback = client.post("/api/public/payments/midtrans-callback", json=callback_payload)
    assert res_callback.status_code == 200

    # 6. Verify cashier can view the QRIS order (source == self_order) in list_orders
    res_list = client.get("/api/orders", headers=cashier_headers)
    assert res_list.status_code == 200
    list_ids = [o["id"] for o in res_list.json()]
    assert qris_order["id"] in list_ids

    # 7. Cashier completes/hands over the QRIS order
    res_status = client.patch(f"/api/orders/{qris_order['id']}/status?status=paid", headers=cashier_headers)
    assert res_status.status_code == 200
    updated_order = res_status.json()
    assert updated_order["status"] == "paid"
    assert updated_order["cashier_id"] == cashier_user.id
    assert updated_order["shift_id"] is not None


def test_member_points_lifecycle():
    from unittest.mock import patch
    import uuid
    import hashlib
    from app.database import SessionLocal
    from app.models import Member, User, Order

    # 1. Register member
    random_phone = f"0812347{uuid.uuid4().hex[:5]}"
    random_phone = "".join(ch for ch in random_phone if ch.isdigit())[:15]
    res_reg = client.post("/api/member/register", json={
        "name": "Points Lifecycle Customer",
        "phone": random_phone,
        "pin": "123456"
    })
    assert res_reg.status_code == 201
    token = res_reg.json()["access_token"]
    member_headers = {"Authorization": f"Bearer {token}"}

    # Set member points to 100 in database
    db = SessionLocal()
    try:
        member = db.query(Member).filter(Member.phone == random_phone).first()
        member_id = member.id
        member.points = 100
        db.commit()
    finally:
        db.close()

    # Get product for payload
    res_menu = client.get("/api/public/menu")
    p = res_menu.json()["products"][0]
    variant_id = p["variants"][0]["id"] if p.get("variants") else None
    modifier_ids = [p["modifiers"][0]["id"]] if p.get("modifiers") else []

    payload = {
        "customer_name": "Points Lifecycle Customer",
        "order_type": "dine_in",
        "payment_method": "qris",
        "redeem_points": 20,
        "items": [
            {
                "product_id": p["id"],
                "quantity": 2,
                "variant_id": variant_id,
                "modifier_ids": modifier_ids
            }
        ]
    }

    # 2. Mock Midtrans transaction creation & Submit Checkout
    mock_response = {
        "token": "token-lifecycle-123",
        "redirect_url": "https://app.sandbox.midtrans.com/snap/v2/vtweb/token-lifecycle-123"
    }
    with patch("app.services.MidtransService.create_transaction", return_value=mock_response):
        res_checkout = client.post("/api/public/orders", json=payload, headers=member_headers)
        assert res_checkout.status_code == 201
        order_data = res_checkout.json()
        assert order_data["status"] == "pending"

    # Check points after checkout: 20 points should be deducted, but earned points NOT added yet!
    db = SessionLocal()
    try:
        db_member = db.query(Member).filter(Member.id == member_id).first()
        assert db_member.points == 80
        db_order = db.query(Order).filter(Order.id == order_data["id"]).first()
        assert db_order.points_redeemed == 20
        earned = db_order.points_earned
        assert earned > 0
    finally:
        db.close()

    # 3. Simulate payment success (settlement callback)
    test_server_key = "test_server_key_123"
    from app.config import settings
    settings.MIDTRANS_SERVER_KEY = test_server_key
    order_number = order_data["order_number"]
    status_code = "200"
    gross_amount = str(float(order_data["total"]))
    raw_str = f"{order_number}{status_code}{gross_amount}{test_server_key}"
    sig = hashlib.sha512(raw_str.encode("utf-8")).hexdigest()

    callback_payload = {
        "order_id": order_number,
        "status_code": status_code,
        "gross_amount": gross_amount,
        "signature_key": sig,
        "transaction_status": "settlement",
        "payment_type": "gopay",
        "transaction_id": "tx-lifecycle-123"
    }
    res_callback = client.post("/api/public/payments/midtrans-callback", json=callback_payload)
    assert res_callback.status_code == 200

    # Points should now have the earned points added
    db = SessionLocal()
    try:
        db_member = db.query(Member).filter(Member.id == member_id).first()
        assert db_member.points == 80 + earned
    finally:
        db.close()

    # 4. Setup Owner and active shift to test voiding
    owner_user = get_or_create_test_user("test_owner_lifecycle@kopipos.com", "owner")
    db = SessionLocal()
    try:
        db_owner = db.query(User).filter(User.id == owner_user.id).first()
        db_owner.pin = "123456"
        db.commit()
    finally:
        db.close()

    # Get a cashier token to call cashier endpoints
    cashier_user = get_or_create_test_user("test_cashier_lifecycle@kopipos.com", "cashier")
    cashier_token = create_access_token(data={"sub": str(cashier_user.id), "role": cashier_user.role})
    cashier_headers = {"Authorization": f"Bearer {cashier_token}"}

    # Open shift for cashier to void
    from app.models import Shift
    db = SessionLocal()
    try:
        shift = db.query(Shift).filter(Shift.cashier_id == cashier_user.id, Shift.status == "open").first()
        if not shift:
            shift = Shift(cashier_id=cashier_user.id, opening_balance=100000.0, status="open")
            db.add(shift)
            db.commit()
        # Assign order to the cashier shift so void works
        db_order = db.query(Order).filter(Order.id == order_data["id"]).first()
        db_order.shift_id = shift.id
        db_order.cashier_id = cashier_user.id
        db.commit()
    finally:
        db.close()

    # Void the paid order
    res_void = client.post(f"/api/orders/{order_data['id']}/void", json={
        "supervisor_pin": "123456",
        "reason_code": "WRONG_ITEM",
        "notes": "Testing points refund on void"
    }, headers=cashier_headers)
    assert res_void.status_code == 200

    # Since order is voided:
    # 1. Earned points should be deducted.
    # 2. Redeemed points should be refunded.
    # Member points should return back to: (80 + earned) - earned + 20 = 100
    db = SessionLocal()
    try:
        db_member = db.query(Member).filter(Member.id == member_id).first()
        assert db_member.points == 100
    finally:
        db.close()

    # 5. Let's test points refund on transaction failure/cancellation
    payload_cancel = {
        "customer_name": "Points Lifecycle Customer",
        "order_type": "dine_in",
        "payment_method": "qris",
        "redeem_points": 15,
        "items": [
            {
                "product_id": p["id"],
                "quantity": 1,
                "variant_id": variant_id,
                "modifier_ids": modifier_ids
            }
        ]
    }
    with patch("app.services.MidtransService.create_transaction", return_value=mock_response):
        res_checkout_c = client.post("/api/public/orders", json=payload_cancel, headers=member_headers)
        assert res_checkout_c.status_code == 201
        order_cancel_data = res_checkout_c.json()

    # Member points should be: 100 - 15 = 85
    db = SessionLocal()
    try:
        db_member = db.query(Member).filter(Member.id == member_id).first()
        assert db_member.points == 85
    finally:
        db.close()

    # Send callback with "expire" status
    order_number_c = order_cancel_data["order_number"]
    gross_amount_c = str(float(order_cancel_data["total"]))
    raw_str_c = f"{order_number_c}407{gross_amount_c}{test_server_key}"
    sig_c = hashlib.sha512(raw_str_c.encode("utf-8")).hexdigest()

    callback_payload_c = {
        "order_id": order_number_c,
        "status_code": "407",
        "gross_amount": gross_amount_c,
        "signature_key": sig_c,
        "transaction_status": "expire",
        "payment_type": "gopay",
        "transaction_id": "tx-cancel-123"
    }
    res_callback_c = client.post("/api/public/payments/midtrans-callback", json=callback_payload_c)
    assert res_callback_c.status_code == 200

    # Since it expired, points should be refunded back: 85 + 15 = 100
    db = SessionLocal()
    try:
        db_member = db.query(Member).filter(Member.id == member_id).first()
        assert db_member.points == 100
    finally:
        db.close()








