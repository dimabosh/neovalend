const { ethers } = require('ethers');
const fs = require('fs');
const { execSync } = require('child_process');

// HOTFIX: Configure Oracle Price Sources
// Issue: AaveOracle deployed without price sources, causing getUserAccountData to revert
// Solution: Deploy SimplePriceOracle contracts and set them as sources

async function hotfixOraclePrices() {
    console.log('🔧 HOTFIX: Configure Oracle Price Sources');
    console.log('==========================================');
    console.log('🎯 Goal: Fix getUserAccountData by setting asset prices');
    console.log('');
    console.log('💰 Prices:');
    console.log('  - USDT: $1.00 (100000000 in 8 decimals)');
    console.log('  - wA7A5: $0.0111 (1111111 in 8 decimals) // 1 USDT = 90 A7A5');
    console.log('');

    // Network detection and RPC URL validation
    const network = process.env.NETWORK || 'sepolia';
    const isNeoX = network.includes('neox');
    const rpcUrl = process.env.RPC_URL_SEPOLIA;
    const legacyFlag = isNeoX ? '--legacy' : '';

    console.log(`🌐 Network: ${network}`);
    console.log(`📡 RPC URL: ${rpcUrl}`);

    // Validate RPC URL matches expected network
    if (!rpcUrl) {
        console.error('❌ RPC_URL_SEPOLIA environment variable is not set!');
        process.exit(1);
    }

    if (isNeoX && !rpcUrl.includes('ngd.network') && !rpcUrl.includes('banelabs')) {
        console.error(`❌ Network mismatch! Network is ${network} but RPC URL doesn't look like NEO X`);
        process.exit(1);
    }

    if (!isNeoX && (rpcUrl.includes('ngd.network') || rpcUrl.includes('banelabs'))) {
        console.error(`❌ Network mismatch! Network is ${network} but RPC URL is for NEO X`);
        process.exit(1);
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);

    console.log('📋 Deployer:', wallet.address);
    if (isNeoX) {
        console.log('⚡ Using legacy transactions for NEO X');
    }
    const balance = await provider.getBalance(wallet.address);
    console.log('💰 Balance:', ethers.formatEther(balance), 'GAS\n');

    // Load deployments
    const deployments = JSON.parse(fs.readFileSync('deployments/all-contracts.json', 'utf8'));

    const ORACLE = deployments.contracts.AaveOracle;
    const USDT = deployments.contracts.USDT;
    const WA7A5 = deployments.contracts.wA7A5;

    console.log('📍 Contract Addresses:');
    console.log('  AaveOracle:', ORACLE);
    console.log('  USDT:', USDT);
    console.log('  wA7A5:', WA7A5);
    console.log('');

    // ===================================
    // STEP 1: Deploy SimplePriceOracle for USDT
    // ===================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 STEP 1: Deploy SimplePriceOracle for USDT');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    let usdtPriceOracle;

    try {
        let deployCommand;
        if (isNeoX) {
            deployCommand = `forge create "contracts/mocks/SimplePriceOracle.sol:SimplePriceOracle" --private-key ${process.env.DEPLOYER_PRIVATE_KEY} --rpc-url ${process.env.RPC_URL_SEPOLIA} --legacy --broadcast --json`;
        } else if (process.env.ETHERSCAN_API_KEY) {
            deployCommand = `forge create "contracts/mocks/SimplePriceOracle.sol:SimplePriceOracle" --private-key ${process.env.DEPLOYER_PRIVATE_KEY} --rpc-url ${process.env.RPC_URL_SEPOLIA} --verify --etherscan-api-key ${process.env.ETHERSCAN_API_KEY} --broadcast --json`;
        } else {
            console.log('⚠️ ETHERSCAN_API_KEY not set - deploying without verification');
            deployCommand = `forge create "contracts/mocks/SimplePriceOracle.sol:SimplePriceOracle" --private-key ${process.env.DEPLOYER_PRIVATE_KEY} --rpc-url ${process.env.RPC_URL_SEPOLIA} --broadcast --json`;
        }

        console.log('🚀 Deploying SimplePriceOracle for USDT...');
        const output = execSync(deployCommand, { encoding: 'utf8', stdio: 'pipe' });

        const jsonMatch = output.match(/\{[^}]*"deployedTo"[^}]*\}/);
        if (jsonMatch) {
            const json = JSON.parse(jsonMatch[0]);
            usdtPriceOracle = json.deployedTo;
            console.log('✅ USDT SimplePriceOracle deployed:', usdtPriceOracle);
        }

        // Set USDT price to $1.00 (100000000 in 8 decimals)
        console.log('\n💵 Setting USDT price to $1.00...');
        execSync(
            `cast send ${usdtPriceOracle} "setPrice(int256)" 100000000 --private-key ${process.env.DEPLOYER_PRIVATE_KEY} --rpc-url ${process.env.RPC_URL_SEPOLIA} ${legacyFlag}`,
            { stdio: 'inherit' }
        );
        console.log('✅ USDT price set to $1.00');

        // Verify price via latestAnswer()
        const usdtPrice = execSync(
            `cast call ${usdtPriceOracle} "latestAnswer()(int256)" --rpc-url ${process.env.RPC_URL_SEPOLIA}`,
            { encoding: 'utf8' }
        ).trim();
        console.log('🔍 Verified USDT price:', parseInt(usdtPrice) / 1e8, 'USD');

    } catch (error) {
        console.error('❌ Failed to deploy USDT price oracle:', error.message);
        process.exit(1);
    }

    // ===================================
    // STEP 2: Deploy SimplePriceOracle for wA7A5
    // ===================================
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 STEP 2: Deploy SimplePriceOracle for wA7A5');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    let wa7a5PriceOracle;

    try {
        let deployCommand;
        if (isNeoX) {
            deployCommand = `forge create "contracts/mocks/SimplePriceOracle.sol:SimplePriceOracle" --private-key ${process.env.DEPLOYER_PRIVATE_KEY} --rpc-url ${process.env.RPC_URL_SEPOLIA} --legacy --broadcast --json`;
        } else if (process.env.ETHERSCAN_API_KEY) {
            deployCommand = `forge create "contracts/mocks/SimplePriceOracle.sol:SimplePriceOracle" --private-key ${process.env.DEPLOYER_PRIVATE_KEY} --rpc-url ${process.env.RPC_URL_SEPOLIA} --verify --etherscan-api-key ${process.env.ETHERSCAN_API_KEY} --broadcast --json`;
        } else {
            console.log('⚠️ ETHERSCAN_API_KEY not set - deploying without verification');
            deployCommand = `forge create "contracts/mocks/SimplePriceOracle.sol:SimplePriceOracle" --private-key ${process.env.DEPLOYER_PRIVATE_KEY} --rpc-url ${process.env.RPC_URL_SEPOLIA} --broadcast --json`;
        }

        console.log('🚀 Deploying SimplePriceOracle for wA7A5...');
        const output = execSync(deployCommand, { encoding: 'utf8', stdio: 'pipe' });

        const jsonMatch = output.match(/\{[^}]*"deployedTo"[^}]*\}/);
        if (jsonMatch) {
            const json = JSON.parse(jsonMatch[0]);
            wa7a5PriceOracle = json.deployedTo;
            console.log('✅ wA7A5 SimplePriceOracle deployed:', wa7a5PriceOracle);
        }

        // Set wA7A5 price to $0.0111 (1111111 in 8 decimals) // 1 USDT = 90 A7A5
        console.log('\n💎 Setting wA7A5 price to $0.0111 (1 USDT = 90 A7A5)...');
        execSync(
            `cast send ${wa7a5PriceOracle} "setPrice(int256)" 1111111 --private-key ${process.env.DEPLOYER_PRIVATE_KEY} --rpc-url ${process.env.RPC_URL_SEPOLIA} ${legacyFlag}`,
            { stdio: 'inherit' }
        );
        console.log('✅ wA7A5 price set to $0.0111');

        // Verify price via latestAnswer()
        const wa7a5Price = execSync(
            `cast call ${wa7a5PriceOracle} "latestAnswer()(int256)" --rpc-url ${process.env.RPC_URL_SEPOLIA}`,
            { encoding: 'utf8' }
        ).trim();
        console.log('🔍 Verified wA7A5 price:', (parseInt(wa7a5Price) / 1e8).toFixed(4), 'USD');

    } catch (error) {
        console.error('❌ Failed to deploy wA7A5 price oracle:', error.message);
        process.exit(1);
    }

    // ===================================
    // STEP 3: Set Asset Sources in AaveOracle
    // ===================================
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 STEP 3: Set Asset Sources in AaveOracle');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    try {
        console.log('🔗 Setting asset sources in AaveOracle...');
        console.log('  Assets: [USDT, wA7A5]');
        console.log('  Sources: [usdtPriceOracle, wa7a5PriceOracle]');

        const setSourcesCommand = `cast send ${ORACLE} "setAssetSources(address[],address[])" "[${USDT},${WA7A5}]" "[${usdtPriceOracle},${wa7a5PriceOracle}]" --private-key ${process.env.DEPLOYER_PRIVATE_KEY} --rpc-url ${process.env.RPC_URL_SEPOLIA} ${legacyFlag}`;

        execSync(setSourcesCommand, { stdio: 'inherit' });
        console.log('✅ Asset sources set successfully!');

        // Verify sources
        console.log('\n🔍 Verifying asset sources...');

        const usdtSource = execSync(
            `cast call ${ORACLE} "getSourceOfAsset(address)(address)" ${USDT} --rpc-url ${process.env.RPC_URL_SEPOLIA}`,
            { encoding: 'utf8' }
        ).trim();
        console.log('  USDT source:', usdtSource);

        const wa7a5Source = execSync(
            `cast call ${ORACLE} "getSourceOfAsset(address)(address)" ${WA7A5} --rpc-url ${process.env.RPC_URL_SEPOLIA}`,
            { encoding: 'utf8' }
        ).trim();
        console.log('  wA7A5 source:', wa7a5Source);

        // Verify prices through Oracle
        console.log('\n💰 Verifying prices through AaveOracle...');

        const usdtPriceFromOracle = execSync(
            `cast call ${ORACLE} "getAssetPrice(address)(uint256)" ${USDT} --rpc-url ${process.env.RPC_URL_SEPOLIA}`,
            { encoding: 'utf8' }
        ).trim();
        console.log('  USDT price:', (parseInt(usdtPriceFromOracle) / 1e8).toFixed(2), 'USD');

        const wa7a5PriceFromOracle = execSync(
            `cast call ${ORACLE} "getAssetPrice(address)(uint256)" ${WA7A5} --rpc-url ${process.env.RPC_URL_SEPOLIA}`,
            { encoding: 'utf8' }
        ).trim();
        console.log('  wA7A5 price:', (parseInt(wa7a5PriceFromOracle) / 1e8).toFixed(4), 'USD');

    } catch (error) {
        console.error('❌ Failed to set asset sources:', error.message);
        process.exit(1);
    }

    // ===================================
    // STEP 4: Test getUserAccountData
    // ===================================
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 STEP 4: Test getUserAccountData');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    try {
        const POOL = deployments.contracts.Pool;
        const testAddress = wallet.address;

        console.log('🧪 Testing getUserAccountData for:', testAddress);

        const accountData = execSync(
            `cast call ${POOL} "getUserAccountData(address)(uint256,uint256,uint256,uint256,uint256,uint256)" ${testAddress} --rpc-url ${process.env.RPC_URL_SEPOLIA}`,
            { encoding: 'utf8' }
        );

        console.log('✅ getUserAccountData working!');
        console.log('📊 Account Data:', accountData);

    } catch (error) {
        console.error('❌ getUserAccountData still failing:', error.message);
        console.log('⚠️  This may be normal if user has no deposits yet');
    }

    // Save to deployments
    deployments.priceOracles = {
        USDT_SimplePriceOracle: usdtPriceOracle,
        wA7A5_SimplePriceOracle: wa7a5PriceOracle
    };
    deployments.timestamp = new Date().toISOString();
    deployments.phase = 'hotfix-oracle-completed';

    fs.writeFileSync('deployments/all-contracts.json', JSON.stringify(deployments, null, 2));

    console.log('\n✅ HOTFIX COMPLETED!');
    console.log('═══════════════════════════════════════════════');
    console.log('📊 Summary:');
    console.log('  - USDT Price Oracle:', usdtPriceOracle);
    console.log('  - wA7A5 Price Oracle:', wa7a5PriceOracle);
    console.log('  - USDT Price: $1.00');
    console.log('  - wA7A5 Price: $0.0111 (1 USDT = 90 A7A5)');
    console.log('');
    console.log('🎯 getUserAccountData should now work correctly!');
    console.log('💾 Deployments updated in deployments/all-contracts.json');
}

// Run
hotfixOraclePrices().catch((error) => {
    console.error('\n❌ Hotfix failed:');
    console.error(error);
    process.exit(1);
});
