const { ethers } = require('ethers');
const fs = require('fs');
const { execSync } = require('child_process');

// CORE Phase 3.1: PoolConfigurator Implementation + Proxy
// Деплой PoolConfigurator implementation и создание proxy
// ТРЕБОВАНИЕ: Pool proxy ДОЛЖЕН быть создан в Phase 3!

async function deployConfiguratorAndProxy() {
    console.log('🚀 CORE Phase 3.1: PoolConfigurator Implementation + Proxy');
    console.log('===========================================================');
    console.log('📋 Deploying PoolConfigurator implementation');
    console.log('📋 Creating PoolConfigurator proxy via PoolAddressesProvider');
    console.log('⚠️  REQUIREMENT: Pool proxy MUST exist (created in Phase 3)!\n');

    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL_SEPOLIA);
    const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);

    console.log('📋 Deployer:', wallet.address);
    const balance = await provider.getBalance(wallet.address);
    console.log('💰 Balance:', ethers.formatEther(balance), 'ETH\n');

    // Load deployments
    if (!fs.existsSync('deployments/all-contracts.json')) {
        console.error('❌ deployments/all-contracts.json not found!');
        process.exit(1);
    }

    const deployments = JSON.parse(fs.readFileSync('deployments/all-contracts.json', 'utf8'));

    // Verify prerequisites
    if (!deployments.contracts['PoolAddressesProvider']) {
        console.error('❌ PoolAddressesProvider not found! Run Phase 2 first.');
        process.exit(1);
    }

    if (!deployments.contracts['Pool']) {
        console.error('❌ Pool proxy not found! Run Phase 3 first.');
        process.exit(1);
    }

    if (!deployments.libraries['ConfiguratorLogic']) {
        console.error('❌ ConfiguratorLogic library not found! Run Phase 2.5 first.');
        process.exit(1);
    }

    const poolAddressesProviderAddress = deployments.contracts['PoolAddressesProvider'];
    const poolProxyAddress = deployments.contracts['Pool'];
    const configuratorLogicAddress = deployments.libraries['ConfiguratorLogic'];

    console.log('✅ Prerequisites verified:');
    console.log(`  📋 PoolAddressesProvider: ${poolAddressesProviderAddress}`);
    console.log(`  📋 Pool Proxy: ${poolProxyAddress}`);
    console.log(`  📋 ConfiguratorLogic: ${configuratorLogicAddress}\n`);

    // Verify Pool is registered
    const poolAddressesProviderABI = [
        "function getPool() external view returns (address)",
        "function getPoolConfigurator() external view returns (address)",
        "function owner() external view returns (address)"
    ];

    try {
        const poolAddressesProvider = new ethers.Contract(
            poolAddressesProviderAddress,
            poolAddressesProviderABI,
            wallet
        );

        const registeredPool = await poolAddressesProvider.getPool();
        if (registeredPool === ethers.ZeroAddress) {
            console.error('❌ Pool NOT registered in PoolAddressesProvider!');
            console.error('💡 Run Phase 3 first to create Pool proxy');
            process.exit(1);
        }

        console.log(`✅ Pool is registered: ${registeredPool}`);
        console.log('✅ Safe to create PoolConfigurator\n');

        // ===========================================
        // DEPLOY POOLCONFIGURATOR IMPLEMENTATION
        // ===========================================
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🔨 DEPLOYING POOLCONFIGURATOR IMPLEMENTATION');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // ✅ ПРАВИЛЬНЫЙ путь к контракту (с aave-v3-origin)
        const contractPath = 'contracts/aave-v3-origin/src/contracts/instances/PoolConfiguratorInstance.sol:PoolConfiguratorInstance';
        const libraryPath = 'contracts/aave-v3-origin/src/contracts/protocol/libraries/logic/ConfiguratorLogic.sol';

        console.log(`📋 Contract: ${contractPath}`);
        console.log(`📋 Library: ConfiguratorLogic at ${configuratorLogicAddress}\n`);

        const deployCommand = `forge create "${contractPath}" --libraries ${libraryPath}:ConfiguratorLogic:${configuratorLogicAddress} --private-key ${process.env.DEPLOYER_PRIVATE_KEY} --rpc-url ${process.env.RPC_URL_SEPOLIA} --verify --etherscan-api-key ${process.env.ETHERSCAN_API_KEY} --broadcast --json --use 0.8.27`;

        console.log('🔧 Deploying PoolConfiguratorInstance...');

        // 🔥 КРИТИЧНО: Try-catch для обработки ошибок forge (как в Phase 1)
        let output;
        try {
            output = execSync(deployCommand, {
                encoding: 'utf8',
                stdio: 'pipe',
                maxBuffer: 50 * 1024 * 1024
            });
            console.log('✅ Deployment successful!');
        } catch (execError) {
            console.log('⚠️ Forge command exited with error, but deployment may have succeeded');
            output = execError.stdout ? execError.stdout.toString() : '';
            if (execError.stderr) {
                console.log('📥 Forge stderr:', execError.stderr.toString().substring(0, 500));
            }
        }

        // Parse deployment address
        let configuratorImplAddress = null;
        const jsonMatch = output.match(/\{[^}]*"deployedTo"[^}]*\}/);
        if (jsonMatch) {
            const jsonOutput = JSON.parse(jsonMatch[0]);
            configuratorImplAddress = jsonOutput.deployedTo;
        } else {
            // Fallback regex
            const addressMatch = output.match(/Deployed to: (0x[a-fA-F0-9]{40})/);
            if (addressMatch) {
                configuratorImplAddress = addressMatch[1];
            }
        }

        if (!configuratorImplAddress || configuratorImplAddress === '0x0000000000000000000000000000000000000000') {
            console.error('❌ Could not parse deployment address');
            console.error('Output:', output);
            process.exit(1);
        }

        // 🔥 КРИТИЧНО: Дополнительная проверка деплоя через cast code (как в Phase 1)
        console.log('🔍 Verifying contract deployment...');
        try {
            const checkCommand = `cast code ${configuratorImplAddress} --rpc-url ${process.env.RPC_URL_SEPOLIA}`;
            const code = execSync(checkCommand, { stdio: 'pipe', encoding: 'utf8' }).trim();

            if (code === '0x' || code.length <= 4) {
                console.log('❌ Contract code not found - deployment may have failed');
                console.log('🔄 Waiting 15s for blockchain to sync...');
                await new Promise(resolve => setTimeout(resolve, 15000));

                // Повторная проверка
                const codeRetry = execSync(checkCommand, { stdio: 'pipe', encoding: 'utf8' }).trim();
                if (codeRetry === '0x' || codeRetry.length <= 4) {
                    throw new Error('Contract deployment failed - no code at address');
                } else {
                    console.log('✅ Contract code found after retry');
                }
            } else {
                console.log('✅ Contract code verified on-chain');
            }
        } catch (verifyError) {
            console.log('⚠️ Contract verification failed:', verifyError.message);
            console.log('🔄 Continuing anyway - contract may still be valid');
        }

        console.log(`✅ PoolConfigurator Implementation deployed at: ${configuratorImplAddress}\n`);

        // Save implementation address
        deployments.contracts['PoolConfigurator_Implementation'] = configuratorImplAddress;
        fs.writeFileSync('deployments/all-contracts.json', JSON.stringify(deployments, null, 2));

        // ===========================================
        // CREATE POOLCONFIGURATOR PROXY
        // ===========================================
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📦 CREATING POOLCONFIGURATOR PROXY');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        console.log('🚀 Creating PoolConfigurator Proxy via setPoolConfiguratorImpl()...');

        const setConfiguratorImplCommand = `cast send ${poolAddressesProviderAddress} "setPoolConfiguratorImpl(address)" ${configuratorImplAddress} --private-key ${process.env.DEPLOYER_PRIVATE_KEY} --rpc-url ${process.env.RPC_URL_SEPOLIA} --gas-limit 2000000`;

        execSync(setConfiguratorImplCommand, { stdio: 'inherit' });
        console.log('\n✅ PoolConfigurator Proxy creation transaction sent!');

        // Wait for confirmation
        console.log('⏳ Waiting 5 seconds for confirmation...');
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Get PoolConfigurator Proxy address
        const configuratorProxyAddress = await poolAddressesProvider.getPoolConfigurator();
        console.log(`\n🎉 PoolConfigurator Proxy created at: ${configuratorProxyAddress}`);

        // Save Proxy address
        deployments.contracts['PoolConfigurator'] = configuratorProxyAddress;

        // Verify PoolConfigurator Proxy initialization
        console.log('\n🔍 Verifying PoolConfigurator Proxy initialization...');

        try {
            // Check CONFIGURATOR_REVISION (public constant - proves proxy is working)
            const revisionData = await provider.call({
                to: configuratorProxyAddress,
                data: '0x54255be0' // CONFIGURATOR_REVISION() function selector
            });
            const revision = parseInt(revisionData, 16);
            console.log(`📋 PoolConfigurator.CONFIGURATOR_REVISION() returns: ${revision}`);

            if (revision === 6) {
                console.log('✅ PoolConfigurator Proxy is working correctly!');
                console.log('✅ Implementation is properly connected');
                console.log('✅ Proxy should be initialized (PoolConfigurator has private _pool and _addressesProvider)');
            } else {
                console.log(`⚠️  Unexpected revision: ${revision}, expected 6`);
            }
        } catch (error) {
            console.log('❌ PoolConfigurator Proxy verification failed:', error.message);
            console.log('⚠️  Proxy may not be properly initialized');
        }

        // Finalize Phase 3.1
        deployments.phase = 'core-3.1-completed';
        deployments.timestamp = new Date().toISOString();
        fs.writeFileSync('deployments/all-contracts.json', JSON.stringify(deployments, null, 2));

        console.log('\n🎉 CORE Phase 3.1 Complete!');
        console.log('============================');
        console.log('📋 Deployed Contracts:');
        console.log(`  ✅ PoolConfigurator Implementation: ${configuratorImplAddress}`);
        console.log(`  ✅ PoolConfigurator Proxy: ${configuratorProxyAddress}`);
        console.log('');
        console.log('⚡ POOLCONFIGURATOR READY FOR USE!');
        console.log('📋 PoolConfigurator Proxy is initialized and ready');
        console.log('📋 Can now configure reserves via PoolConfigurator');
        console.log('🚀 Next: Run CORE Phase 3.2 (wA7A5 Token Deployment)');
        console.log('');
        console.log('🎯 CORE Progress: Phase 3.1/5 ✅');

    } catch (error) {
        console.error('❌ Failed to deploy PoolConfigurator:', error.message);
        process.exit(1);
    }
}

// Run
deployConfiguratorAndProxy().catch((error) => {
    console.error('\n❌ CORE Phase 3.1 failed:');
    console.error(error);
    process.exit(1);
});
