const { ethers } = require('ethers');
const fs = require('fs');
const { execSync } = require('child_process');

// CORE Phase 2.5: Logic Libraries (Aave v3.5 with Solidity 0.8.27)
// 9 libraries: Logic libraries needed for Pool contract (IsolationModeLogic, SupplyLogic, BorrowLogic, etc.)
// NOTE: ReserveLogic, GenericLogic, ValidationLogic НЕ деплоятся - они инлайнятся (только internal функции)

async function deployCorePhase2_5() {
    console.log('🚀 CORE Phase 2.5: Logic Libraries (Aave v3.5)');
    console.log('===============================================');
    console.log('💰 Estimated Cost: ~$1.5 USD');
    console.log('📋 Libraries: 9 logic libraries for Pool contract');
    console.log('⚡ CRITICAL: IsolationModeLogic, SupplyLogic, BorrowLogic, etc.');
    console.log('⚡ Required for Pool, PoolConfigurator deployment');
    console.log('');
    console.log('⚠️  NOTE: ReserveLogic, GenericLogic, ValidationLogic НЕ деплоятся');
    console.log('   (они содержат только internal функции и автоматически инлайнятся)');
    
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL_SEPOLIA);
    const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
    
    console.log('📋 Deployer:', wallet.address);
    const balance = await provider.getBalance(wallet.address);
    console.log('💰 Balance:', ethers.formatEther(balance), 'ETH');
    
    // Загрузить или создать deployments
    let deployments = {
        network: process.env.NETWORK || 'sepolia',
        deployer: wallet.address,
        timestamp: new Date().toISOString(),
        phase: 'core-2.5',
        libraries: {},
        contracts: {}
    };

    if (fs.existsSync('deployments/all-contracts.json')) {
        const existing = JSON.parse(fs.readFileSync('deployments/all-contracts.json', 'utf8'));
        deployments.contracts = existing.contracts || {};
        deployments.libraries = existing.libraries || {};
        console.log('📄 Loaded existing deployments');
    }

    // Проверить что Phase 1-2 завершены (нужны math libraries и infrastructure)
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
    
    console.log('✅ Phase 1-2 dependencies found, proceeding with Phase 2.5');

    // CORE Phase 2.5 - Logic Libraries (порядок важен из-за зависимостей!)
    // NOTE: ReserveLogic, GenericLogic, ValidationLogic УДАЛЕНЫ - они содержат только internal функции
    // и автоматически инлайнятся компилятором, не требуя отдельного деплоя
    const logicLibraries = [
        {
            name: 'IsolationModeLogic',
            path: 'contracts/aave-v3-origin/src/contracts/protocol/libraries/logic/IsolationModeLogic.sol',
            description: 'Isolation mode debt management',
            libraryLinks: ['Errors', 'DataTypes']
        },
        {
            name: 'SupplyLogic',
            path: 'contracts/aave-v3-origin/src/contracts/protocol/libraries/logic/SupplyLogic.sol',
            description: 'Supply/deposit logic',
            libraryLinks: ['WadRayMath', 'PercentageMath', 'Errors', 'DataTypes']
            // ReserveLogic, ValidationLogic - inlined (internal functions)
        },
        {
            name: 'BorrowLogic',
            path: 'contracts/aave-v3-origin/src/contracts/protocol/libraries/logic/BorrowLogic.sol',
            description: 'Borrow logic and validation',
            libraryLinks: ['WadRayMath', 'PercentageMath', 'Errors', 'DataTypes', 'IsolationModeLogic']
            // ReserveLogic, ValidationLogic - inlined (internal functions)
        },
        {
            name: 'FlashLoanLogic',
            path: 'contracts/aave-v3-origin/src/contracts/protocol/libraries/logic/FlashLoanLogic.sol',
            description: 'Flash loan implementation',
            libraryLinks: ['WadRayMath', 'PercentageMath', 'Errors', 'DataTypes', 'BorrowLogic']
            // ValidationLogic - inlined (internal functions)
        },
        {
            name: 'LiquidationLogic',
            path: 'contracts/aave-v3-origin/src/contracts/protocol/libraries/logic/LiquidationLogic.sol',
            description: 'Liquidation logic and calculations',
            libraryLinks: ['WadRayMath', 'PercentageMath', 'Errors', 'DataTypes', 'IsolationModeLogic']
            // ReserveLogic, GenericLogic, ValidationLogic - inlined (internal functions)
        },
        {
            name: 'PoolLogic',
            path: 'contracts/aave-v3-origin/src/contracts/protocol/libraries/logic/PoolLogic.sol',
            description: 'Pool-level logic and utilities',
            libraryLinks: ['WadRayMath', 'PercentageMath', 'Errors', 'DataTypes']
            // ReserveLogic - inlined (internal functions)
        },
        {
            name: 'EModeLogic',
            path: 'contracts/aave-v3-origin/src/contracts/protocol/libraries/logic/EModeLogic.sol',
            description: 'Efficiency mode logic',
            libraryLinks: ['WadRayMath', 'PercentageMath', 'Errors', 'DataTypes']
        },
        {
            name: 'ReserveConfiguration',
            path: 'contracts/aave-v3-origin/src/contracts/protocol/libraries/configuration/ReserveConfiguration.sol',
            description: 'Reserve configuration utilities',
            libraryLinks: ['Errors', 'DataTypes'] // зависит от Errors и DataTypes
        },
        {
            name: 'ConfiguratorLogic',
            path: 'contracts/aave-v3-origin/src/contracts/protocol/libraries/logic/ConfiguratorLogic.sol',
            description: 'Pool configurator logic (needed for PoolConfiguratorInstance)',
            libraryLinks: ['WadRayMath', 'PercentageMath', 'Errors', 'DataTypes', 'ReserveConfiguration']
        }
    ];
    
    console.log(`\n🎯 Deploying ${logicLibraries.length} logic libraries with Solidity 0.8.27...`);
    console.log(`⚡ Critical libraries for Pool contract functionality!`);
    
    // Smart deployment mode
    const forceRedeploy = process.env.FORCE_REDEPLOY === 'true';
    if (forceRedeploy) {
        console.log('🔥 Force redeploy mode: will redeploy all libraries');
    } else {
        console.log('🔄 Smart mode: will skip already deployed libraries');
    }
    
    for (const libConfig of logicLibraries) {
        console.log(`\n🔍 Processing ${libConfig.name}...`);
        console.log(`📝 Description: ${libConfig.description}`);
        
        // Проверяем, уже ли задеплоена библиотека
        if (!forceRedeploy && deployments.libraries[libConfig.name]) {
            console.log(`✅ ${libConfig.name} already deployed at: ${deployments.libraries[libConfig.name]}`);
            console.log(`⏭️  Skipping (use FORCE_REDEPLOY=true to override)`);
            continue;
        }
        
        console.log(`🚀 Deploying ${libConfig.name}...`);
        
        try {
            // Проверим что файл существует
            if (!fs.existsSync(libConfig.path)) {
                console.error(`❌ Library file not found: ${libConfig.path}`);
                continue;
            }
            
            const contractForFoundry = libConfig.path + ':' + libConfig.name;
            
            // Подготовка library linking для зависимостей
            let libraryFlags = '';
            if (libConfig.libraryLinks && libConfig.libraryLinks.length > 0) {
                console.log(`🔗 Linking dependencies: ${libConfig.libraryLinks.join(', ')}`);
                
                for (const libName of libConfig.libraryLinks) {
                    if (!deployments.libraries[libName]) {
                        throw new Error(`Required dependency ${libName} not found in deployments`);
                    }
                    
                    // Определяем путь к dependency library файлу
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
                        case 'GenericLogic':
                            libPath = 'contracts/aave-v3-origin/src/contracts/protocol/libraries/logic/GenericLogic.sol';
                            break;
                        case 'ValidationLogic':
                            libPath = 'contracts/aave-v3-origin/src/contracts/protocol/libraries/logic/ValidationLogic.sol';
                            break;
                        case 'IsolationModeLogic':
                            libPath = 'contracts/aave-v3-origin/src/contracts/protocol/libraries/logic/IsolationModeLogic.sol';
                            break;
                        case 'BorrowLogic':
                            libPath = 'contracts/aave-v3-origin/src/contracts/protocol/libraries/logic/BorrowLogic.sol';
                            break;
                        case 'ReserveConfiguration':
                            libPath = 'contracts/aave-v3-origin/src/contracts/protocol/libraries/configuration/ReserveConfiguration.sol';
                            break;
                        case 'ConfiguratorLogic':
                            libPath = 'contracts/aave-v3-origin/src/contracts/protocol/libraries/logic/ConfiguratorLogic.sol';
                            break;
                        default:
                            throw new Error(`Unknown dependency library: ${libName}`);
                    }
                    
                    libraryFlags += ` --libraries ${libPath}:${libName}:${deployments.libraries[libName]}`;
                }
            }
            
            // Сборка команды foundry
            const network = process.env.NETWORK || 'sepolia';
            const isNeoX = network.includes('neox');

            let foundryCommand;
            if (isNeoX) {
                // NEO X: верификация через Blockscout
                const verifierUrl = network === 'neox-mainnet'
                    ? 'https://xexplorer.neo.org/api'
                    : 'https://xt4scan.ngd.network/api';
                foundryCommand = `forge create "${contractForFoundry}" --private-key ${process.env.DEPLOYER_PRIVATE_KEY} --rpc-url ${process.env.RPC_URL_SEPOLIA} --verify --verifier blockscout --verifier-url ${verifierUrl} --broadcast --json --use 0.8.27`;
                console.log(`🌐 Deploying to NEO X (${network}) - Blockscout verification`);
            } else {
                // Ethereum networks: верификация через Etherscan
                foundryCommand = `forge create "${contractForFoundry}" --private-key ${process.env.DEPLOYER_PRIVATE_KEY} --rpc-url ${process.env.RPC_URL_SEPOLIA} --verify --etherscan-api-key ${process.env.ETHERSCAN_API_KEY} --broadcast --json --use 0.8.27`;
            }

            if (libraryFlags) {
                foundryCommand += libraryFlags;
            }
            
            console.log(`📋 Command: forge create "${contractForFoundry}"`);
            console.log(`🔧 Using Solidity 0.8.27 for Aave v3.5 compatibility`);
            if (libConfig.libraryLinks && libConfig.libraryLinks.length > 0) {
                console.log(`🔗 Library dependencies: ${libConfig.libraryLinks.length} libraries`);
            }

            // 🔥 КРИТИЧНО: Try-catch для обработки ошибок forge (как в Phase 1 и 2.1)
            let foundryOutput;
            try {
                foundryOutput = execSync(foundryCommand, {
                    stdio: 'pipe',
                    encoding: 'utf8'
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
            let transactionHash = null;
            
            try {
                // Ищем JSON блок в выводе
                const jsonMatch = foundryOutput.match(/\{[^}]*"deployedTo"[^}]*\}/);
                if (jsonMatch) {
                    const jsonOutput = JSON.parse(jsonMatch[0]);
                    console.log('📋 Parsed JSON output:', JSON.stringify(jsonOutput, null, 2));
                    
                    if (jsonOutput.deployedTo) {
                        contractAddress = jsonOutput.deployedTo;
                        transactionHash = jsonOutput.transactionHash;
                        console.log('✅ Found deployedTo address:', contractAddress);
                        console.log('✅ Transaction hash:', transactionHash);
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
            
            // Дополнительная проверка деплоя
            if (contractAddress && contractAddress !== '0x0000000000000000000000000000000000000000') {
                console.log('🔍 Verifying library deployment...');
                
                try {
                    // Проверяем что библиотека действительно деплоена
                    const checkCommand = `cast code ${contractAddress} --rpc-url ${process.env.RPC_URL_SEPOLIA}`;
                    const code = execSync(checkCommand, { stdio: 'pipe', encoding: 'utf8' }).trim();
                    
                    if (code === '0x' || code.length <= 4) {
                        console.log('❌ Library code not found - deployment may have failed');
                        console.log('🔄 Waiting 15s for blockchain to sync...');
                        await new Promise(resolve => setTimeout(resolve, 15000));
                        
                        // Повторная проверка
                        const codeRetry = execSync(checkCommand, { stdio: 'pipe', encoding: 'utf8' }).trim();
                        if (codeRetry === '0x' || codeRetry.length <= 4) {
                            throw new Error('Library deployment failed - no code at address');
                        } else {
                            console.log('✅ Library code found after retry');
                        }
                    } else {
                        console.log('✅ Library code verified on-chain');
                    }
                } catch (verifyError) {
                    console.log('⚠️ Library verification failed:', verifyError.message);
                    console.log('🔄 Continuing anyway - library may still be valid');
                }
            }
            
            if (contractAddress && contractAddress !== '0x0000000000000000000000000000000000000000') {
                // Проверяем верификацию библиотеки
                let isVerified = false;
                if (foundryOutput.includes('Contract successfully verified')) {
                    isVerified = true;
                    console.log('✅ Library verified on Etherscan');
                } else if (foundryOutput.includes('Pass - Verified')) {
                    isVerified = true;
                    console.log('✅ Library verified on Etherscan');
                } else {
                    console.log('⚠️ Library not verified - will not add to deployments');
                    console.log('🔄 Library address:', contractAddress);
                    console.log('📋 Transaction hash:', transactionHash);
                }
                
                // Сохраняем только верифицированные библиотеки
                if (isVerified) {
                    deployments.libraries[libConfig.name] = contractAddress;
                    console.log(`🎉 ${libConfig.name} deployed & verified at: ${contractAddress}`);
                    console.log(`📊 Logic library ready for Pool integration`);
                } else {
                    console.log(`⏭️ Skipping ${libConfig.name} - not verified yet`);
                    console.log(`🔄 You can manually verify and add later: ${contractAddress}`);
                }
                
                // Сохранить прогресс после каждого деплоя
                deployments.timestamp = new Date().toISOString();
                deployments.phase = 'core-2.5-in-progress';
                fs.writeFileSync('deployments/all-contracts.json', JSON.stringify(deployments, null, 2));
                
                console.log('💾 Progress saved to deployments/all-contracts.json');
                
            } else {
                console.error(`❌ Could not extract deployment address for ${libConfig.name}`);
                console.log('🔄 Continuing with next library...\n');
                continue;
            }

        } catch (error) {
            console.error(`❌ Failed to deploy ${libConfig.name}:`, error.message);

            if (error.stdout) {
                console.log('📤 Foundry stdout:');
                console.log(error.stdout.toString());
            }
            if (error.stderr) {
                console.log('📥 Foundry stderr:');
                console.log(error.stderr.toString());
            }

            console.log('🔄 Continuing with next library...\n');
            continue;
        }
        
        // Увеличенная задержка между деплоями для стабильности сети
        console.log('⏳ Waiting 10s before next deployment...');
        await new Promise(resolve => setTimeout(resolve, 10000));
    }
    
    // Финализация Phase 2.5
    deployments.phase = 'core-2.5-completed';
    deployments.timestamp = new Date().toISOString();
    fs.writeFileSync('deployments/all-contracts.json', JSON.stringify(deployments, null, 2));
    
    console.log('\n🎉 CORE Phase 2.5 Complete!');
    console.log('===========================');
    console.log('📋 Deployed Logic Libraries:');
    
    for (const lib of logicLibraries) {
        if (deployments.libraries[lib.name]) {
            console.log(`  ✅ ${lib.name}: ${deployments.libraries[lib.name]}`);
        }
    }
    
    console.log(`\n📊 Total logic libraries: ${logicLibraries.filter(lib => deployments.libraries[lib.name]).length}/${logicLibraries.length}`);
    console.log('💡 Logic libraries ready for Pool contract deployment');
    console.log('🚀 Next: Run CORE Phase 3 (Pool Implementation)');
    console.log('');
    console.log('🎯 CORE Progress: Phase 2.5/5 ✅');
}

// Запуск
deployCorePhase2_5().catch((error) => {
    console.error('\n❌ CORE Phase 2.5 deployment failed:');
    console.error(error);
    process.exit(1);
});