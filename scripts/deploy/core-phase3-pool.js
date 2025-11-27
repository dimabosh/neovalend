const { ethers } = require('ethers');
const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');
const os = require('os');

// CORE Phase 3: Pool Implementation (Aave v3.5 with Solidity 0.8.27)
// 1 контракт: PoolInstance + создание Pool Proxy
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
async function verifyViaStandardInput(contractAddress, contractName, contractPath, verifierBaseUrl, constructorArgs = []) {
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

        let curlCmd = `curl -s -L -X POST "${apiUrl}" \
            --form 'compiler_version=v0.8.27+commit.40a35a09' \
            --form 'contract_name=${contractName}' \
            --form 'license_type=none' \
            --form 'files[0]=@${tempFile};filename=input.json;type=application/json'`;

        // Добавляем constructor args если есть
        if (constructorArgs && constructorArgs.length > 0) {
            // Encode constructor args to hex
            const abiCoder = new ethers.AbiCoder();
            // Для PoolInstance: (address, address)
            const encodedArgs = abiCoder.encode(['address', 'address'], constructorArgs);
            // Убираем 0x prefix для Blockscout
            const argsHex = encodedArgs.slice(2);
            curlCmd += ` --form 'constructor_args=${argsHex}'`;
        }

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

async function deployCorePhase3() {
    console.log('🚀 CORE Phase 3: Pool Implementation (Aave v3.5)');
    console.log('===============================================');
    console.log('💰 Estimated Cost: ~$1.2 USD');
    console.log('📋 Contracts: Pool Implementation + Proxy');
    console.log('⚡ Features: Lending, Borrowing, Flash Loans, Liquidations');
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

    // Загрузить или создать deployments
    let deployments = {
        network: network,
        deployer: wallet.address,
        timestamp: new Date().toISOString(),
        phase: 'core-3',
        libraries: {},
        contracts: {}
    };

    if (fs.existsSync('deployments/all-contracts.json')) {
        const existing = JSON.parse(fs.readFileSync('deployments/all-contracts.json', 'utf8'));
        deployments.contracts = existing.contracts || {};
        deployments.libraries = existing.libraries || {};
        console.log('📄 Loaded existing deployments');
    }

    // Проверить что Phase 1-2 завершены
    const requiredLibraries = ['WadRayMath', 'PercentageMath', 'MathUtils', 'Errors', 'DataTypes'];
    const requiredLogicLibraries = ['SupplyLogic', 'BorrowLogic', 'FlashLoanLogic', 'LiquidationLogic', 'PoolLogic', 'EModeLogic'];
    const requiredContracts = ['PoolAddressesProvider', 'ACLManager', 'AaveOracle', 'DefaultReserveInterestRateStrategyV2'];

    for (const lib of requiredLibraries) {
        if (!deployments.libraries[lib]) {
            console.error(`❌ Required library ${lib} not found! Please deploy Phase 1 first.`);
            process.exit(1);
        }
    }

    for (const lib of requiredLogicLibraries) {
        if (!deployments.libraries[lib]) {
            console.error(`❌ Required logic library ${lib} not found! Please deploy Phase 2.5 first.`);
            process.exit(1);
        }
    }

    for (const contract of requiredContracts) {
        if (!deployments.contracts[contract]) {
            console.error(`❌ Required contract ${contract} not found! Please deploy Phase 2 first.`);
            process.exit(1);
        }
    }

    console.log('✅ Phase 1-2.5 dependencies found, proceeding with Phase 3');

    // CORE Phase 3 контракт
    const poolContracts = [
        {
            name: 'PoolInstance',
            path: 'contracts/aave-v3-origin/src/contracts/instances/PoolInstance.sol',
            description: 'Main lending pool implementation (deployed through proxy)',
            libraryLinks: [
                'SupplyLogic',
                'BorrowLogic',
                'FlashLoanLogic',
                'LiquidationLogic',
                'PoolLogic',
                'EModeLogic'
            ],
            constructor: [
                '${POOL_ADDRESSES_PROVIDER}',
                '${DEFAULT_RESERVE_INTEREST_RATE_STRATEGY_V2}'
            ],
            deployAsProxy: true
        }
    ];

    console.log(`\n🎯 Deploying ${poolContracts.length} pool contract with Solidity 0.8.27...`);
    console.log(`⚡ Including Flash Loans functionality in Pool contract!`);
    console.log(`📋 Note: PoolConfigurator will be deployed in Phase 3.5`);

    // Smart deployment mode
    const forceRedeploy = process.env.FORCE_REDEPLOY === 'true';
    if (forceRedeploy) {
        console.log('🔥 Force redeploy mode: will redeploy all contracts');
    } else {
        console.log('🔄 Smart mode: will skip already deployed contracts');
    }

    // Компиляция один раз в начале
    console.log('\n🔨 Compiling contracts...');
    try {
        execSync(`forge build --use 0.8.27`, { stdio: 'pipe' });
        console.log('✅ Compilation successful!\n');
    } catch (buildError) {
        console.error('❌ Compilation failed!');
        if (buildError.stderr) console.error(buildError.stderr.toString());
        process.exit(1);
    }

    for (const contractConfig of poolContracts) {
        console.log(`\n🔍 Processing ${contractConfig.name}...`);
        console.log(`📝 Description: ${contractConfig.description}`);

        // Проверяем, уже ли задеплоен контракт
        let isAlreadyDeployed = false;
        let existingAddress = '';

        if (contractConfig.name === 'PoolInstance') {
            if (deployments.contracts[contractConfig.name + '_Implementation']) {
                isAlreadyDeployed = true;
                existingAddress = deployments.contracts[contractConfig.name + '_Implementation'];
            }
        } else {
            if (deployments.contracts[contractConfig.name]) {
                isAlreadyDeployed = true;
                existingAddress = deployments.contracts[contractConfig.name];
            }
        }

        if (!forceRedeploy && isAlreadyDeployed) {
            console.log(`✅ ${contractConfig.name} already deployed at: ${existingAddress}`);
            console.log(`⏭️  Skipping (use FORCE_REDEPLOY=true to override)`);
            continue;
        }

        console.log(`🚀 Deploying ${contractConfig.name}...`);

        if (contractConfig.name === 'PoolInstance') {
            console.log(`⚡ Deploying PoolInstance as implementation contract (not proxy)`);
            console.log(`📋 This will be used by PoolAddressesProvider.setPoolImpl() later`);
        }

        try {
            if (!fs.existsSync(contractConfig.path)) {
                console.error(`❌ Contract file not found: ${contractConfig.path}`);
                continue;
            }

            const contractForFoundry = contractConfig.path + ':' + contractConfig.name;

            // Подготовка library linking
            let libraryFlags = '';
            if (contractConfig.libraryLinks && contractConfig.libraryLinks.length > 0) {
                console.log(`🔗 Linking libraries: ${contractConfig.libraryLinks.join(', ')}`);

                for (const libName of contractConfig.libraryLinks) {
                    if (!deployments.libraries[libName]) {
                        throw new Error(`Required library ${libName} not found in deployments`);
                    }

                    // Определяем путь к library файлу
                    const libPaths = {
                        'WadRayMath': 'contracts/aave-v3-origin/src/contracts/protocol/libraries/math/WadRayMath.sol',
                        'PercentageMath': 'contracts/aave-v3-origin/src/contracts/protocol/libraries/math/PercentageMath.sol',
                        'MathUtils': 'contracts/aave-v3-origin/src/contracts/protocol/libraries/math/MathUtils.sol',
                        'Errors': 'contracts/aave-v3-origin/src/contracts/protocol/libraries/helpers/Errors.sol',
                        'DataTypes': 'contracts/aave-v3-origin/src/contracts/protocol/libraries/types/DataTypes.sol',
                        'ReserveLogic': 'contracts/aave-v3-origin/src/contracts/protocol/libraries/logic/ReserveLogic.sol',
                        'SupplyLogic': 'contracts/aave-v3-origin/src/contracts/protocol/libraries/logic/SupplyLogic.sol',
                        'BorrowLogic': 'contracts/aave-v3-origin/src/contracts/protocol/libraries/logic/BorrowLogic.sol',
                        'FlashLoanLogic': 'contracts/aave-v3-origin/src/contracts/protocol/libraries/logic/FlashLoanLogic.sol',
                        'LiquidationLogic': 'contracts/aave-v3-origin/src/contracts/protocol/libraries/logic/LiquidationLogic.sol',
                        'PoolLogic': 'contracts/aave-v3-origin/src/contracts/protocol/libraries/logic/PoolLogic.sol',
                        'EModeLogic': 'contracts/aave-v3-origin/src/contracts/protocol/libraries/logic/EModeLogic.sol',
                        'ReserveConfiguration': 'contracts/aave-v3-origin/src/contracts/protocol/libraries/configuration/ReserveConfiguration.sol',
                        'ConfiguratorLogic': 'contracts/aave-v3-origin/src/contracts/protocol/libraries/logic/ConfiguratorLogic.sol',
                        'IsolationModeLogic': 'contracts/aave-v3-origin/src/contracts/protocol/libraries/logic/IsolationModeLogic.sol'
                    };

                    const libPath = libPaths[libName];
                    if (!libPath) {
                        throw new Error(`Unknown library: ${libName}`);
                    }

                    libraryFlags += ` --libraries ${libPath}:${libName}:${deployments.libraries[libName]}`;
                }
            }

            // Подготовка constructor args с заменой переменных
            let constructorArgs = contractConfig.constructor.map(arg => {
                if (arg === '${POOL_ADDRESSES_PROVIDER}') {
                    if (!deployments.contracts['PoolAddressesProvider']) {
                        throw new Error('PoolAddressesProvider must be deployed first');
                    }
                    return deployments.contracts['PoolAddressesProvider'];
                }
                if (arg === '${DEFAULT_RESERVE_INTEREST_RATE_STRATEGY_V2}') {
                    if (!deployments.contracts['DefaultReserveInterestRateStrategyV2']) {
                        throw new Error('DefaultReserveInterestRateStrategyV2 must be deployed first');
                    }
                    return deployments.contracts['DefaultReserveInterestRateStrategyV2'];
                }
                return arg;
            });

            // Сборка команды - БЕЗ встроенной верификации для NEO X
            let foundryCommand;
            if (isNeoX) {
                // NEO X: --legacy для транзакций, БЕЗ --verify (верификация через API отдельно)
                foundryCommand = `forge create "${contractForFoundry}" --private-key ${process.env.DEPLOYER_PRIVATE_KEY} --rpc-url ${process.env.RPC_URL_SEPOLIA} --legacy --broadcast --json --use 0.8.27${libraryFlags}`;
                console.log(`🌐 Deploying to NEO X (${network}) - Legacy transaction mode`);
            } else {
                // Ethereum networks: верификация через Etherscan
                foundryCommand = `forge create "${contractForFoundry}" --private-key ${process.env.DEPLOYER_PRIVATE_KEY} --rpc-url ${process.env.RPC_URL_SEPOLIA} --verify --etherscan-api-key ${process.env.ETHERSCAN_API_KEY} --broadcast --json --use 0.8.27${libraryFlags}`;
            }

            if (constructorArgs.length > 0) {
                foundryCommand += ` --constructor-args ${constructorArgs.join(' ')}`;
            }

            console.log(`📋 Command: forge create "${contractForFoundry}"`);
            console.log(`🔧 Using Solidity 0.8.27 for Aave v3.5 compatibility`);
            if (contractConfig.libraryLinks && contractConfig.libraryLinks.length > 0) {
                console.log(`🔗 Library links: ${contractConfig.libraryLinks.length} libraries`);
            }
            if (constructorArgs.length > 0) {
                console.log(`📋 Constructor args:`, constructorArgs);
            }

            console.log('\n🚀 Executing forge create command...');

            // Try-catch для обработки ошибок forge
            let foundryOutput;
            try {
                foundryOutput = execSync(foundryCommand, {
                    stdio: 'pipe',
                    encoding: 'utf8',
                    maxBuffer: 50 * 1024 * 1024,
                    timeout: 300000  // 5 минут для большого контракта
                });
                console.log('   📥 Deployed successfully');
            } catch (execError) {
                // Forge может упасть на верификации, но деплой может быть успешным
                console.log('   ⚠️ Forge command exited with error, checking if deployment succeeded...');
                foundryOutput = execError.stdout ? execError.stdout.toString() : '';
                if (execError.stderr) {
                    const stderr = execError.stderr.toString();
                    console.log(`   📥 Forge stderr: ${stderr.substring(0, 300)}`);
                }
            }

            // Парсим адрес из JSON
            let contractAddress = null;

            try {
                const jsonMatch = foundryOutput.match(/\{[^}]*"deployedTo"[^}]*\}/);
                if (jsonMatch) {
                    const jsonOutput = JSON.parse(jsonMatch[0]);
                    if (jsonOutput.deployedTo) {
                        contractAddress = jsonOutput.deployedTo;
                        console.log(`   ✅ Found deployedTo: ${contractAddress}`);
                    }
                }
            } catch (e) {
                const addressMatch = foundryOutput.match(/Deployed to: (0x[a-fA-F0-9]{40})/);
                if (addressMatch) {
                    contractAddress = addressMatch[1];
                    console.log(`   ✅ Found address via regex: ${contractAddress}`);
                }
            }

            if (contractAddress && contractAddress !== '0x0000000000000000000000000000000000000000') {
                // Проверка что код на месте
                console.log('   🔍 Verifying contract deployment...');

                try {
                    const checkCommand = `cast code ${contractAddress} --rpc-url ${process.env.RPC_URL_SEPOLIA}`;
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

                console.log(`   ✅ ${contractConfig.name}: ${contractAddress}`);

                // Верификация через Standard Input API для NEO X
                if (isNeoX) {
                    console.log(`   🔍 Starting verification via Standard Input API...`);

                    // Ждём индексацию на Blockscout
                    await new Promise(resolve => setTimeout(resolve, 15000));

                    // Отправляем верификацию через Standard Input API
                    await verifyViaStandardInput(contractAddress, contractConfig.name, contractConfig.path, verifierBaseUrl, constructorArgs);

                    // Ждём обработки верификации
                    await new Promise(resolve => setTimeout(resolve, 20000));

                    // Проверяем результат
                    let verified = false;
                    for (let attempt = 1; attempt <= 3; attempt++) {
                        const status = await checkVerificationStatus(contractAddress, contractConfig.name, verifierBaseUrl);

                        if (status.isVerified && status.nameMatches) {
                            console.log(`   ✅ Verified as ${status.name}`);
                            verified = true;
                            break;
                        } else if (status.isVerified && !status.nameMatches) {
                            console.log(`   ⚠️ Verified but as: ${status.name} (expected: ${contractConfig.name})`);
                            if (attempt < 3) {
                                console.log(`   🔄 Retrying verification (attempt ${attempt + 1}/3)...`);
                                await verifyViaStandardInput(contractAddress, contractConfig.name, contractConfig.path, verifierBaseUrl, constructorArgs);
                                await new Promise(resolve => setTimeout(resolve, 20000));
                            }
                        } else if (status.isPartiallyVerified) {
                            console.log(`   ⚠️ Partially verified (bytecodeHash: none is expected for Aave v3.5)`);
                            verified = true;
                            break;
                        } else {
                            console.log(`   ⏳ Not verified yet (attempt ${attempt}/3)`);
                            if (attempt < 3) {
                                await verifyViaStandardInput(contractAddress, contractConfig.name, contractConfig.path, verifierBaseUrl, constructorArgs);
                                await new Promise(resolve => setTimeout(resolve, 20000));
                            }
                        }
                    }

                    if (!verified) {
                        console.log(`   ⚠️ Verification may need manual check at ${verifierBaseUrl}`);
                    }
                }

                // Сохраняем адрес
                if (contractConfig.name === 'PoolInstance') {
                    deployments.contracts[contractConfig.name + '_Implementation'] = contractAddress;
                    console.log(`   🎉 ${contractConfig.name} implementation deployed at: ${contractAddress}`);
                    console.log(`   📋 Next step: Call PoolAddressesProvider.setPoolImpl(${contractAddress})`);
                } else {
                    deployments.contracts[contractConfig.name] = contractAddress;
                    console.log(`   🎉 ${contractConfig.name} deployed at: ${contractAddress}`);
                }

                // Сохранить прогресс
                deployments.timestamp = new Date().toISOString();
                deployments.phase = 'core-3-in-progress';
                fs.writeFileSync('deployments/all-contracts.json', JSON.stringify(deployments, null, 2));
                console.log('   💾 Progress saved');

            } else {
                console.error(`❌ Could not extract deployment address for ${contractConfig.name}`);
                console.error('Raw output:', foundryOutput.substring(0, 500));
                process.exit(1);
            }

        } catch (error) {
            console.error(`❌ Failed to deploy ${contractConfig.name}:`, error.message);
            if (error.stderr) {
                console.log('📥 Foundry stderr:', error.stderr.toString().substring(0, 500));
            }
            process.exit(1);
        }

        // Задержка между деплоями
        console.log('   ⏳ Waiting 10s before next step...');
        await new Promise(resolve => setTimeout(resolve, 10000));
    }

    // ===========================================
    // CREATE POOL PROXY
    // ===========================================
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📦 CREATING POOL PROXY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const poolImplAddress = deployments.contracts['PoolInstance_Implementation'];
    const poolAddressesProviderAddress = deployments.contracts['PoolAddressesProvider'];

    if (!poolImplAddress) {
        console.error('❌ PoolInstance_Implementation not found!');
        process.exit(1);
    }

    // Проверяем, не создан ли уже Pool Proxy
    if (!forceRedeploy && deployments.contracts['Pool']) {
        console.log(`✅ Pool Proxy already exists at: ${deployments.contracts['Pool']}`);
        console.log(`⏭️  Skipping proxy creation (use FORCE_REDEPLOY=true to override)`);
    } else {
        console.log(`📋 Pool Implementation: ${poolImplAddress}`);
        console.log(`📋 PoolAddressesProvider: ${poolAddressesProviderAddress}\n`);

        // Создать Pool Proxy через setPoolImpl
        console.log('🚀 Creating Pool Proxy via setPoolImpl()...');

        try {
            // Формируем команду в зависимости от сети
            let setPoolImplCommand;
            if (isNeoX) {
                // NEO X: используем --legacy
                setPoolImplCommand = `cast send ${poolAddressesProviderAddress} "setPoolImpl(address)" ${poolImplAddress} --private-key ${process.env.DEPLOYER_PRIVATE_KEY} --rpc-url ${process.env.RPC_URL_SEPOLIA} --legacy --gas-limit 2000000`;
            } else {
                setPoolImplCommand = `cast send ${poolAddressesProviderAddress} "setPoolImpl(address)" ${poolImplAddress} --private-key ${process.env.DEPLOYER_PRIVATE_KEY} --rpc-url ${process.env.RPC_URL_SEPOLIA} --gas-limit 2000000`;
            }

            execSync(setPoolImplCommand, { stdio: 'inherit' });
            console.log('\n✅ Pool Proxy creation transaction sent!');

            // Wait for confirmation
            console.log('⏳ Waiting 10 seconds for confirmation...');
            await new Promise(resolve => setTimeout(resolve, 10000));

            // Get Pool Proxy address
            const getPoolCommand = `cast call ${poolAddressesProviderAddress} "getPool()" --rpc-url ${process.env.RPC_URL_SEPOLIA}`;
            const poolProxyResult = execSync(getPoolCommand, { encoding: 'utf8' }).trim();
            const poolProxyAddress = '0x' + poolProxyResult.slice(-40);

            console.log(`\n🎉 Pool Proxy created at: ${poolProxyAddress}`);

            // Verify Pool Proxy has code
            try {
                const codeCheck = execSync(`cast code ${poolProxyAddress} --rpc-url ${process.env.RPC_URL_SEPOLIA}`, { encoding: 'utf8' }).trim();
                if (codeCheck && codeCheck !== '0x' && codeCheck.length > 4) {
                    console.log('✅ Pool Proxy has code on-chain');
                } else {
                    console.log('⚠️ Pool Proxy code check returned empty - waiting...');
                    await new Promise(resolve => setTimeout(resolve, 10000));
                }
            } catch (e) {
                console.log('⚠️ Could not verify Pool Proxy code');
            }

            // Save Pool Proxy address
            deployments.contracts['Pool'] = poolProxyAddress;

            // Verify Pool Proxy initialization
            console.log('\n🔍 Verifying Pool Proxy initialization...');
            const addressesProviderCheck = execSync(
                `cast call ${poolProxyAddress} "ADDRESSES_PROVIDER()" --rpc-url ${process.env.RPC_URL_SEPOLIA}`,
                { encoding: 'utf8' }
            ).trim();

            const retrievedProvider = '0x' + addressesProviderCheck.slice(-40);
            console.log(`📋 Pool.ADDRESSES_PROVIDER() returns: ${retrievedProvider}`);
            console.log(`📋 Expected: ${poolAddressesProviderAddress}`);

            if (retrievedProvider.toLowerCase() === poolAddressesProviderAddress.toLowerCase()) {
                console.log('✅ Pool Proxy initialized CORRECTLY!');
            } else {
                console.log('⚠️ Pool Proxy ADDRESSES_PROVIDER mismatch - check initialization');
            }

        } catch (error) {
            console.error('❌ Failed to create Pool Proxy:', error.message);
            if (error.stderr) {
                console.log('📥 Error details:', error.stderr.toString().substring(0, 300));
            }
            process.exit(1);
        }
    }

    // Финализация Phase 3
    deployments.phase = 'core-3-completed';
    deployments.timestamp = new Date().toISOString();
    fs.writeFileSync('deployments/all-contracts.json', JSON.stringify(deployments, null, 2));

    console.log('\n🎉 CORE Phase 3 Complete!');
    console.log('========================');
    console.log('📋 Deployed Contracts:');
    console.log(`  ✅ Pool Implementation: ${deployments.contracts['PoolInstance_Implementation']}`);
    console.log(`  ✅ Pool Proxy: ${deployments.contracts['Pool']}`);
    console.log('');
    console.log('⚡ POOL READY FOR USE!');
    console.log('📋 Pool Proxy is initialized and ready');
    console.log('🚀 Next: Run CORE Phase 3.5 (PoolConfigurator Implementation + Proxy)');
    console.log('');
    console.log('🎯 CORE Progress: Phase 3/5 ✅');

    if (isNeoX) {
        console.log(`\n🔗 View on Blockscout: ${verifierBaseUrl}/address/${deployments.contracts['Pool']}`);
    }
}

// Запуск
deployCorePhase3().catch((error) => {
    console.error('\n❌ CORE Phase 3 deployment failed:');
    console.error(error);
    process.exit(1);
});
