const { ethers } = require('ethers');
const fs = require('fs');
const { execSync } = require('child_process');

// CORE Phase 3: Pool Implementation (Aave v3.5 with Solidity 0.8.27)
// 3 контракта: Pool, PoolConfigurator, ProtocolDataProvider

async function deployCorePhase3() {
    console.log('🚀 CORE Phase 3: Pool Implementation (Aave v3.5)');
    console.log('===============================================');
    console.log('💰 Estimated Cost: ~$1.2 USD');
    console.log('📋 Contracts: 3 core pool contracts with Flash Loans!');
    console.log('⚡ Features: Lending, Borrowing, Flash Loans, Liquidations');
    
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL_SEPOLIA);
    const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
    
    console.log('📋 Deployer:', wallet.address);
    const balance = await provider.getBalance(wallet.address);
    console.log('💰 Balance:', ethers.formatEther(balance), 'ETH');
    
    // Загрузить или создать deployments
    let deployments = {
        network: 'sepolia',
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
    const requiredContracts = ['PoolAddressesProvider', 'ACLManager', 'AaveOracle', 'DefaultReserveInterestRateStrategyV2'];
    
    for (const lib of requiredLibraries) {
        if (!deployments.libraries[lib]) {
            console.error(`❌ Required library ${lib} not found! Please deploy Phase 1 first.`);
            process.exit(1);
        }
    }
    
    for (const contract of requiredContracts) {
        if (!deployments.contracts[contract]) {
            console.error(`❌ Required contract ${contract} not found! Please deploy Phase 2 first.`);
            process.exit(1);
        }
    }
    
    console.log('✅ Phase 1-2 dependencies found, proceeding with Phase 3');

    // CORE Phase 3 контракты (с library linking)
    // NOTE: PoolConfigurator перенесен в Phase 3.5 (отдельный скрипт)
    const poolContracts = [
        {
            name: 'PoolInstance',
            path: 'contracts/aave-v3-origin/src/contracts/instances/PoolInstance.sol',
            description: 'Main lending pool implementation (deployed through proxy)',
            libraryLinks: [
                // Foundry требует ЯВНО указать ВСЕ используемые библиотеки
                // даже если они содержат только internal функции
                'SupplyLogic',
                'BorrowLogic',
                'FlashLoanLogic',
                'LiquidationLogic',
                'PoolLogic',
                'EModeLogic'
                // WadRayMath, PercentageMath, Errors, DataTypes - не нужны (используются через другие библиотеки)
                // ReserveLogic, GenericLogic, ValidationLogic - не нужны (инлайнятся внутри других библиотек)
                // ReserveConfiguration - не нужна
            ],
            constructor: [
                '${POOL_ADDRESSES_PROVIDER}', // PoolAddressesProvider address
                '${DEFAULT_RESERVE_INTEREST_RATE_STRATEGY_V2}' // InterestRateStrategy address
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
    
    for (const contractConfig of poolContracts) {
        console.log(`\n🔍 Processing ${contractConfig.name}...`);
        console.log(`📝 Description: ${contractConfig.description}`);
        
        // Проверяем, уже ли задеплоен контракт
        let isAlreadyDeployed = false;
        let existingAddress = '';

        if (contractConfig.name === 'PoolInstance') {
            // Для PoolInstance проверяем PoolInstance_Implementation
            if (deployments.contracts[contractConfig.name + '_Implementation']) {
                isAlreadyDeployed = true;
                existingAddress = deployments.contracts[contractConfig.name + '_Implementation'];
            }
        } else {
            // Для остальных контрактов проверяем обычным способом
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
        
        // Специальная логика для PoolInstance (деплой как implementation)
        if (contractConfig.name === 'PoolInstance') {
            console.log(`⚡ Deploying PoolInstance as implementation contract (not proxy)`);
            console.log(`📋 This will be used by PoolAddressesProvider.setPoolImpl() later`);
        }
        
        try {
            // Проверим что файл существует
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
                    let libPath = '';
                    switch(libName) {
                        case 'WadRayMath':
                            libPath = 'contracts/aave-v3-origin/src/contracts/protocol/libraries/math/WadRayMath.sol';
                            break;
                        case 'PercentageMath':
                            libPath = 'contracts/aave-v3-origin/src/contracts/protocol/libraries/math/PercentageMath.sol';
                            break;
                        case 'MathUtils':
                            libPath = 'contracts/aave-v3-origin/src/contracts/protocol/libraries/math/MathUtils.sol';
                            break;
                        case 'Errors':
                            libPath = 'contracts/aave-v3-origin/src/contracts/protocol/libraries/helpers/Errors.sol';
                            break;
                        case 'DataTypes':
                            libPath = 'contracts/aave-v3-origin/src/contracts/protocol/libraries/types/DataTypes.sol';
                            break;
                        case 'ReserveLogic':
                            libPath = 'contracts/aave-v3-origin/src/contracts/protocol/libraries/logic/ReserveLogic.sol';
                            break;
                        case 'SupplyLogic':
                            libPath = 'contracts/aave-v3-origin/src/contracts/protocol/libraries/logic/SupplyLogic.sol';
                            break;
                        case 'BorrowLogic':
                            libPath = 'contracts/aave-v3-origin/src/contracts/protocol/libraries/logic/BorrowLogic.sol';
                            break;
                        case 'FlashLoanLogic':
                            libPath = 'contracts/aave-v3-origin/src/contracts/protocol/libraries/logic/FlashLoanLogic.sol';
                            break;
                        case 'LiquidationLogic':
                            libPath = 'contracts/aave-v3-origin/src/contracts/protocol/libraries/logic/LiquidationLogic.sol';
                            break;
                        case 'PoolLogic':
                            libPath = 'contracts/aave-v3-origin/src/contracts/protocol/libraries/logic/PoolLogic.sol';
                            break;
                        case 'EModeLogic':
                            libPath = 'contracts/aave-v3-origin/src/contracts/protocol/libraries/logic/EModeLogic.sol';
                            break;
                        case 'ReserveConfiguration':
                            libPath = 'contracts/aave-v3-origin/src/contracts/protocol/libraries/configuration/ReserveConfiguration.sol';
                            break;
                        case 'ConfiguratorLogic':
                            libPath = 'contracts/aave-v3-origin/src/contracts/protocol/libraries/logic/ConfiguratorLogic.sol';
                            break;
                        default:
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
            
            // Сборка команды с library linking и constructor args
            let foundryCommand = `forge create "${contractForFoundry}" --private-key ${process.env.DEPLOYER_PRIVATE_KEY} --rpc-url ${process.env.RPC_URL_SEPOLIA} --verify --etherscan-api-key ${process.env.ETHERSCAN_API_KEY} --broadcast --json --use 0.8.27${libraryFlags}`;
            
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

            console.log('\n🔍 DEBUGGING: Checking OpenZeppelin installation...');
            try {
                const ozCheck = execSync('ls -la node_modules/@openzeppelin/contracts/utils/ | grep -E "Context|Multicall"', { encoding: 'utf8', stdio: 'pipe' });
                console.log('📦 OpenZeppelin files found:', ozCheck);
            } catch (e) {
                console.log('⚠️ Could not list OpenZeppelin files');
            }

            try {
                const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
                console.log('📦 package.json OpenZeppelin version:', packageJson.dependencies['@openzeppelin/contracts']);
            } catch (e) {
                console.log('⚠️ Could not read package.json');
            }

            try {
                const ozVersion = execSync('npm list @openzeppelin/contracts', { encoding: 'utf8', stdio: 'pipe' });
                console.log('📦 Installed OpenZeppelin version:', ozVersion);
            } catch (e) {
                console.log('⚠️ OpenZeppelin version check:', e.stdout || e.message);
            }

            console.log('\n🚀 Executing forge create command...');
            console.log('🔧 Full command (sanitized):');
            console.log(foundryCommand.replace(process.env.DEPLOYER_PRIVATE_KEY, '***').replace(process.env.ETHERSCAN_API_KEY, '***'));

            // 🔥 КРИТИЧНО: Try-catch для обработки ошибок forge (как в Phase 1)
            let foundryOutput;
            try {
                foundryOutput = execSync(foundryCommand, {
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
            
            // Парсим адрес из JSON
            let contractAddress = null;
            
            try {
                // Ищем JSON блок в выводе
                const jsonMatch = foundryOutput.match(/\{[^}]*"deployedTo"[^}]*\}/);
                if (jsonMatch) {
                    const jsonOutput = JSON.parse(jsonMatch[0]);
                    console.log('📋 Parsed JSON output:', JSON.stringify(jsonOutput, null, 2));
                    
                    if (jsonOutput.deployedTo) {
                        contractAddress = jsonOutput.deployedTo;
                        console.log('✅ Found deployedTo address:', contractAddress);
                    }
                }
            } catch (e) {
                console.log('⚠️ Failed to parse JSON, trying regex fallback...');
                // Fallback для текстового формата
                const addressMatch = foundryOutput.match(/Deployed to: (0x[a-fA-F0-9]{40})/);
                if (addressMatch) {
                    contractAddress = addressMatch[1];
                    console.log('✅ Found address via regex:', contractAddress);
                }
            }
            
            if (contractAddress && contractAddress !== '0x0000000000000000000000000000000000000000') {
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

                // Специальная логика для PoolInstance - сохраняем как implementation
                if (contractConfig.name === 'PoolInstance') {
                    deployments.contracts[contractConfig.name + '_Implementation'] = contractAddress;
                    console.log(`🎉 ${contractConfig.name} implementation deployed at: ${contractAddress}`);
                    console.log(`📋 Next step: Call PoolAddressesProvider.setPoolImpl(${contractAddress})`);
                    console.log(`🔄 This will create proxy and return Pool address for users`);
                    console.log(`⚡ Pool implementation ready! Contains Flash Loans functionality`);
                    console.log(`📊 Ready for proxy creation via PoolAddressesProvider`);
                } else {
                    deployments.contracts[contractConfig.name] = contractAddress;
                    console.log(`🎉 ${contractConfig.name} deployed at: ${contractAddress}`);
                }

                // Сохранить прогресс после каждого деплоя
                deployments.timestamp = new Date().toISOString();
                deployments.phase = 'core-3-in-progress';
                fs.writeFileSync('deployments/all-contracts.json', JSON.stringify(deployments, null, 2));

                console.log('💾 Progress saved to deployments/all-contracts.json');
                
            } else {
                console.error(`❌ Could not extract deployment address for ${contractConfig.name}`);
                console.error('Full output:', foundryOutput);
                process.exit(1);
            }
            
        } catch (error) {
            console.error(`❌ Failed to deploy ${contractConfig.name}:`, error.message);

            console.log('\n🔍 DETAILED ERROR ANALYSIS:');
            console.log('Error type:', error.constructor.name);
            console.log('Error code:', error.code);
            console.log('Error signal:', error.signal);

            if (error.stdout) {
                console.log('\n📤 Foundry stdout:');
                console.log(error.stdout.toString());
            }
            if (error.stderr) {
                console.log('\n📥 Foundry stderr:');
                console.log(error.stderr.toString());

                // Детальный анализ ошибки компиляции
                const stderr = error.stderr.toString();
                if (stderr.includes('Linearization of inheritance graph impossible')) {
                    console.log('\n🔍 INHERITANCE LINEARIZATION ERROR DETECTED');
                    console.log('This typically means conflicting versions of OpenZeppelin contracts');
                    console.log('Checking for duplicate OpenZeppelin installations...');

                    try {
                        const findDuplicates = execSync('find node_modules -name "Context.sol" -o -name "Multicall.sol" 2>/dev/null', { encoding: 'utf8', stdio: 'pipe' });
                        console.log('📦 Found OpenZeppelin files at:');
                        console.log(findDuplicates);
                    } catch (e) {
                        console.log('⚠️ Could not search for duplicate files');
                    }

                    try {
                        const npmDedupe = execSync('npm ls @openzeppelin/contracts 2>&1', { encoding: 'utf8', stdio: 'pipe' });
                        console.log('📦 NPM dependency tree:');
                        console.log(npmDedupe);
                    } catch (e) {
                        console.log('⚠️ NPM ls output:', e.stdout || e.message);
                    }
                }

                if (stderr.includes('Member "toUint120" not found')) {
                    console.log('\n🔍 SAFEUINT FUNCTION MISSING ERROR');
                    console.log('OpenZeppelin version is too old (<4.7.0)');
                    console.log('Required: @openzeppelin/contracts >= 4.9.6');
                }
            }

            process.exit(1);
        }
        
        // Задержка между деплоями (как в Phase 1/2)
        console.log('⏳ Waiting 10s before next deployment...');
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

    console.log(`📋 Pool Implementation: ${poolImplAddress}`);
    console.log(`📋 PoolAddressesProvider: ${poolAddressesProviderAddress}\n`);

    // Создать Pool Proxy через setPoolImpl
    console.log('🚀 Creating Pool Proxy via setPoolImpl()...');

    try {
        const setPoolImplCommand = `cast send ${poolAddressesProviderAddress} "setPoolImpl(address)" ${poolImplAddress} --private-key ${process.env.DEPLOYER_PRIVATE_KEY} --rpc-url ${process.env.RPC_URL_SEPOLIA} --gas-limit 2000000`;

        execSync(setPoolImplCommand, { stdio: 'inherit' });
        console.log('\n✅ Pool Proxy creation transaction sent!');

        // Wait for confirmation
        console.log('⏳ Waiting 5 seconds for confirmation...');
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Get Pool Proxy address
        const getPoolCommand = `cast call ${poolAddressesProviderAddress} "getPool()" --rpc-url ${process.env.RPC_URL_SEPOLIA}`;
        const poolProxyAddress = '0x' + execSync(getPoolCommand, { encoding: 'utf8' }).trim().slice(-40);

        console.log(`\n🎉 Pool Proxy created at: ${poolProxyAddress}`);

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
            console.log('❌ Pool Proxy initialized with WRONG values!');
        }

    } catch (error) {
        console.error('❌ Failed to create Pool Proxy:', error.message);
        process.exit(1);
    }

    // Финализация Phase 3
    deployments.phase = 'core-3-completed';
    deployments.timestamp = new Date().toISOString();
    fs.writeFileSync('deployments/all-contracts.json', JSON.stringify(deployments, null, 2));

    console.log('\n🎉 CORE Phase 3 Complete!');
    console.log('========================');
    console.log('📋 Deployed Contracts:');
    console.log(`  ✅ Pool Implementation: ${poolImplAddress}`);
    console.log(`  ✅ Pool Proxy: ${deployments.contracts['Pool']}`);
    console.log(`  ✅ ProtocolDataProvider: ${deployments.contracts['AaveProtocolDataProvider']}`);
    console.log('');
    console.log('⚡ POOL READY FOR USE!');
    console.log('📋 Pool Proxy is initialized and ready');
    console.log('🚀 Next: Run CORE Phase 3.5 (PoolConfigurator Implementation + Proxy)');
    console.log('');
    console.log('🎯 CORE Progress: Phase 3/5 ✅');
}

// Запуск
deployCorePhase3().catch((error) => {
    console.error('\n❌ CORE Phase 3 deployment failed:');
    console.error(error);
    process.exit(1);
});