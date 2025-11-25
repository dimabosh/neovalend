#!/usr/bin/env node

const { execSync } = require('child_process');

// Configuration
const USER_ADDRESS = '0x1a4bFAEc349BaCDfda25b209df534697D8a114aD';
const RPC_URL = 'https://sepolia.infura.io/v3/746e6062f3664276add2f792620b3a76';

// Known Pool addresses from history
const POOLS = {
  OLD: '0xd272575622c700c44a1769ebd1a3dbfa74f2ae55',
  CURRENT: '0x0cde208D79D723B51aFaff0683d6dE2878304Ba5'
};

// Reserve assets to check
const RESERVES = {
  wA7A5: '0x18fb744Eb960480179006E3391293c77bB6f8De6',
  USDT: '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0',
  WBTC: '0x29f2D40B0605204364af54EC677bD022dA425d03'
};

console.log('========================================');
console.log('🔍 NEOVALEND POOL COMPREHENSIVE ANALYSIS');
console.log('========================================\n');

console.log(`User Address: ${USER_ADDRESS}`);
console.log(`RPC: Sepolia Infura\n`);

// Helper function to execute cast call
function castCall(contract, signature, args = '') {
  try {
    const cmd = `cast call ${contract} "${signature}" ${args} --rpc-url ${RPC_URL}`;
    const result = execSync(cmd, { encoding: 'utf8', stdio: 'pipe' }).trim();
    return result;
  } catch (error) {
    return null;
  }
}

// Helper to check if contract exists
function contractExists(address) {
  try {
    const code = execSync(`cast code ${address} --rpc-url ${RPC_URL}`, { encoding: 'utf8', stdio: 'pipe' }).trim();
    return code !== '0x' && code.length > 4;
  } catch (error) {
    return false;
  }
}

// Helper to decode getUserAccountData
function decodeAccountData(data) {
  if (!data || data === '0x') return null;

  // Remove 0x prefix
  const hex = data.replace('0x', '');

  // Each uint256 is 64 hex chars (32 bytes)
  const totalCollateral = BigInt('0x' + hex.slice(0, 64));
  const totalDebt = BigInt('0x' + hex.slice(64, 128));
  const availableBorrow = BigInt('0x' + hex.slice(128, 192));
  const liquidationThreshold = BigInt('0x' + hex.slice(192, 256));
  const ltv = BigInt('0x' + hex.slice(256, 320));
  const healthFactor = BigInt('0x' + hex.slice(320, 384));

  return {
    totalCollateral: (Number(totalCollateral) / 1e8).toFixed(2),
    totalDebt: (Number(totalDebt) / 1e8).toFixed(2),
    availableBorrow: (Number(availableBorrow) / 1e8).toFixed(2),
    liquidationThreshold: (Number(liquidationThreshold) / 100).toFixed(0),
    ltv: (Number(ltv) / 100).toFixed(0),
    healthFactor: healthFactor === BigInt(2) ** BigInt(256) - BigInt(1)
      ? 'MAX'
      : (Number(healthFactor) / 1e18).toFixed(2)
  };
}

// Helper to get reserve configuration
function decodeReserveConfig(configData) {
  if (!configData || configData === '0x') return null;

  const config = BigInt(configData);

  return {
    ltv: Number(config & BigInt(0xFFFF)),
    liquidationThreshold: Number((config >> BigInt(16)) & BigInt(0xFFFF)),
    liquidationBonus: Number((config >> BigInt(32)) & BigInt(0xFFFF)),
    decimals: Number((config >> BigInt(48)) & BigInt(0xFF)),
    active: ((config >> BigInt(56)) & BigInt(1)) === BigInt(1),
    frozen: ((config >> BigInt(57)) & BigInt(1)) === BigInt(1),
    borrowingEnabled: ((config >> BigInt(58)) & BigInt(1)) === BigInt(1),
    paused: ((config >> BigInt(60)) & BigInt(1)) === BigInt(1)
  };
}

// Analyze each Pool
for (const [name, poolAddress] of Object.entries(POOLS)) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📋 POOL: ${name}`);
  console.log(`Address: ${poolAddress}`);
  console.log(`${'='.repeat(60)}\n`);

  // Check if contract exists
  const exists = contractExists(poolAddress);
  console.log(`Contract Exists: ${exists ? '✅ YES' : '❌ NO'}\n`);

  if (!exists) {
    console.log('⚠️  Pool contract not found or empty bytecode\n');
    continue;
  }

  // 1. Get user account data
  console.log('1️⃣  USER ACCOUNT DATA:');
  console.log('-'.repeat(40));
  const accountData = castCall(poolAddress, 'getUserAccountData(address)', USER_ADDRESS);

  if (accountData) {
    const decoded = decodeAccountData(accountData);
    if (decoded) {
      console.log(`   Total Collateral: $${decoded.totalCollateral}`);
      console.log(`   Total Debt:       $${decoded.totalDebt}`);
      console.log(`   Available Borrow: $${decoded.availableBorrow}`);
      console.log(`   Liquidation LTV:  ${decoded.liquidationThreshold}%`);
      console.log(`   Max LTV:          ${decoded.ltv}%`);
      console.log(`   Health Factor:    ${decoded.healthFactor}`);

      const hasPositions = parseFloat(decoded.totalCollateral) > 0 || parseFloat(decoded.totalDebt) > 0;
      console.log(`\n   💼 Active Positions: ${hasPositions ? '✅ YES' : '❌ NO'}`);
    } else {
      console.log('   ⚠️  Unable to decode account data');
    }
  } else {
    console.log('   ❌ Failed to fetch account data');
  }

  // 2. Get user configuration (bitmap)
  console.log('\n2️⃣  USER CONFIGURATION (Bitmap):');
  console.log('-'.repeat(40));
  const userConfig = castCall(poolAddress, 'getUserConfiguration(address)', USER_ADDRESS);

  if (userConfig) {
    const configBitmap = BigInt(userConfig);
    console.log(`   Raw Bitmap: ${userConfig}`);
    console.log(`   Binary: ${configBitmap.toString(2).padStart(256, '0').slice(-20)}`);

    // Check if any bits are set
    const hasConfig = configBitmap !== BigInt(0);
    console.log(`   Has Configuration: ${hasConfig ? '✅ YES' : '❌ NO'}`);
  } else {
    console.log('   ❌ Failed to fetch user configuration');
  }

  // 3. Get reserves list
  console.log('\n3️⃣  INITIALIZED RESERVES:');
  console.log('-'.repeat(40));
  const reservesList = castCall(poolAddress, 'getReservesList()');

  if (reservesList && reservesList !== '0x') {
    // Parse array of addresses
    const hex = reservesList.replace('0x', '');
    const numReserves = parseInt(hex.slice(0, 64), 16);

    console.log(`   Total Reserves: ${numReserves}\n`);

    if (numReserves > 0) {
      for (let i = 0; i < numReserves; i++) {
        const start = 64 + i * 64 + 24; // Skip length + padding
        const addressHex = '0x' + hex.slice(start, start + 40);

        // Find asset name
        let assetName = 'UNKNOWN';
        for (const [name, addr] of Object.entries(RESERVES)) {
          if (addr.toLowerCase() === addressHex.toLowerCase()) {
            assetName = name;
            break;
          }
        }

        console.log(`   [${i}] ${assetName}: ${addressHex}`);

        // Get reserve data for this asset
        const reserveData = castCall(poolAddress, 'getReserveData(address)', addressHex);

        if (reserveData && reserveData !== '0x') {
          // Parse configuration from reserve data (first uint256)
          const configHex = reserveData.slice(2, 66);
          const config = decodeReserveConfig('0x' + configHex);

          if (config) {
            console.log(`       LTV: ${config.ltv / 100}%`);
            console.log(`       Liq Threshold: ${config.liquidationThreshold / 100}%`);
            console.log(`       Liq Bonus: ${(config.liquidationBonus - 10000) / 100}%`);
            console.log(`       Active: ${config.active ? '✅' : '❌'}`);
            console.log(`       Frozen: ${config.frozen ? '🧊' : '❌'}`);
            console.log(`       Borrowing: ${config.borrowingEnabled ? '✅' : '❌'}`);
            console.log(`       Paused: ${config.paused ? '⏸️' : '▶️'}`);

            // Get aToken address (9th field in struct)
            const aTokenHex = '0x' + reserveData.slice(2 + 64 * 8 + 24, 2 + 64 * 8 + 24 + 40);
            console.log(`       aToken: ${aTokenHex}`);

            // Check user's aToken balance
            const aTokenBalance = castCall(aTokenHex, 'balanceOf(address)', USER_ADDRESS);
            if (aTokenBalance) {
              const balance = BigInt(aTokenBalance);
              const decimals = config.decimals || 18;
              const balanceFormatted = (Number(balance) / Math.pow(10, decimals)).toFixed(4);
              console.log(`       User aToken Balance: ${balanceFormatted} ${assetName}`);
            }

            // Get debt token address (11th field in struct)
            const debtTokenHex = '0x' + reserveData.slice(2 + 64 * 10 + 24, 2 + 64 * 10 + 24 + 40);
            console.log(`       Debt Token: ${debtTokenHex}`);

            // Check user's debt balance
            const debtBalance = castCall(debtTokenHex, 'balanceOf(address)', USER_ADDRESS);
            if (debtBalance) {
              const balance = BigInt(debtBalance);
              const decimals = config.decimals || 18;
              const balanceFormatted = (Number(balance) / Math.pow(10, decimals)).toFixed(4);
              console.log(`       User Debt Balance: ${balanceFormatted} ${assetName}`);
            }
          }
        }
        console.log('');
      }
    } else {
      console.log('   ⚠️  No reserves initialized in this Pool');
    }
  } else {
    console.log('   ❌ Failed to fetch reserves list');
  }
}

// FINAL RECOMMENDATIONS
console.log('\n');
console.log('========================================');
console.log('📊 SUMMARY & RECOMMENDATIONS');
console.log('========================================\n');

console.log('Based on the analysis above:\n');
console.log('1️⃣  Check which Pool has user positions (totalCollateral > 0 or totalDebt > 0)');
console.log('2️⃣  Check which Pool has initialized reserves (getReservesList returns assets)');
console.log('3️⃣  Check aToken balances for each reserve in each Pool');
console.log('4️⃣  Verify collateral configuration (LTV > 0% means usable as collateral)\n');

console.log('✅ IF OLD Pool has positions:');
console.log('   → Frontend MUST use OLD Pool address temporarily');
console.log('   → User needs to withdraw from OLD Pool first');
console.log('   → Then deposit into CURRENT Pool\n');

console.log('✅ IF CURRENT Pool has positions:');
console.log('   → Frontend already using correct address');
console.log('   → No migration needed\n');

console.log('✅ IF BOTH Pools empty:');
console.log('   → Just use CURRENT Pool going forward');
console.log('   → No migration needed\n');

console.log('🔗 Git History Check:');
console.log('   Run: git log --all -p -S "0xd272575622c700c44a1769ebd1a3dbfa74f2ae55"');
console.log('   To see when OLD Pool was last used\n');
