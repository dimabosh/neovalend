const { execSync } = require('child_process');
const fs = require('fs');

console.log('🚀 HOTFIX V3: Add WBTC + Configure USDT as Collateral\n');
console.log('═══════════════════════════════════════════════════\n');

const RPC = process.env.RPC_URL_SEPOLIA;
const KEY = process.env.DEPLOYER_PRIVATE_KEY;

// Load deployments
const deployments = JSON.parse(fs.readFileSync('deployments/all-contracts.json', 'utf8'));

// Contract addresses
const POOL = deployments.contracts.Pool;
const POOL_CONFIGURATOR = deployments.contracts.PoolConfigurator;
const ORACLE = deployments.contracts.AaveOracle;
const ATOKEN_IMPL = deployments.contracts.ATokenInstance;
const DEBT_TOKEN_IMPL = deployments.contracts.VariableDebtTokenInstance;
const TREASURY = deployments.deployer; // Using deployer as treasury for now
const INTEREST_RATE_STRATEGY = deployments.contracts.DefaultReserveInterestRateStrategyV2;

// Token addresses
const USDT = deployments.contracts.USDT;
const WBTC = '0x29f2D40B0605204364af54EC677bD022dA425d03'; // Sepolia WBTC

console.log('📋 Contract Addresses:');
console.log('  Pool:', POOL);
console.log('  PoolConfigurator:', POOL_CONFIGURATOR);
console.log('  Oracle:', ORACLE);
console.log('  USDT:', USDT);
console.log('  WBTC:', WBTC);
console.log('');

// ═══════════════════════════════════════════════════════
// PART 1: FIX USDT COLLATERAL
// ═══════════════════════════════════════════════════════
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📍 PART 1: Configure USDT as Collateral');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Step 1.1: Unpause USDT
console.log('🔓 Step 1.1: Unpause USDT reserve...');
try {
  execSync(`cast send ${POOL_CONFIGURATOR} "setReservePause(address,bool)" ${USDT} false --private-key ${KEY} --rpc-url ${RPC}`, { stdio: 'inherit' });
  console.log('✅ USDT unpaused\n');
} catch (error) {
  console.log('⚠️  USDT unpause failed (may already be unpaused)\n');
}

// Step 1.2: Configure USDT collateral
console.log('🔒 Step 1.2: Configure USDT collateral parameters...');
console.log('   LTV: 80% (8000 bps)');
console.log('   Liquidation Threshold: 82.5% (8250 bps)');
console.log('   Liquidation Bonus: 5% (10500 = 105%)\n');

try {
  execSync(`cast send ${POOL_CONFIGURATOR} "configureReserveAsCollateral(address,uint256,uint256,uint256)" ${USDT} 8000 8250 10500 --private-key ${KEY} --rpc-url ${RPC}`, { stdio: 'inherit' });
  console.log('✅ USDT collateral configured\n');
} catch (error) {
  console.error('❌ USDT collateral configuration failed:', error.message);
  process.exit(1);
}

// ═══════════════════════════════════════════════════════
// PART 2: ADD WBTC
// ═══════════════════════════════════════════════════════
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📍 PART 2: Add WBTC Reserve');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Step 2.1: Deploy WBTC SimplePriceOracle
console.log('📡 Step 2.1: Deploy SimplePriceOracle for WBTC...');
const deployOracleCmd = `forge create "contracts/mocks/SimplePriceOracle.sol:SimplePriceOracle" --private-key ${KEY} --rpc-url ${RPC} --verify --etherscan-api-key ${process.env.ETHERSCAN_API_KEY} --broadcast --json`;

let wbtcOracle;
try {
  const output = execSync(deployOracleCmd, { encoding: 'utf8', stdio: 'pipe' });
  const jsonMatch = output.match(/\{[^}]*"deployedTo"[^}]*\}/);
  if (jsonMatch) {
    const json = JSON.parse(jsonMatch[0]);
    wbtcOracle = json.deployedTo;
  }
  console.log('✅ WBTC Oracle deployed:', wbtcOracle);
  console.log('');
} catch (error) {
  console.error('❌ Oracle deployment failed:', error.message);
  process.exit(1);
}

// Step 2.2: Set WBTC price ($120,000)
console.log('💰 Step 2.2: Set WBTC price to $120,000...');
console.log('   Price: 12000000000000 (8 decimals)\n');

try {
  execSync(`cast send ${wbtcOracle} "setPrice(int256)" 12000000000000 --private-key ${KEY} --rpc-url ${RPC}`, { stdio: 'inherit' });
  console.log('✅ WBTC price set\n');
} catch (error) {
  console.error('❌ Price setting failed:', error.message);
  process.exit(1);
}

// Step 2.3: Add WBTC to Oracle
console.log('🔗 Step 2.3: Add WBTC source to AaveOracle...');
try {
  execSync(`cast send ${ORACLE} "setAssetSources(address[],address[])" "[${WBTC}]" "[${wbtcOracle}]" --private-key ${KEY} --rpc-url ${RPC}`, { stdio: 'inherit' });
  console.log('✅ WBTC added to Oracle\n');
} catch (error) {
  console.error('❌ Oracle configuration failed:', error.message);
  process.exit(1);
}

// Step 2.4: Initialize WBTC reserve
console.log('🏦 Step 2.4: Initialize WBTC reserve...');
console.log('   aToken: rWBTC (Neovalend interest bearing WBTC)');
console.log('   debtToken: variableDebtWBTC\n');

// ✅ CORRECT APPROACH: Use Aave v3.5 initReserves signature (9 fields, NOT 12)
// Phase 6 uses simplified struct:
// (aTokenImpl, variableDebtTokenImpl, underlyingAsset, aTokenName, aTokenSymbol, debtTokenName, debtTokenSymbol, params, interestRateData)

try {
  console.log('📦 Step 2.4a: Encoding interest rate data...');

  // Encode interestRateData struct (uint16, uint32, uint32, uint32)
  // WBTC rates: optimalUsageRatio=8000, baseRate=0, slope1=400, slope2=30000
  const { ethers } = require('ethers');
  const interestRateData = ethers.AbiCoder.defaultAbiCoder().encode(
    ['uint16', 'uint32', 'uint32', 'uint32'],
    [8000, 0, 400, 30000]  // 80% optimal, 0% base, 4% slope1, 300% slope2
  );

  console.log('📋 Interest Rate Data:', interestRateData);
  console.log('   - Optimal Usage Ratio: 8000 bps (80%)');
  console.log('   - Base Variable Borrow Rate: 0 bps (0%)');
  console.log('   - Variable Rate Slope1: 400 bps (4%)');
  console.log('   - Variable Rate Slope2: 30000 bps (300%)\n');

  console.log('📦 Step 2.4b: Sending initReserves transaction...');
  console.log('💡 Using Phase 6 pattern with Aave v3.5 signature (9 fields)\n');

  // ✅ CORRECT: Aave v3.5 signature (9 fields) with \\" escaped strings
  const initCommand = `cast send ${POOL_CONFIGURATOR} "initReserves((address,address,address,string,string,string,string,bytes,bytes)[])" "[(${ATOKEN_IMPL},${DEBT_TOKEN_IMPL},${WBTC},\\"Neovalend interest bearing WBTC\\",\\"rWBTC\\",\\"Neovalend variable debt bearing WBTC\\",\\"variableDebtWBTC\\",0x,${interestRateData})]" --private-key ${KEY} --rpc-url ${RPC} --gas-limit 3000000`;

  execSync(initCommand, { stdio: 'inherit' });
  console.log('✅ WBTC reserve initialized\n');
} catch (error) {
  console.error('❌ Reserve initialization failed:', error.message);
  process.exit(1);
}

// Step 2.5: Configure WBTC as collateral
console.log('🔒 Step 2.5: Configure WBTC collateral parameters...');
console.log('   LTV: 70% (7000 bps)');
console.log('   Liquidation Threshold: 75% (7500 bps)');
console.log('   Liquidation Bonus: 10% (11000 = 110%)\n');

try {
  execSync(`cast send ${POOL_CONFIGURATOR} "configureReserveAsCollateral(address,uint256,uint256,uint256)" ${WBTC} 7000 7500 11000 --private-key ${KEY} --rpc-url ${RPC}`, { stdio: 'inherit' });
  console.log('✅ WBTC collateral configured\n');
} catch (error) {
  console.error('❌ Collateral configuration failed:', error.message);
  process.exit(1);
}

// Step 2.6: Set reserve factor
console.log('💰 Step 2.6: Set WBTC reserve factor to 15%...');
console.log('   Reserve Factor: 15% (1500 bps)\n');
try {
  execSync(`cast send ${POOL_CONFIGURATOR} "setReserveFactor(address,uint256)" ${WBTC} 1500 --private-key ${KEY} --rpc-url ${RPC}`, { stdio: 'inherit' });
  console.log('✅ WBTC reserve factor set\n');
} catch (error) {
  console.log('⚠️  Reserve factor setting failed\n');
}

// Step 2.7: Enable borrowing
console.log('🔓 Step 2.7: Enable borrowing for WBTC...');
try {
  execSync(`cast send ${POOL_CONFIGURATOR} "setReserveBorrowing(address,bool)" ${WBTC} true --private-key ${KEY} --rpc-url ${RPC}`, { stdio: 'inherit' });
  console.log('✅ WBTC borrowing enabled\n');
} catch (error) {
  console.log('⚠️  Borrowing enable failed\n');
}

// ═══════════════════════════════════════════════════════
// PART 3: GET ATOKEN ADDRESSES
// ═══════════════════════════════════════════════════════
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📍 PART 3: Get aToken and debtToken Addresses');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

try {
  const reserveData = execSync(`cast call ${POOL} "getReserveData(address)" ${WBTC} --rpc-url ${RPC}`, { encoding: 'utf8' });

  // Parse reserve data (simplified - just get aToken address which is at position 8)
  const lines = reserveData.trim().split('\n');
  let aTokenAddress, debtTokenAddress;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('aTokenAddress') || i === 8) {
      aTokenAddress = lines[i].split(':')[1]?.trim() || lines[i].trim();
    }
    if (lines[i].includes('variableDebtTokenAddress') || i === 10) {
      debtTokenAddress = lines[i].split(':')[1]?.trim() || lines[i].trim();
    }
  }

  console.log('📊 WBTC Reserve Tokens:');
  console.log('  aToken (rWBTC):', aTokenAddress);
  console.log('  debtToken (variableDebtWBTC):', debtTokenAddress);
  console.log('');

  // Update deployments file
  deployments.contracts.WBTC = WBTC;
  deployments.contracts.WBTC_SimplePriceOracle = wbtcOracle;
  deployments.oracles = deployments.oracles || {};
  deployments.oracles.WBTC_SimplePriceOracle = wbtcOracle;
  deployments.reserves = deployments.reserves || {};
  deployments.reserves.WBTC = {
    address: WBTC,
    aToken: aTokenAddress,
    variableDebtToken: debtTokenAddress,
    priceOracle: wbtcOracle
  };

  fs.writeFileSync('deployments/all-contracts.json', JSON.stringify(deployments, null, 2));
  console.log('✅ Deployments file updated\n');

} catch (error) {
  console.log('⚠️  Could not get reserve data, continuing...\n');
}

// ═══════════════════════════════════════════════════════
// VERIFICATION
// ═══════════════════════════════════════════════════════
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📍 VERIFICATION');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('🔍 Verifying USDT configuration...');
const usdtConfig = execSync(`cast call ${POOL} "getConfiguration(address)" ${USDT} --rpc-url ${RPC}`, { encoding: 'utf8' }).trim();
console.log('  Configuration:', usdtConfig);

console.log('\n🔍 Verifying WBTC configuration...');
const wbtcConfig = execSync(`cast call ${POOL} "getConfiguration(address)" ${WBTC} --rpc-url ${RPC}`, { encoding: 'utf8' }).trim();
console.log('  Configuration:', wbtcConfig);

console.log('\n🔍 Verifying WBTC price...');
const wbtcPrice = execSync(`cast call ${ORACLE} "getAssetPrice(address)" ${WBTC} --rpc-url ${RPC}`, { encoding: 'utf8' }).trim();
console.log('  Price:', parseInt(wbtcPrice) / 1e8, 'USD');

console.log('\n═══════════════════════════════════════════════════');
console.log('✅ HOTFIX V3 COMPLETED!');
console.log('═══════════════════════════════════════════════════\n');

console.log('📋 Next Steps:');
console.log('  1. Update src/config/contracts.ts with WBTC configuration');
console.log('  2. Add WBTC logo to public/img/wbtc.png');
console.log('  3. Refresh the frontend to see WBTC in the asset list');
console.log('  4. Test deposit/borrow with WBTC');
console.log('');
