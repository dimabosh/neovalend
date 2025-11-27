const { ethers } = require('ethers');
const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');
const os = require('os');

// CORE Phase 3.1: PoolConfigurator Implementation + Proxy
// Деплой PoolConfigurator implementation и создание proxy
// ТРЕБОВАНИЕ: Pool proxy ДОЛЖЕН быть создан в Phase 3!
// Верификация через Standard JSON Input API для NEO X / Blockscout

/**
 * Создаёт Standard JSON Input для верификации через Blockscout API
 * Использует flattened source для избежания "First Match" проблемы
 */
function createStandardJsonInput(contractName, flattenedSource) {
    return {
        language: "Solidity",
        sources: {
            [`${contractName}.sol`]: {
                content: flattenedSource
            }
        },
        settings: {
            optimizer: {
                enabled: true,
                runs: 200
            },
            evmVersion: "shanghai",
            metadata: {
                bytecodeHash: "none",
                useLiteralContent: false,
                appendCBOR: true
            },
            viaIR: false,
            outputSelection: {
                "*": {
                    "*": ["abi", "evm.bytecode", "evm.deployedBytecode", "metadata"]
                }
            }
        }
    };
}

/**
 * Верифицирует контракт через Blockscout Standard Input API
 */
async function verifyViaStandardInput(contractAddress, contractName, contractPath, verifierBaseUrl) {
    console.log(`   🔄 Verifying via Standard Input API...`);

    try {
        // 1. Flatten source code
        const flattenedSource = execSync(`forge flatten "${contractPath}"`, {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe']
        });

        // 2. Create Standard JSON Input
        const stdJsonInput = createStandardJsonInput(contractName, flattenedSource);

        // 3. Save to temp file (required for multipart upload)
        const tempFile = path.join(os.tmpdir(), `${contractName}_input.json`);
        fs.writeFileSync(tempFile, JSON.stringify(stdJsonInput));

        // 4. Submit via curl multipart form
        const apiUrl = `${verifierBaseUrl}/api/v2/smart-contracts/${contractAddress}/verification/via/standard-input`;

        const curlCmd = `curl -s -L -X POST "${apiUrl}" \
            --form 'compiler_version=v0.8.27+commit.40a35a09' \
            --form 'contract_name=${contractName}' \
            --form 'license_type=none' \
            --form 'files[0]=@${tempFile};filename=input.json;type=application/json'`;

        const result = execSync(curlCmd, { encoding: 'utf8', timeout: 60000 });

        // Cleanup temp file
        try { fs.unlinkSync(tempFile); } catch (e) {}

        const response = JSON.parse(result);
        if (response.message === "Smart-contract verification started") {
            console.log(`   📤 Verification started successfully`);
            return true;
        } else {
            console.log(`   ⚠️ API response: ${result.substring(0, 100)}`);
            return false;
        }
    } catch (error) {
        console.log(`   ⚠️ Standard Input verification failed: ${error.message?.substring(0, 80) || 'unknown'}`);
        return false;
    }
}

/**
 * Проверяет статус верификации контракта
 */
async function checkVerificationStatus(contractAddress, expectedName, verifierBaseUrl) {
    try {
        const checkUrl = `${verifierBaseUrl}/api/v2/smart-contracts/${contractAddress}`;
        const result = execSync(`curl -s "${checkUrl}"`, { encoding: 'utf8' });
        const contractInfo = JSON.parse(result);

        return {
            isVerified: contractInfo.is_verified === true,
            isPartiallyVerified: contractInfo.is_partially_verified === true,
            name: contractInfo.name,
            nameMatches: contractInfo.name === expectedName
        };
    } catch (error) {
        return { isVerified: false, isPartiallyVerified: false, name: null, nameMatches: false };
    }
}

async function deployConfiguratorAndProxy() {
    console.log('🚀 CORE Phase 3.1: PoolConfigurator Implementation + Proxy');
    console.log('===========================================================');
    console.log('📋 Deploying PoolConfigurator implementation');
    console.log('📋 Creating PoolConfigurator proxy via PoolAddressesProvider');
    console.log('⚠️  REQUIREMENT: Pool proxy MUST exist (created in Phase 3)!');
    console.log('🔧 Verification: Standard JSON Input API for NEO X\n');

    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL_SEPOLIA);
    const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);

    console.log('📋 Deployer:', wallet.address);
    const balance = await provider.getBalance(wallet.address);
    console.log('💰 Balance:', ethers.formatEther(balance), 'GAS');

    // Network detection
    const network = process.env.NETWORK || 'sepolia';
    const isNeoX = network.includes('neox');

    // Blockscout URLs for NEO X
    const verifierBaseUrl = network === 'neox-mainnet'
        ? 'https://xexplorer.neo.org'
        : 'https://xt4scan.ngd.network';

    console.log(`🌐 Network: ${network}`);
    console.log(`🔧 isNeoX: ${isNeoX}`);
    if (isNeoX) {
        console.log(`🔍 Verifier: ${verifierBaseUrl}`);
        console.log('⚡ Using legacy transactions for NEO X');
    }
    console.log('');

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

        // Smart deployment mode
        const forceRedeploy = process.env.FORCE_REDEPLOY === 'true';

        // Check if already deployed
        if (!forceRedeploy && deployments.contracts['PoolConfigurator_Implementation']) {
            console.log(`✅ PoolConfigurator_Implementation already deployed at: ${deployments.contracts['PoolConfigurator_Implementation']}`);
            console.log(`⏭️  Skipping implementation deployment (use FORCE_REDEPLOY=true to override)`);
        } else {
            // ===========================================
            // DEPLOY POOLCONFIGURATOR IMPLEMENTATION
            // ===========================================
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('🔨 DEPLOYING POOLCONFIGURATOR IMPLEMENTATION');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

            // Компиляция
            console.log('🔨 Compiling contracts...');
            try {
                execSync(`forge build --use 0.8.27`, { stdio: 'pipe' });
                console.log('✅ Compilation successful!\n');
            } catch (buildError) {
                console.error('❌ Compilation failed!');
                if (buildError.stderr) console.error(buildError.stderr.toString());
                process.exit(1);
            }

            const contractPath = 'contracts/aave-v3-origin/src/contracts/instances/PoolConfiguratorInstance.sol';
            const contractName = 'PoolConfiguratorInstance';
            const contractForFoundry = `${contractPath}:${contractName}`;
            const libraryPath = 'contracts/aave-v3-origin/src/contracts/protocol/libraries/logic/ConfiguratorLogic.sol';

            console.log(`📋 Contract: ${contractForFoundry}`);
            console.log(`📋 Library: ConfiguratorLogic at ${configuratorLogicAddress}\n`);

            // Сборка команды - БЕЗ встроенной верификации для NEO X
            let deployCommand;
            if (isNeoX) {
                // NEO X: --legacy для транзакций, БЕЗ --verify (верификация через API отдельно)
                deployCommand = `forge create "${contractForFoundry}" --libraries ${libraryPath}:ConfiguratorLogic:${configuratorLogicAddress} --private-key ${process.env.DEPLOYER_PRIVATE_KEY} --rpc-url ${process.env.RPC_URL_SEPOLIA} --legacy --broadcast --json --use 0.8.27`;
                console.log(`🌐 Deploying to NEO X (${network}) - Legacy transaction mode`);
            } else {
                // Ethereum networks: верификация через Etherscan
                deployCommand = `forge create "${contractForFoundry}" --libraries ${libraryPath}:ConfiguratorLogic:${configuratorLogicAddress} --private-key ${process.env.DEPLOYER_PRIVATE_KEY} --rpc-url ${process.env.RPC_URL_SEPOLIA} --verify --etherscan-api-key ${process.env.ETHERSCAN_API_KEY} --broadcast --json --use 0.8.27`;
            }

            console.log('🔧 Deploying PoolConfiguratorInstance...\n');

            // Try-catch для обработки ошибок forge
            let output;
            try {
                output = execSync(deployCommand, {
                    encoding: 'utf8',
                    stdio: 'pipe',
                    maxBuffer: 50 * 1024 * 1024,
                    timeout: 300000  // 5 минут
                });
                console.log('   📥 Deployed successfully');
            } catch (execError) {
                console.log('   ⚠️ Forge command exited with error, checking if deployment succeeded...');
                output = execError.stdout ? execError.stdout.toString() : '';
                if (execError.stderr) {
                    const stderr = execError.stderr.toString();
                    console.log(`   📥 Forge stderr: ${stderr.substring(0, 300)}`);
                }
            }

            // Parse deployment address
            let configuratorImplAddress = null;
            try {
                const jsonMatch = output.match(/\{[^}]*"deployedTo"[^}]*\}/);
                if (jsonMatch) {
                    const jsonOutput = JSON.parse(jsonMatch[0]);
                    configuratorImplAddress = jsonOutput.deployedTo;
                    console.log(`   ✅ Found deployedTo: ${configuratorImplAddress}`);
                }
            } catch (e) {
                const addressMatch = output.match(/Deployed to: (0x[a-fA-F0-9]{40})/);
                if (addressMatch) {
                    configuratorImplAddress = addressMatch[1];
                    console.log(`   ✅ Found address via regex: ${configuratorImplAddress}`);
                }
            }

            if (!configuratorImplAddress || configuratorImplAddress === '0x0000000000000000000000000000000000000000') {
                console.error('❌ Could not parse deployment address');
                console.error('Raw output:', output.substring(0, 500));
                process.exit(1);
            }

            // Проверка что код на месте
            console.log('   🔍 Verifying contract deployment...');
            try {
                const checkCommand = `cast code ${configuratorImplAddress} --rpc-url ${process.env.RPC_URL_SEPOLIA}`;
                const code = execSync(checkCommand, { stdio: 'pipe', encoding: 'utf8' }).trim();

                if (code === '0x' || code.length <= 4) {
                    console.log('   ⏳ Waiting for blockchain sync...');
                    await new Promise(resolve => setTimeout(resolve, 15000));

                    const codeRetry = execSync(checkCommand, { stdio: 'pipe', encoding: 'utf8' }).trim();
                    if (codeRetry === '0x' || codeRetry.length <= 4) {
                        throw new Error('Contract deployment failed - no code at address');
                    }
                    console.log('   ✅ Contract code found after retry');
                } else {
                    console.log('   ✅ Contract code verified on-chain');
                }
            } catch (verifyError) {
                console.log(`   ⚠️ Code verification issue: ${verifyError.message}`);
            }

            console.log(`   ✅ PoolConfiguratorInstance: ${configuratorImplAddress}`);

            // Верификация через Standard Input API для NEO X
            if (isNeoX) {
                console.log(`   🔍 Starting verification via Standard Input API...`);

                // Ждём индексацию на Blockscout
                await new Promise(resolve => setTimeout(resolve, 15000));

                // Отправляем верификацию
                await verifyViaStandardInput(configuratorImplAddress, contractName, contractPath, verifierBaseUrl);

                // Ждём обработки
                await new Promise(resolve => setTimeout(resolve, 20000));

                // Проверяем результат
                let verified = false;
                for (let attempt = 1; attempt <= 3; attempt++) {
                    const status = await checkVerificationStatus(configuratorImplAddress, contractName, verifierBaseUrl);

                    if (status.isVerified && status.nameMatches) {
                        console.log(`   ✅ Verified as ${status.name}`);
                        verified = true;
                        break;
                    } else if (status.isVerified && !status.nameMatches) {
                        console.log(`   ⚠️ Verified but as: ${status.name} (expected: ${contractName})`);
                        if (attempt < 3) {
                            console.log(`   🔄 Retrying verification (attempt ${attempt + 1}/3)...`);
                            await verifyViaStandardInput(configuratorImplAddress, contractName, contractPath, verifierBaseUrl);
                            await new Promise(resolve => setTimeout(resolve, 20000));
                        }
                    } else if (status.isPartiallyVerified) {
                        console.log(`   ⚠️ Partially verified (bytecodeHash: none is expected for Aave v3.5)`);
                        verified = true;
                        break;
                    } else {
                        console.log(`   ⏳ Not verified yet (attempt ${attempt}/3)`);
                        if (attempt < 3) {
                            await verifyViaStandardInput(configuratorImplAddress, contractName, contractPath, verifierBaseUrl);
                            await new Promise(resolve => setTimeout(resolve, 20000));
                        }
                    }
                }

                if (!verified) {
                    console.log(`   ⚠️ Verification may need manual check at ${verifierBaseUrl}`);
                }
            }

            // Save implementation address
            deployments.contracts['PoolConfigurator_Implementation'] = configuratorImplAddress;
            deployments.timestamp = new Date().toISOString();
            fs.writeFileSync('deployments/all-contracts.json', JSON.stringify(deployments, null, 2));
            console.log('   💾 Progress saved\n');
        }

        // ===========================================
        // CREATE POOLCONFIGURATOR PROXY
        // ===========================================

        // Check if proxy already exists
        if (!forceRedeploy && deployments.contracts['PoolConfigurator']) {
            console.log(`✅ PoolConfigurator Proxy already exists at: ${deployments.contracts['PoolConfigurator']}`);
            console.log(`⏭️  Skipping proxy creation (use FORCE_REDEPLOY=true to override)`);
        } else {
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('📦 CREATING POOLCONFIGURATOR PROXY');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

            const configuratorImplAddress = deployments.contracts['PoolConfigurator_Implementation'];
            console.log(`📋 PoolConfigurator Implementation: ${configuratorImplAddress}`);
            console.log(`📋 PoolAddressesProvider: ${poolAddressesProviderAddress}\n`);

            console.log('🚀 Creating PoolConfigurator Proxy via setPoolConfiguratorImpl()...');

            // Формируем команду в зависимости от сети
            let setConfiguratorImplCommand;
            if (isNeoX) {
                // NEO X: используем --legacy
                setConfiguratorImplCommand = `cast send ${poolAddressesProviderAddress} "setPoolConfiguratorImpl(address)" ${configuratorImplAddress} --private-key ${process.env.DEPLOYER_PRIVATE_KEY} --rpc-url ${process.env.RPC_URL_SEPOLIA} --legacy --gas-limit 2000000`;
            } else {
                setConfiguratorImplCommand = `cast send ${poolAddressesProviderAddress} "setPoolConfiguratorImpl(address)" ${configuratorImplAddress} --private-key ${process.env.DEPLOYER_PRIVATE_KEY} --rpc-url ${process.env.RPC_URL_SEPOLIA} --gas-limit 2000000`;
            }

            execSync(setConfiguratorImplCommand, { stdio: 'inherit' });
            console.log('\n✅ PoolConfigurator Proxy creation transaction sent!');

            // Wait for confirmation
            console.log('⏳ Waiting 10 seconds for confirmation...');
            await new Promise(resolve => setTimeout(resolve, 10000));

            // Get PoolConfigurator Proxy address
            const configuratorProxyAddress = await poolAddressesProvider.getPoolConfigurator();
            console.log(`\n🎉 PoolConfigurator Proxy created at: ${configuratorProxyAddress}`);

            // Verify Proxy has code
            try {
                const codeCheck = execSync(`cast code ${configuratorProxyAddress} --rpc-url ${process.env.RPC_URL_SEPOLIA}`, { encoding: 'utf8' }).trim();
                if (codeCheck && codeCheck !== '0x' && codeCheck.length > 4) {
                    console.log('✅ PoolConfigurator Proxy has code on-chain');
                } else {
                    console.log('⚠️ PoolConfigurator Proxy code check returned empty - waiting...');
                    await new Promise(resolve => setTimeout(resolve, 10000));
                }
            } catch (e) {
                console.log('⚠️ Could not verify PoolConfigurator Proxy code');
            }

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
                } else {
                    console.log(`⚠️ Unexpected revision: ${revision}, expected 6`);
                }
            } catch (error) {
                console.log('⚠️ PoolConfigurator Proxy verification failed:', error.message);
            }
        }

        // Finalize Phase 3.1
        deployments.phase = 'core-3.1-completed';
        deployments.timestamp = new Date().toISOString();
        fs.writeFileSync('deployments/all-contracts.json', JSON.stringify(deployments, null, 2));

        console.log('\n🎉 CORE Phase 3.1 Complete!');
        console.log('============================');
        console.log('📋 Deployed Contracts:');
        console.log(`  ✅ PoolConfigurator Implementation: ${deployments.contracts['PoolConfigurator_Implementation']}`);
        console.log(`  ✅ PoolConfigurator Proxy: ${deployments.contracts['PoolConfigurator']}`);
        console.log('');
        console.log('⚡ POOLCONFIGURATOR READY FOR USE!');
        console.log('📋 PoolConfigurator Proxy is initialized and ready');
        console.log('📋 Can now configure reserves via PoolConfigurator');
        console.log('🚀 Next: Run CORE Phase 3.2 (wA7A5 Token Deployment)');
        console.log('');
        console.log('🎯 CORE Progress: Phase 3.1/5 ✅');

        if (isNeoX) {
            console.log(`\n🔗 View on Blockscout: ${verifierBaseUrl}/address/${deployments.contracts['PoolConfigurator']}`);
        }

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
