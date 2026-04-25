#!/bin/bash
# End-to-end test suite for LedgerLite
# Requires: all services running (docker compose up -d --build OR dev mode)
# Usage: ./e2e-test.sh

set -e

BASE_URL=${BASE_URL:-http://localhost:8080}
PASS=0
FAIL=0

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

assert_status() {
    local test_name="$1"
    local expected="$2"
    local actual="$3"
    if [ "$actual" = "$expected" ]; then
        echo -e "  ${GREEN}PASS${NC} $test_name (HTTP $actual)"
        PASS=$((PASS + 1))
    else
        echo -e "  ${RED}FAIL${NC} $test_name (expected HTTP $expected, got HTTP $actual)"
        FAIL=$((FAIL + 1))
    fi
}

assert_json_field() {
    local test_name="$1"
    local json="$2"
    local field="$3"
    local expected="$4"
    local actual=$(echo "$json" | python3 -c "import sys,json; print(json.load(sys.stdin).get('$field',''))" 2>/dev/null)
    if [ "$actual" = "$expected" ]; then
        echo -e "  ${GREEN}PASS${NC} $test_name ($field=$actual)"
        PASS=$((PASS + 1))
    else
        echo -e "  ${RED}FAIL${NC} $test_name (expected $field=$expected, got $field=$actual)"
        FAIL=$((FAIL + 1))
    fi
}

assert_not_empty() {
    local test_name="$1"
    local value="$2"
    if [ -n "$value" ] && [ "$value" != "None" ] && [ "$value" != "null" ]; then
        echo -e "  ${GREEN}PASS${NC} $test_name"
        PASS=$((PASS + 1))
    else
        echo -e "  ${RED}FAIL${NC} $test_name (value was empty)"
        FAIL=$((FAIL + 1))
    fi
}

EMAIL="e2e-$(date +%s)@test.com"
PASSWORD="testpass123"

echo "============================================"
echo "  LedgerLite End-to-End Test Suite"
echo "  Target: $BASE_URL"
echo "============================================"
echo ""

# --- Auth Service ---
echo "--- Auth Service ---"

# Register
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')
assert_status "Register new user" "201" "$HTTP_CODE"
USER_ID=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)
assert_not_empty "Register returns user ID" "$USER_ID"

# Duplicate registration
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
assert_status "Duplicate registration rejected" "409" "$HTTP_CODE"

# Validation error
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/auth/register" \
    -H "Content-Type: application/json" \
    -d '{"email":"bad","password":"short"}')
assert_status "Invalid registration rejected" "400" "$HTTP_CODE"

# Login
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')
assert_status "Login" "200" "$HTTP_CODE"
TOKEN=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])" 2>/dev/null)
assert_not_empty "Login returns JWT token" "$TOKEN"

# Wrong password
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"wrongpassword\"}")
assert_status "Wrong password rejected" "401" "$HTTP_CODE"

# Get current user
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/auth/me" \
    -H "Authorization: Bearer $TOKEN")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')
assert_status "Get current user" "200" "$HTTP_CODE"
assert_json_field "Current user email matches" "$BODY" "email" "$EMAIL"

echo ""

# --- Gateway Auth ---
echo "--- Gateway Auth ---"

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/accounts")
assert_status "No JWT returns 401" "401" "$HTTP_CODE"

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/accounts" \
    -H "Authorization: Bearer invalid.token.here")
assert_status "Invalid JWT returns 401" "401" "$HTTP_CODE"

echo ""

# --- Account Service ---
echo "--- Account Service ---"

# Create checking account
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/accounts" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"name":"Checking","type":"CHECKING"}')
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')
assert_status "Create checking account" "201" "$HTTP_CODE"
ACCT_ID=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)
assert_not_empty "Account has ID" "$ACCT_ID"
assert_json_field "Account balance starts at zero" "$BODY" "balance" "0"

# Create savings account
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/accounts" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"name":"Savings","type":"SAVINGS"}')
assert_status "Create savings account" "201" "$HTTP_CODE"

# List accounts
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/accounts" \
    -H "Authorization: Bearer $TOKEN")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')
assert_status "List accounts" "200" "$HTTP_CODE"
ACCT_COUNT=$(echo "$BODY" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null)
assert_not_empty "User has accounts" "$ACCT_COUNT"

# Get single account
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/accounts/$ACCT_ID" \
    -H "Authorization: Bearer $TOKEN")
assert_status "Get single account" "200" "$HTTP_CODE"

# Deposit (balance update)
RESPONSE=$(curl -s -w "\n%{http_code}" -X PATCH "$BASE_URL/api/accounts/$ACCT_ID/balance" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"delta":1000,"expectedVersion":0}')
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')
assert_status "Deposit 1000" "200" "$HTTP_CODE"
assert_json_field "Balance is 1000 after deposit" "$BODY" "balance" "1000.0"

# Optimistic lock failure (stale version)
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH "$BASE_URL/api/accounts/$ACCT_ID/balance" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"delta":100,"expectedVersion":0}')
assert_status "Stale version returns 409" "409" "$HTTP_CODE"

echo ""

# --- Transaction Service ---
echo "--- Transaction Service ---"

# Missing idempotency key
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/transactions" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"accountId\":\"$ACCT_ID\",\"amount\":-50,\"category\":\"FOOD\",\"description\":\"Test\"}")
assert_status "Missing Idempotency-Key returns 400" "400" "$HTTP_CODE"

# Post transaction
IDEM_KEY=$(python3 -c "import uuid; print(uuid.uuid4())")
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/transactions" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Idempotency-Key: $IDEM_KEY" \
    -d "{\"accountId\":\"$ACCT_ID\",\"amount\":-50,\"category\":\"FOOD\",\"description\":\"Lunch\"}")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')
assert_status "Post transaction" "201" "$HTTP_CODE"
TXN_ID=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)
assert_json_field "Transaction status is POSTED" "$BODY" "status" "POSTED"
assert_not_empty "Transaction has ID" "$TXN_ID"

# Idempotent replay
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/transactions" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Idempotency-Key: $IDEM_KEY" \
    -d "{\"accountId\":\"$ACCT_ID\",\"amount\":-50,\"category\":\"FOOD\",\"description\":\"Lunch\"}")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')
assert_status "Idempotent replay returns 200" "200" "$HTTP_CODE"
REPLAY_ID=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)
if [ "$REPLAY_ID" = "$TXN_ID" ]; then
    echo -e "  ${GREEN}PASS${NC} Replay returns same transaction ID"
    PASS=$((PASS + 1))
else
    echo -e "  ${RED}FAIL${NC} Replay returned different ID ($REPLAY_ID vs $TXN_ID)"
    FAIL=$((FAIL + 1))
fi

# Second transaction
IDEM_KEY2=$(python3 -c "import uuid; print(uuid.uuid4())")
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/transactions" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Idempotency-Key: $IDEM_KEY2" \
    -d "{\"accountId\":\"$ACCT_ID\",\"amount\":-25.50,\"category\":\"TRANSPORT\",\"description\":\"Uber\"}")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
assert_status "Post second transaction" "201" "$HTTP_CODE"

# Get transaction by ID
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/transactions/$TXN_ID" \
    -H "Authorization: Bearer $TOKEN")
assert_status "Get transaction by ID" "200" "$HTTP_CODE"

# List transactions by account
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/transactions?accountId=$ACCT_ID" \
    -H "Authorization: Bearer $TOKEN")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')
assert_status "List transactions by account" "200" "$HTTP_CODE"
TXN_COUNT=$(echo "$BODY" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null)
if [ "$TXN_COUNT" = "2" ]; then
    echo -e "  ${GREEN}PASS${NC} Account has 2 transactions"
    PASS=$((PASS + 1))
else
    echo -e "  ${RED}FAIL${NC} Expected 2 transactions, got $TXN_COUNT"
    FAIL=$((FAIL + 1))
fi

# Verify account balance updated
RESPONSE=$(curl -s "$BASE_URL/api/accounts/$ACCT_ID" \
    -H "Authorization: Bearer $TOKEN")
BALANCE=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['balance'])" 2>/dev/null)
if [ "$BALANCE" = "924.5" ]; then
    echo -e "  ${GREEN}PASS${NC} Account balance is 924.50 (1000 - 50 - 25.50)"
    PASS=$((PASS + 1))
else
    echo -e "  ${RED}FAIL${NC} Expected balance 924.5, got $BALANCE"
    FAIL=$((FAIL + 1))
fi

echo ""

# --- Analytics Service ---
echo "--- Analytics Service ---"

# Wait for Kafka consumer to process events
echo "  Waiting for Kafka event processing..."
sleep 5

MONTH=$(date -u +%Y-%m)

# Spending by account
RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/analytics/spending?accountId=$ACCT_ID&month=$MONTH" \
    -H "Authorization: Bearer $TOKEN")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')
assert_status "Get spending by account" "200" "$HTTP_CODE"
CATEGORY_COUNT=$(echo "$BODY" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null)
if [ "$CATEGORY_COUNT" = "2" ]; then
    echo -e "  ${GREEN}PASS${NC} Spending has 2 categories (FOOD, TRANSPORT)"
    PASS=$((PASS + 1))
else
    echo -e "  ${RED}FAIL${NC} Expected 2 categories, got $CATEGORY_COUNT"
    FAIL=$((FAIL + 1))
fi

# Verify FOOD total
FOOD_TOTAL=$(echo "$BODY" | python3 -c "
import sys,json
data = json.load(sys.stdin)
food = [d for d in data if d['category']=='FOOD']
print(food[0]['totalAmount'] if food else 'MISSING')
" 2>/dev/null)
if [ "$FOOD_TOTAL" = "-50.0" ]; then
    echo -e "  ${GREEN}PASS${NC} FOOD spending is -50.00"
    PASS=$((PASS + 1))
else
    echo -e "  ${RED}FAIL${NC} Expected FOOD total -50.0, got $FOOD_TOTAL"
    FAIL=$((FAIL + 1))
fi

# Spending by category (across all accounts)
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/analytics/spending/by-category?month=$MONTH" \
    -H "Authorization: Bearer $TOKEN")
assert_status "Get spending by category" "200" "$HTTP_CODE"

echo ""

# --- Rate Limiting ---
echo "--- Rate Limiting ---"

HEADERS=$(curl -s -D- -o /dev/null "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"x@x.com","password":"x"}' 2>&1)
if echo "$HEADERS" | grep -q "X-RateLimit-Remaining"; then
    echo -e "  ${GREEN}PASS${NC} Rate limit headers present"
    PASS=$((PASS + 1))
else
    echo -e "  ${RED}FAIL${NC} Rate limit headers missing"
    FAIL=$((FAIL + 1))
fi

echo ""

# --- Summary ---
TOTAL=$((PASS + FAIL))
echo "============================================"
if [ "$FAIL" -eq 0 ]; then
    echo -e "  ${GREEN}ALL $TOTAL TESTS PASSED${NC}"
else
    echo -e "  ${GREEN}$PASS passed${NC}, ${RED}$FAIL failed${NC} out of $TOTAL"
fi
echo "============================================"

exit $FAIL
