#!/bin/bash

# Check TVL on both Pool contracts
# OLD Pool: 0xd272575622c700c44a1769ebd1a3dbfa74f2ae55
# CURRENT Pool: 0x0cde208D79D723B51aFaff0683d6dE2878304Ba5

RPC="https://sepolia.infura.io/v3/746e6062f3664276add2f792620b3a76"
USER="0x1a4bFAEc349BaCDfda25b209df534697D8a114aD"

echo "========================================="
echo "OLD POOL TVL ANALYSIS"
echo "========================================="
echo ""

# Get USDT reserve data from OLD Pool
echo "📊 USDT Reserve (OLD Pool):"
cast call 0xd272575622c700c44a1769ebd1a3dbfa74f2ae55 \
  "getReserveData(address)" \
  0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0 \
  --rpc-url $RPC | head -20

echo ""
echo "📊 wA7A5 Reserve (OLD Pool):"
cast call 0xd272575622c700c44a1769ebd1a3dbfa74f2ae55 \
  "getReserveData(address)" \
  0x18fb744Eb960480179006E3391293c77bB6f8De6 \
  --rpc-url $RPC | head -20

echo ""
echo "========================================="
echo "CURRENT POOL TVL ANALYSIS"
echo "========================================="
echo ""

# Get USDT reserve data from CURRENT Pool
echo "📊 USDT Reserve (CURRENT Pool):"
cast call 0x0cde208D79D723B51aFaff0683d6dE2878304Ba5 \
  "getReserveData(address)" \
  0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0 \
  --rpc-url $RPC | head -20

echo ""
echo "📊 wA7A5 Reserve (CURRENT Pool):"
cast call 0x0cde208D79D723B51aFaff0683d6dE2878304Ba5 \
  "getReserveData(address)" \
  0x18fb744Eb960480179006E3391293c77bB6f8De6 \
  --rpc-url $RPC | head -20
