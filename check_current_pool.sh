#!/bin/bash
set -e

RPC="https://sepolia.infura.io/v3/746e6062f3664276add2f792620b3a76"
POOL="0x0cde208D79D723B51aFaff0683d6dE2878304Ba5"
USDT="0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0"
WA7A5="0x18fb744Eb960480179006E3391293c77bB6f8De6"

echo "========================================="
echo "CURRENT POOL ДИАГНОСТИКА"
echo "========================================="
echo ""

echo "1. Проверка списка резервов:"
cast call $POOL "getReservesList()(address[])" --rpc-url $RPC
echo ""

echo "2. Проверка USDT резерва:"
cast call $POOL "getReserveData(address)" $USDT --rpc-url $RPC 2>&1 | head -5
echo ""

echo "3. Проверка wA7A5 резерва:"
cast call $POOL "getReserveData(address)" $WA7A5 --rpc-url $RPC 2>&1 | head -5
echo ""

echo "========================================="
echo "ВЫВОД:"
if cast call $POOL "getReservesList()(address[])" --rpc-url $RPC | grep -q "0x"; then
    echo "✅ Резервы инициализированы"
else
    echo "❌ Резервы НЕ инициализированы - нужна Phase 6"
fi
