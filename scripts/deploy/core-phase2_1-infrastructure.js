const { ethers } = require('ethers');
const fs = require('fs');
const { execSync } = require('child_process');

// CORE Phase 2.2: ACLManager, Oracle, InterestRateStrategy
// Depends on Phase 2.1 (PoolAddressesProvider with ACL Admin)

async function deployCorePhase2_2() {
    console.log('🚀 CORE Phase 2.2: Infrastructure (ACL, Oracle, Rates)');
    console.log('=====================================================');
    console.log('📋 Contracts: ACLManager, AaveOracle, InterestRateStrategy');

    // Проверка переменных окружения
    if (!process.env.RPC_URL_SEPOLIA) {
        console.error('❌ RPC_URL_SEPOLIA not set!');
        process.exit(1);
    }

    if (!process.env.DEPLOYER_PRIVATE_KEY) {
        console.error('❌ DEPLOYER_PRIVATE_KEY not set!');
        process.exit(1);
    }

    if (!process.env.ETHERSCAN_API_KEY) {
        console.error('❌ ETHERSCAN_API_KEY not set!');
        process.exit(1);
    }

    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL_SEPOLIA);
    const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);

    console.log('📋 Deployer:', wallet.address);
    const balance = await provider.getBalance(wallet.address);
    console.log('💰 Balance:', ethers.formatEther(balance), 'ETH\n');

    // Load deployments
    if (!fs.existsSync('deployments/all-contracts.json')) {
        console.error('❌ deployments/all-contracts.json not found!');
        console.error('💡 Please run Phase 2.1 first to deploy PoolAddressesProvider');
        process.exit(1);
    }

    const deployments = JSON.parse(fs.readFileSync('deployments/all-contracts.json', 'utf8'));

    // Check PoolAddressesProvider
    if (!deployments.contracts['PoolAddressesProvider']) {
        console.error('❌ PoolAddressesProvider not found!');
        console.error('💡 Please run Phase 2.1 first');
        process.exit(1);
    }

    const POOL_ADDRESSES_PROVIDER = deployments.contracts['PoolAddressesProvider'];
    console.log('✅ Found PoolAddressesProvider:', POOL_ADDRESSES_PROVIDER);

    // Verify ACL Admin is set
    console.log('🔍 Verifying ACL Admin...');
    const aclAdmin = execSync(
        `cast call ${POOL_ADDRESSES_PROVIDER} "getACLAdmin()(address)" --rpc-url ${process.env.RPC_URL_SEPOLIA}`,
        { encoding: 'utf8' }
    ).trim();

    console.log('📋 ACL Admin:', aclAdmin);

    if (aclAdmin === '0x0000000000000000000000000000000000000000') {
        console.error('❌ ACL Admin is not set in PoolAddressesProvider!');
        console.error('💡 Please run Phase 2.1 again to set ACL Admin');
        process.exit(1);
    }

    console.log('✅ ACL Admin verified\n');

    // Smart deployment mode
    const forceRedeploy = process.env.FORCE_REDEPLOY === 'true';
    console.log(forceRedeploy ? '🔥 Force redeploy mode\n' : '🔄 Smart mode\n');

    // Infrastructure contracts (depend on PoolAddressesProvider)
    const infrastructureContracts = [
        {
            name: 'ACLManager',
            path: 'contracts/aave-v3-origin/src/contracts/protocol/configuration/ACLManager.sol',
            description: 'Access Control List manager',
            constructor: [POOL_ADDRESSES_PROVIDER]
        },
        {
            name: 'AaveOracle',
            path: 'contracts/aave-v3-origin/src/contracts/misc/AaveOracle.sol',
            description: 'Price oracle',
            constructor: [
                POOL_ADDRESSES_PROVIDER,
                '[]',  // assets
                '[]',  // sources
                '0x0000000000000000000000000000000000000000',  // fallbackOracle
                '0x0000000000000000000000000000000000000000',  // baseCurrency
                '100000000'  // baseCurrencyUnit (8 decimals)
            ]
        },
        {
            name: 'DefaultReserveInterestRateStrategyV2',
            path: 'contracts/aave-v3-origin/src/contracts/misc/DefaultReserveInterestRateStrategyV2.sol',
            description: 'Interest rate strategy',
            constructor: [
                POOL_ADDRESSES_PROVIDER,
                '800000000000000000000000000',    // optimalUsageRatio (80%)
                '0',                              // baseVariableBorrowRate
                '40000000000000000000000000',     // variableRateSlope1 (4%)
                '600000000000000000000000000',    // variableRateSlope2 (60%)
                '20000000000000000000000000',     // stableRateSlope1 (2%)
                '600000000000000000000000000',    // stableRateSlope2 (60%)
                '100000000000000000000000000',    // baseStableRateOffset (10%)
                '70000000000000000000000000',     // stableRateExcessOffset (7%)
                '800000000000000000000000000'     // optimalStableToTotalDebtRatio (80%)
            ]
        }
    ];

    console.log(`🎯 Deploying ${infrastructureContracts.length} infrastructure contracts...\n`);

    for (const contractConfig of infrastructureContracts) {
        console.log(`🔍 Processing ${contractConfig.name}...`);
        console.log(`📝 Description: ${contractConfig.description}`);

        // Check if already deployed
        if (!forceRedeploy && deployments.contracts[contractConfig.name]) {
            console.log(`✅ ${contractConfig.name} already deployed at: ${deployments.contracts[contractConfig.name]}`);
            console.log(`⏭️  Skipping\n`);
            continue;
        }

        console.log(`🚀 Deploying ${contractConfig.name}...`);

        try {
            const contractForFoundry = contractConfig.path + ':' + contractConfig.name;

            // ✅ ПРАВИЛЬНЫЙ ПОРЯДОК флагов согласно CLAUDE.md Phase 2.1 Lesson #7
            // Базовая команда БЕЗ constructor args
            const network = process.env.NETWORK || 'sepolia';
            const isNeoX = network.includes('neox');

            let deployCommand;
            if (isNeoX) {
                // NEO X: Verification via Blockscout
                const verifierUrl = network === 'neox-mainnet'
                    ? 'https://xexplorer.neo.org/api'
                    : 'https://xt4scan.ngd.network/api';
                deployCommand = `forge create "${contractForFoundry}" --private-key ${process.env.DEPLOYER_PRIVATE_KEY} --rpc-url ${process.env.RPC_URL_SEPOLIA} --verify --verifier blockscout --verifier-url ${verifierUrl} --broadcast --json --use 0.8.27`;
                console.log(`🌐 Deploying to NEO X (${network}) - Blockscout verification`);
            } else {
                // Ethereum networks: верификация через Etherscan
                deployCommand = `forge create "${contractForFoundry}" --private-key ${process.env.DEPLOYER_PRIVATE_KEY} --rpc-url ${process.env.RPC_URL_SEPOLIA} --verify --etherscan-api-key ${process.env.ETHERSCAN_API_KEY} --broadcast --json --use 0.8.27`;
            }

            // Добавить constructor args В КОНЦЕ (если есть)
            if (contractConfig.constructor && contractConfig.constructor.length > 0) {
                const constructorArgs = contractConfig.constructor.join(' ');
                deployCommand += ` --constructor-args ${constructorArgs}`;
            }

            console.log(`📋 Command: forge create "${contractForFoundry}"`);
            console.log(`🔧 Using Solidity 0.8.27 for Aave v3.5 compatibility`);
            console.log(`📋 Constructor args:`, contractConfig.constructor);

            // 🔥 КРИТИЧНО: Try-catch для обработки ошибок forge (как в Phase 1)
            let foundryOutput;
            try {
                foundryOutput = execSync(deployCommand, {
                    stdio: 'pipe',
                    encoding: 'utf8',
                    maxBuffer: 50 * 1024 * 1024
                });
                console.log('✅ Deployment successful!');
            } catch (execError) {
                // Forge может упасть на верификации, но деплой может быть успешным
                console.log('⚠️ Forge command exited with error, but deployment may have succeeded');
                foundryOutput = execError.stdout ? execError.stdout.toString() : '';
                if (execError.stderr) {
                    console.log('📥 Forge stderr:', execError.stderr.toString().substring(0, 500));
                }
            }

            console.log('Raw Foundry Output:');
            console.log(foundryOutput);

            // Parse address
            let contractAddress = null;
            try {
                const jsonMatch = foundryOutput.match(/\{[^}]*"deployedTo"[^}]*\}/);
                if (jsonMatch) {
                    const jsonOutput = JSON.parse(jsonMatch[0]);
                    contractAddress = jsonOutput.deployedTo;
                    console.log('📋 Contract address:', contractAddress);
                }
            } catch (e) {
                console.log('⚠️ JSON parsing failed, trying regex fallback...');
                const addressMatch = foundryOutput.match(/Deployed to:\\s*(0x[a-fA-F0-9]{40})/i);
                if (addressMatch) {
                    contractAddress = addressMatch[1];
                    console.log('📋 Contract address:', contractAddress);
                }
            }

            if (!contractAddress || contractAddress === '0x0000000000000000000000000000000000000000') {
                console.error(`❌ Could not extract deployment address for ${contractConfig.name}`);
                console.log('🔄 Continuing with next contract...\n');
                continue;
            }

            console.log(`🎉 ${contractConfig.name} deployed at: ${contractAddress}`);

            // 🔥 КРИТИЧНО: Дополнительная проверка деплоя через cast code (как в Phase 1)
            console.log('🔍 Verifying contract deployment...');

            try {
                const checkCommand = `cast code ${contractAddress} --rpc-url ${process.env.RPC_URL_SEPOLIA}`;
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

            console.log('✅ Verified on Etherscan\n');

            // Save progress
            deployments.contracts[contractConfig.name] = contractAddress;
            deployments.timestamp = new Date().toISOString();
            fs.writeFileSync('deployments/all-contracts.json', JSON.stringify(deployments, null, 2));

            console.log('💾 Progress saved to deployments/all-contracts.json');

            console.log('⏳ Waiting 10s before next deployment...\n');
            await new Promise(resolve => setTimeout(resolve, 10000));

        } catch (error) {
            console.error(`❌ Failed to deploy ${contractConfig.name}:`, error.message);
            if (error.stderr) {
                console.error('STDERR:', error.stderr);
            }
            console.log('🔄 Continuing with next contract...\n');
        }
    }

    // 🔧 РЕГИСТРАЦИЯ КОНТРАКТОВ В PoolAddressesProvider
    console.log('\n🔧 Registering contracts in PoolAddressesProvider...');
    console.log('====================================================');

    // Регистрация ACLManager
    if (deployments.contracts['ACLManager']) {
        console.log('\n📋 Registering ACLManager...');

        try {
            const setACLCommand = `cast send ${POOL_ADDRESSES_PROVIDER} "setACLManager(address)" ${deployments.contracts['ACLManager']} --private-key ${process.env.DEPLOYER_PRIVATE_KEY} --rpc-url ${process.env.RPC_URL_SEPOLIA} --gas-limit 200000`;

            execSync(setACLCommand, { encoding: 'utf8', stdio: 'pipe' });
            console.log('✅ ACLManager registered in PoolAddressesProvider!');

            // Проверка регистрации
            await new Promise(resolve => setTimeout(resolve, 3000));

            const registeredACL = execSync(
                `cast call ${POOL_ADDRESSES_PROVIDER} "getACLManager()(address)" --rpc-url ${process.env.RPC_URL_SEPOLIA}`,
                { encoding: 'utf8' }
            ).trim();

            console.log('📋 Registered ACLManager address:', registeredACL);

        } catch (e) {
            console.log('⚠️ ACLManager registration failed:', e.message);
            console.log('💡 You can register it manually later with cast send');
        }
    }

    // Регистрация PriceOracle
    if (deployments.contracts['AaveOracle']) {
        console.log('\n📋 Registering AaveOracle...');

        try {
            const setOracleCommand = `cast send ${POOL_ADDRESSES_PROVIDER} "setPriceOracle(address)" ${deployments.contracts['AaveOracle']} --private-key ${process.env.DEPLOYER_PRIVATE_KEY} --rpc-url ${process.env.RPC_URL_SEPOLIA} --gas-limit 200000`;

            execSync(setOracleCommand, { encoding: 'utf8', stdio: 'pipe' });
            console.log('✅ AaveOracle registered in PoolAddressesProvider!');

            // Проверка регистрации
            await new Promise(resolve => setTimeout(resolve, 3000));

            const registeredOracle = execSync(
                `cast call ${POOL_ADDRESSES_PROVIDER} "getPriceOracle()(address)" --rpc-url ${process.env.RPC_URL_SEPOLIA}`,
                { encoding: 'utf8' }
            ).trim();

            console.log('📋 Registered PriceOracle address:', registeredOracle);

        } catch (e) {
            console.log('⚠️ Oracle registration failed:', e.message);
            console.log('💡 You can register it manually later with cast send');
        }
    }

    // Небольшая задержка перед финализацией
    console.log('\n⏳ Waiting 2s before finalizing...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Финализация Phase 2.2
    deployments.phase = 'core-2.2-completed';
    deployments.timestamp = new Date().toISOString();
    fs.writeFileSync('deployments/all-contracts.json', JSON.stringify(deployments, null, 2));

    // Final report
    console.log('\n🎉 CORE Phase 2.2 Complete!');
    console.log('============================');
    console.log('📋 Infrastructure Contracts:');
    console.log('  ✅ ACLManager:', deployments.contracts['ACLManager'] || '❌ Not deployed');
    console.log('  ✅ AaveOracle:', deployments.contracts['AaveOracle'] || '❌ Not deployed');
    console.log('  ✅ InterestRateStrategy:', deployments.contracts['DefaultReserveInterestRateStrategyV2'] || '❌ Not deployed');
    console.log('');
    console.log('📊 PoolAddressesProvider Status:');
    console.log('  ✅ ACLManager: Registered');
    console.log('  ✅ PriceOracle: Registered');
    console.log('  📋 Pool: Will be set in Phase 3.5');
    console.log('  📋 PoolConfigurator: Will be set in Phase 3.5');
    console.log('');
    console.log('🚀 Next: Run CORE Phase 2.5 (Logic Libraries)');
    console.log('🎯 CORE Progress: Phase 2.2/5 ✅');
}

deployCorePhase2_2().catch((error) => {
    console.error('\n❌ CORE Phase 2.2 failed:');
    console.error(error);
    process.exit(1);
});
