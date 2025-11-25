const { execSync } = require('child_process');
const fs = require('fs');

console.log('🚰 Neovalend Protocol - Token Faucet\n');
console.log('═══════════════════════════════════════════════════\n');

const RPC = process.env.RPC_URL_SEPOLIA;
const KEY = process.env.DEPLOYER_PRIVATE_KEY;

if (!RPC || !KEY) {
  console.error('❌ Missing environment variables!');
  console.error('   RPC_URL_SEPOLIA and DEPLOYER_PRIVATE_KEY required');
  process.exit(1);
}

// Load deployments
const deployments = JSON.parse(fs.readFileSync('deployments/all-contracts.json', 'utf8'));

// Token addresses
const USDT = deployments.contracts.USDT;
const WA7A5 = deployments.contracts.wA7A5;
const WBTC = '0x29f2D40B0605204364af54EC677bD022dA425d03'; // Sepolia WBTC

// Get recipient address (deployer or from args)
const recipient = process.argv[2] || deployments.deployer;

console.log('📋 Faucet Configuration:');
console.log('  Recipient:', recipient);
console.log('  USDT:', USDT);
console.log('  wA7A5:', WA7A5);
console.log('  WBTC:', WBTC);
console.log('');

// Mint amounts
const amounts = {
  USDT: '1000000000', // 1,000 USDT (6 decimals)
  WA7A5: '100000000000000000000000', // 100,000 wA7A5 (18 decimals)
  WBTC: '10000000' // 0.1 WBTC (8 decimals)
};

console.log('💰 Mint Amounts:');
console.log('  USDT: 1,000 USDT');
console.log('  wA7A5: 100,000 wA7A5');
console.log('  WBTC: 0.1 WBTC');
console.log('');

// ═══════════════════════════════════════════════════════
// MINT USDT
// ═══════════════════════════════════════════════════════
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('💵 Minting USDT...');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

try {
  execSync(`cast send ${USDT} "mint(address,uint256)" ${recipient} ${amounts.USDT} --private-key ${KEY} --rpc-url ${RPC}`, { stdio: 'inherit' });
  console.log('✅ USDT minted: 1,000 USDT\n');
} catch (error) {
  console.log('⚠️  USDT mint failed:', error.message);
  console.log('   Continuing with other tokens...\n');
}

// ═══════════════════════════════════════════════════════
// MINT wA7A5
// ═══════════════════════════════════════════════════════
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🪙 Minting wA7A5...');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

try {
  execSync(`cast send ${WA7A5} "mint(address,uint256)" ${recipient} ${amounts.WA7A5} --private-key ${KEY} --rpc-url ${RPC}`, { stdio: 'inherit' });
  console.log('✅ wA7A5 minted: 100,000 wA7A5\n');
} catch (error) {
  console.log('⚠️  wA7A5 mint failed:', error.message);
  console.log('   Continuing with other tokens...\n');
}

// ═══════════════════════════════════════════════════════
// MINT WBTC
// ═══════════════════════════════════════════════════════
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('₿ Minting WBTC...');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

try {
  execSync(`cast send ${WBTC} "mint(address,uint256)" ${recipient} ${amounts.WBTC} --private-key ${KEY} --rpc-url ${RPC}`, { stdio: 'inherit' });
  console.log('✅ WBTC minted: 0.1 WBTC\n');
} catch (error) {
  console.log('⚠️  WBTC mint failed:', error.message);
  console.log('   You may not be the owner of WBTC contract\n');
}

// ═══════════════════════════════════════════════════════
// VERIFY BALANCES
// ═══════════════════════════════════════════════════════
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 Verifying Balances...');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

try {
  const usdtBalance = execSync(`cast call ${USDT} "balanceOf(address)(uint256)" ${recipient} --rpc-url ${RPC}`, { encoding: 'utf8' }).trim();
  console.log(`  USDT: ${parseInt(usdtBalance) / 1e6} USDT`);
} catch (error) {
  console.log('  USDT: Error reading balance');
}

try {
  const wa7a5Balance = execSync(`cast call ${WA7A5} "balanceOf(address)(uint256)" ${recipient} --rpc-url ${RPC}`, { encoding: 'utf8' }).trim();
  console.log(`  wA7A5: ${parseInt(wa7a5Balance) / 1e18} wA7A5`);
} catch (error) {
  console.log('  wA7A5: Error reading balance');
}

try {
  const wbtcBalance = execSync(`cast call ${WBTC} "balanceOf(address)(uint256)" ${recipient} --rpc-url ${RPC}`, { encoding: 'utf8' }).trim();
  console.log(`  WBTC: ${parseInt(wbtcBalance) / 1e8} WBTC`);
} catch (error) {
  console.log('  WBTC: Error reading balance');
}

console.log('');
console.log('═══════════════════════════════════════════════════');
console.log('✅ FAUCET COMPLETED!');
console.log('═══════════════════════════════════════════════════\n');

console.log('💡 Next Steps:');
console.log('  1. Approve tokens for Pool contract');
console.log('  2. Deposit tokens to start earning interest');
console.log('  3. Use as collateral to borrow other assets');
console.log('');
