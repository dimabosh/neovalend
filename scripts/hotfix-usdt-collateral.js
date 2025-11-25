const { execSync } = require('child_process');

console.log('🔧 HOTFIX: Configure USDT as Collateral\n');

const POOL_CONFIGURATOR = '0xA80b7454e6E66f19de9d0b7a081923Cc85013D68';
const USDT = '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0';
const RPC = process.env.RPC_URL_SEPOLIA;
const KEY = process.env.DEPLOYER_PRIVATE_KEY;

// Step 1: Unpause USDT
console.log('📍 Step 1: Unpause USDT reserve...');
try {
  execSync(`cast send ${POOL_CONFIGURATOR} "setReservePause(address,bool)" ${USDT} false --private-key ${KEY} --rpc-url ${RPC}`, { stdio: 'inherit' });
  console.log('✅ USDT unpaused\n');
} catch (error) {
  console.error('❌ Failed to unpause:', error.message);
}

// Step 2: Configure collateral parameters
console.log('📍 Step 2: Configure collateral parameters...');
console.log('   LTV: 80%');
console.log('   Liquidation Threshold: 82.5%');
console.log('   Liquidation Bonus: 5%\n');

try {
  // LTV = 8000 (80%), LT = 8250 (82.5%), Bonus = 10500 (105% = 5% bonus)
  execSync(`cast send ${POOL_CONFIGURATOR} "configureReserveAsCollateral(address,uint256,uint256,uint256)" ${USDT} 8000 8250 10500 --private-key ${KEY} --rpc-url ${RPC}`, { stdio: 'inherit' });
  console.log('✅ Collateral parameters configured\n');
} catch (error) {
  console.error('❌ Failed to configure collateral:', error.message);
}

// Step 3: Verify configuration
console.log('📍 Step 3: Verify configuration...');
try {
  const config = execSync(`cast call 0xd272575622c700c44a1769ebd1a3dbfa74f2ae55 "getConfiguration(address)" ${USDT} --rpc-url ${RPC}`, { encoding: 'utf8' }).trim();
  console.log('Configuration bitmap:', config);

  const configBigInt = BigInt(config);
  const ltv = Number(configBigInt & BigInt(0xFFFF));
  const liquidationThreshold = Number((configBigInt >> BigInt(16)) & BigInt(0xFFFF));
  const liquidationBonus = Number((configBigInt >> BigInt(32)) & BigInt(0xFFFF));
  const isPaused = (configBigInt >> BigInt(58)) & BigInt(1);

  console.log('\n📊 Current Configuration:');
  console.log(`   LTV: ${ltv / 100}%`);
  console.log(`   Liquidation Threshold: ${liquidationThreshold / 100}%`);
  console.log(`   Liquidation Bonus: ${(liquidationBonus - 10000) / 100}%`);
  console.log(`   Is Paused: ${isPaused === BigInt(1) ? 'Yes ❌' : 'No ✅'}`);
  console.log(`   Can be used as collateral: ${ltv > 0 ? 'Yes ✅' : 'No ❌'}`);
} catch (error) {
  console.error('❌ Failed to verify:', error.message);
}

console.log('\n✅ HOTFIX COMPLETED!');
console.log('🔄 Refresh the page to see updated Health Factor\n');
