#!/bin/bash
# Smoke test for all KopiPOS APIs
BASE="http://127.0.0.1:8000/api"
PASS=0
FAIL=0

check() {
    local desc="$1"
    local expected="$2"
    local actual="$3"
    if echo "$actual" | grep -q "$expected"; then
        echo "✅ $desc"
        PASS=$((PASS+1))
    else
        echo "❌ $desc"
        echo "   Expected: $expected"
        echo "   Got: $actual"
        FAIL=$((FAIL+1))
    fi
}

echo "=== 1. AUTH ==="
# Login as owner
OWNER_RES=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" -d '{"email":"owner@kopipos.com","password":"owner123"}')
OWNER_TOKEN=$(echo "$OWNER_RES" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])" 2>/dev/null)
check "Owner login" "access_token" "$OWNER_RES"

# Login as kasir
KASIR_RES=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" -d '{"email":"kasir@kopipos.com","password":"kasir123"}')
KASIR_TOKEN=$(echo "$KASIR_RES" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])" 2>/dev/null)
check "Kasir login" "access_token" "$KASIR_RES"

AUTH="Authorization: Bearer $OWNER_TOKEN"
KASIR_AUTH="Authorization: Bearer $KASIR_TOKEN"

echo ""
echo "=== 2. CATEGORIES ==="
# Create categories
C1=$(curl -s -X POST "$BASE/categories" -H "$AUTH" -H "Content-Type: application/json" -d '{"name":"Coffee"}')
check "Create category Coffee" "Coffee" "$C1"
C2=$(curl -s -X POST "$BASE/categories" -H "$AUTH" -H "Content-Type: application/json" -d '{"name":"Non-Coffee"}')
check "Create category Non-Coffee" "Non-Coffee" "$C2"
C3=$(curl -s -X POST "$BASE/categories" -H "$AUTH" -H "Content-Type: application/json" -d '{"name":"Snack"}')
check "Create category Snack" "Snack" "$C3"

# List categories
CATS=$(curl -s "$BASE/categories" -H "$AUTH")
check "List categories" "Coffee" "$CATS"

COFFEE_ID=$(echo "$C1" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)
NONCOFFEE_ID=$(echo "$C2" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)
SNACK_ID=$(echo "$C3" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)

echo ""
echo "=== 3. PRODUCTS ==="
# Create products
P1=$(curl -s -X POST "$BASE/products" -H "$AUTH" -H "Content-Type: application/json" -d "{\"category_id\":$COFFEE_ID,\"name\":\"Es Kopi Susu\",\"base_price\":22000,\"description\":\"Signature coffee\",\"variants\":[{\"name\":\"Ice\",\"price_adjustment\":0},{\"name\":\"Hot\",\"price_adjustment\":0},{\"name\":\"Large\",\"price_adjustment\":5000}]}")
check "Create Es Kopi Susu with variants" "Es Kopi Susu" "$P1"

P2=$(curl -s -X POST "$BASE/products" -H "$AUTH" -H "Content-Type: application/json" -d "{\"category_id\":$COFFEE_ID,\"name\":\"Americano\",\"base_price\":18000}")
check "Create Americano" "Americano" "$P2"

P3=$(curl -s -X POST "$BASE/products" -H "$AUTH" -H "Content-Type: application/json" -d "{\"category_id\":$NONCOFFEE_ID,\"name\":\"Matcha Latte\",\"base_price\":25000}")
check "Create Matcha Latte" "Matcha" "$P3"

P4=$(curl -s -X POST "$BASE/products" -H "$AUTH" -H "Content-Type: application/json" -d "{\"category_id\":$SNACK_ID,\"name\":\"Croissant\",\"base_price\":20000}")
check "Create Croissant" "Croissant" "$P4"

# List products
PRODS=$(curl -s "$BASE/products" -H "$AUTH")
check "List products" "Es Kopi Susu" "$PRODS"

# Search products
SEARCH=$(curl -s "$BASE/products?search=kopi" -H "$AUTH")
check "Search products 'kopi'" "Es Kopi Susu" "$SEARCH"

P1_ID=$(echo "$P1" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)
P2_ID=$(echo "$P2" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)
P4_ID=$(echo "$P4" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)

# Get product detail
DET=$(curl -s "$BASE/products/$P1_ID" -H "$AUTH")
check "Get product detail with variants" "Large" "$DET"

# Get variants
V1_ID=$(echo "$P1" | python3 -c "import sys,json; v=[x for x in json.load(sys.stdin).get('variants',[]) if x['name']=='Ice']; print(v[0]['id'] if v else 'null')" 2>/dev/null)
V3_ID=$(echo "$P1" | python3 -c "import sys,json; v=[x for x in json.load(sys.stdin).get('variants',[]) if x['name']=='Large']; print(v[0]['id'] if v else 'null')" 2>/dev/null)

echo ""
echo "=== 4. MODIFIERS ==="
M1=$(curl -s -X POST "$BASE/modifiers" -H "$AUTH" -H "Content-Type: application/json" -d '{"name":"Extra Shot","price_adjustment":5000}')
check "Create modifier Extra Shot" "Extra Shot" "$M1"
M2=$(curl -s -X POST "$BASE/modifiers" -H "$AUTH" -H "Content-Type: application/json" -d '{"name":"Less Sugar","price_adjustment":0}')
check "Create modifier Less Sugar" "Less Sugar" "$M2"

M1_ID=$(echo "$M1" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)
M2_ID=$(echo "$M2" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)

echo ""
echo "=== 5. ORDERS ==="
# Start shift as kasir
SHIFT=$(curl -s -X POST "$BASE/shifts/start" -H "$KASIR_AUTH" -H "Content-Type: application/json" -d '{"opening_balance":500000}')
check "Start shift (kasir)" "opening_balance" "$SHIFT"
SHIFT_ID=$(echo "$SHIFT" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)

# Create order as kasir
O1=$(curl -s -X POST "$BASE/orders" -H "$KASIR_AUTH" -H "Content-Type: application/json" -d "{\"order_type\":\"dine_in\",\"payment_method\":\"cash\",\"items\":[{\"product_id\":$P1_ID,\"quantity\":2,\"variant_id\":$V1_ID,\"modifier_ids\":[$M1_ID]},{\"product_id\":$P2_ID,\"quantity\":1}]}")
check "Create order (kasir)" "order_number" "$O1"

O1_ID=$(echo "$O1" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)
O1_TOTAL=$(echo "$O1" | python3 -c "import sys,json; print(json.load(sys.stdin)['total'])" 2>/dev/null)
echo "   Order total: Rp $O1_TOTAL (expect: 2*(22000+0+5000) + 1*18000 = 72000)"

# Create another order
O2=$(curl -s -X POST "$BASE/orders" -H "$KASIR_AUTH" -H "Content-Type: application/json" -d "{\"order_type\":\"takeaway\",\"payment_method\":\"qris\",\"items\":[{\"product_id\":$P1_ID,\"quantity\":1,\"variant_id\":$V3_ID},{\"product_id\":$P4_ID,\"quantity\":2}]}")
check "Create order 2 (takeaway/qris)" "order_number" "$O2"

# List orders
OL=$(curl -s "$BASE/orders" -H "$AUTH")
check "List orders" "order_number" "$OL"

# Get order detail
OD=$(curl -s "$BASE/orders/$O1_ID" -H "$AUTH")
check "Get order detail" "Es Kopi Susu" "$OD"

echo ""
echo "=== 6. REPORTS ==="
TODAY=$(date +%Y-%m-%d)
R1=$(curl -s "$BASE/reports/daily?date=$TODAY" -H "$AUTH")
check "Daily summary" "total_revenue" "$R1"
echo "   Daily: $R1"

R2=$(curl -s "$BASE/reports/payment-summary?date=$TODAY" -H "$AUTH")
check "Payment summary" "payment_method" "$R2"

R3=$(curl -s "$BASE/reports/best-sellers?date=$TODAY" -H "$AUTH")
check "Best sellers" "product_name" "$R3"

echo ""
echo "=== 7. SHIFTS (END) ==="
END_SHIFT=$(curl -s -X POST "$BASE/shifts/$SHIFT_ID/end" -H "$KASIR_AUTH" -H "Content-Type: application/json" -d '{"closing_actual":550000}')
check "End shift (kasir)" "closed" "$END_SHIFT"

echo ""
echo "==============================="
echo "Results: $PASS passed, $FAIL failed"
echo "==============================="
