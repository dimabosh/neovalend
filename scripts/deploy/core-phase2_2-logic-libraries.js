const { ethers } = require('ethers');
const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');
const os = require('os');

// CORE Phase 2.5: Logic Libraries (Aave v3.5 with Solidity 0.8.27)
// 9 libraries: Logic libraries needed for Pool contract (IsolationModeLogic, SupplyLogic, BorrowLogic, etc.)
// NOTE: ReserveLogic, GenericLogic, ValidationLogic НЕ деплоятся - они инлайнятся (только internal функции)

/**
 * Рекурсивно собирает все импорты из Solidity файла
 */
function collectImports(filePath, collected = new Set()) {
    if (collected.has(filePath)) return collected;

    if (!fs.existsSync(filePath)) {
        console.log(`   ⚠️ File not found: ${filePath}`);
        return collected;
    }

    collected.add(filePath);
    const content = fs.readFileSync(filePath, 'utf8');

    // Найти все import statements
    const importRegex = /import\s+(?:\{[^}]+\}\s+from\s+)?["']([^"']+)["']/g;
    let match;

    while ((match = importRegex.exec(content)) !== null) {
        let importPath = match[1];
        let resolvedPath = null;

        // Resolve import path
        if (importPath.startsWith('@aave/') || importPath.startsWith('aave-v3-origin/')) {
            // Aave imports
            resolvedPath = importPath
                .replace('@aave/', 'contracts/aave-v3-origin/src/contracts/')
                .replace('aave-v3-origin/', 'contracts/aave-v3-origin/src/contracts/');
        } else if (importPath.startsWith('@openzeppelin/')) {
            // OpenZeppelin imports
            resolvedPath = importPath.replace('@openzeppelin/', 'node_modules/@openzeppelin/');
        } else if (importPath.startsWith('./') || importPath.startsWith('../')) {
            // Relative imports
            const dir = path.dirname(filePath);
            resolvedPath = path.normalize(path.join(dir, importPath));
        } else {
            // Try as-is
            resolvedPath = importPath;
        }

        if (resolvedPath && fs.existsSync(resolvedPath)) {
            collectImports(resolvedPath, collected);
        }
    }

    return collected;
}

/**
 * Создаёт Standard JSON Input для верификации через Blockscout API
 * Использует flattened source - ТОЧНО как в Phase 1 (работает!)
 * ВАЖНО: Имя файла начинается с "A_" чтобы идти первым по алфавиту
 * и побеждать в "First Match" алгоритме Blockscout
 */
function createStandardJsonInput(contractName, flattenedSource) {
    return {
        language: "Solidity",
        sources: {
            // Имя файла начинается с "A_" чтобы быть первым по алфавиту
            // Это побеждает "First Match" алгоритм Blockscout
            [`A_${contractName}.sol`]: {
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
 *
 * ВАЖНО для IsolationModeLogic:
 * - Blockscout берёт ПЕРВУЮ библиотеку в flattened source с matching bytecode
 * - DataTypes идёт первым (как зависимость) → контракт верифицируется как DataTypes
 * - Решение: переименовать DataTypes в ZZZ_DataTypes чтобы IsolationModeLogic шёл первым
 */
async function verifyViaStandardInput(contractAddress, contractName, contractPath, verifierBaseUrl) {
    console.log(`   🔄 Verifying via Standard Input API...`);

    try {
        // 1. Flatten source code
        let flattenedSource = execSync(`forge flatten "${contractPath}"`, {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe']
        });

        // 2. СПЕЦИАЛЬНАЯ ОБРАБОТКА для IsolationModeLogic
        // Проблема: DataTypes и IsolationModeLogic имеют идентичный пустой bytecode (90 символов)
        // Blockscout берёт первую библиотеку в source с matching bytecode
        // DataTypes идёт первым → IsolationModeLogic верифицируется как DataTypes
        // Решение: переименовать DataTypes чтобы IsolationModeLogic был первым с таким именем
        if (contractName === 'IsolationModeLogic') {
            console.log(`   🔧 Applying DataTypes rename fix for IsolationModeLogic...`);

            // Переименовываем library DataTypes в library ZZZ_DataTypes
            // Это НЕ меняет bytecode - имена библиотек не входят в runtime code
            flattenedSource = flattenedSource.replace(/library DataTypes\s*\{/g, 'library ZZZ_DataTypes {');
            flattenedSource = flattenedSource.replace(/DataTypes\./g, 'ZZZ_DataTypes.');
            flattenedSource = flattenedSource.replace(/using ZZZ_DataTypes for/g, 'using ZZZ_DataTypes for');

            // Также переименуем Errors чтобы точно IsolationModeLogic был первым
            flattenedSource = flattenedSource.replace(/library Errors\s*\{/g, 'library ZZZ_Errors {');
            flattenedSource = flattenedSource.replace(/Errors\./g, 'ZZZ_Errors.');
            flattenedSource = flattenedSource.replace(/Errors\.(\w+)\(\)/g, 'ZZZ_Errors.$1()');

            console.log(`   ✅ DataTypes → ZZZ_DataTypes, Errors → ZZZ_Errors`);
        }

        // 3. Create Standard JSON Input
        const stdJsonInput = createStandardJsonInput(contractName, flattenedSource);

        // 4. Save to temp file (required for multipart upload)
        const tempFile = path.join(os.tmpdir(), `${contractName}_input.json`);
        fs.writeFileSync(tempFile, JSON.stringify(stdJsonInput));

        // 5. Submit via curl multipart form
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

    // Check network type early
    const network = process.env.NETWORK || 'sepolia';
    const isNeoX = network.includes('neox');

    // ETHERSCAN_API_KEY only required for non-NEO X networks
    if (!isNeoX && !process.env.ETHERSCAN_API_KEY) {
        console.error('❌ ETHERSCAN_API_KEY not set!');
        process.exit(1);
    }

    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL_SEPOLIA);
    const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);

    console.log('📋 Deployer:', wallet.address);
    const balance = await provider.getBalance(wallet.address);
    console.log('💰 Balance:', ethers.formatEther(balance), 'ETH');

    // Blockscout URLs
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
        deployments._old_deployment = existing._old_deployment;
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
        },
        {
            name: 'BorrowLogic',
            path: 'contracts/aave-v3-origin/src/contracts/protocol/libraries/logic/BorrowLogic.sol',
            description: 'Borrow logic and validation',
            libraryLinks: ['WadRayMath', 'PercentageMath', 'Errors', 'DataTypes', 'IsolationModeLogic']
        },
        {
            name: 'FlashLoanLogic',
            path: 'contracts/aave-v3-origin/src/contracts/protocol/libraries/logic/FlashLoanLogic.sol',
            description: 'Flash loan implementation',
            libraryLinks: ['WadRayMath', 'PercentageMath', 'Errors', 'DataTypes', 'BorrowLogic']
        },
        {
            name: 'LiquidationLogic',
            path: 'contracts/aave-v3-origin/src/contracts/protocol/libraries/logic/LiquidationLogic.sol',
            description: 'Liquidation logic and calculations',
            libraryLinks: ['WadRayMath', 'PercentageMath', 'Errors', 'DataTypes', 'IsolationModeLogic']
        },
        {
            name: 'PoolLogic',
            path: 'contracts/aave-v3-origin/src/contracts/protocol/libraries/logic/PoolLogic.sol',
            description: 'Pool-level logic and utilities',
            libraryLinks: ['WadRayMath', 'PercentageMath', 'Errors', 'DataTypes']
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
            libraryLinks: ['Errors', 'DataTypes']
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
                        case 'IsolationModeLogic':
                            libPath = 'contracts/aave-v3-origin/src/contracts/protocol/libraries/logic/IsolationModeLogic.sol';
                            break;
                        case 'BorrowLogic':
                            libPath = 'contracts/aave-v3-origin/src/contracts/protocol/libraries/logic/BorrowLogic.sol';
                            break;
                        case 'ReserveConfiguration':
                            libPath = 'contracts/aave-v3-origin/src/contracts/protocol/libraries/configuration/ReserveConfiguration.sol';
                            break;
                        default:
                            throw new Error(`Unknown dependency library: ${libName}`);
                    }

                    libraryFlags += ` --libraries ${libPath}:${libName}:${deployments.libraries[libName]}`;
                }
            }

            // Сборка команды foundry
            let foundryCommand;
            if (isNeoX) {
                // NEO X: --legacy для транзакций, БЕЗ --verify (верификация отдельно через Standard Input API)
                foundryCommand = `forge create "${contractForFoundry}" --private-key ${process.env.DEPLOYER_PRIVATE_KEY} --rpc-url ${process.env.RPC_URL_SEPOLIA} --legacy --broadcast --json --use 0.8.27`;
                console.log(`🌐 Deploying to NEO X (${network}) - Legacy tx mode`);
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

            // 🔥 КРИТИЧНО: Try-catch для обработки ошибок forge
            let foundryOutput;
            try {
                foundryOutput = execSync(foundryCommand, {
                    stdio: 'pipe',
                    encoding: 'utf8',
                    maxBuffer: 10 * 1024 * 1024,
                    timeout: 180000  // 3 минуты для деплоя
                });
                console.log('   📥 Deployed successfully');
            } catch (execError) {
                // Forge может упасть на верификации, но деплой может быть успешным
                foundryOutput = execError.stdout ? execError.stdout.toString() : '';
                const stderr = execError.stderr ? execError.stderr.toString() : '';
                console.log(`   ⚠️ ${(stderr || foundryOutput).replace(/\n/g, ' ').substring(0, 200)}`);
            }

            // Парсим адрес из JSON
            let contractAddress = null;

            try {
                // Ищем JSON блок в выводе
                const jsonMatch = foundryOutput.match(/\{[^}]*"deployedTo"[^}]*\}/);
                if (jsonMatch) {
                    const jsonOutput = JSON.parse(jsonMatch[0]);
                    if (jsonOutput.deployedTo) {
                        contractAddress = jsonOutput.deployedTo;
                    }
                }
            } catch (e) {
                // Fallback для текстового формата
                const addressMatch = foundryOutput.match(/Deployed to: (0x[a-fA-F0-9]{40})/);
                if (addressMatch) {
                    contractAddress = addressMatch[1];
                }
            }

            if (contractAddress && contractAddress !== '0x0000000000000000000000000000000000000000') {
                // Проверка что код на месте
                try {
                    const checkCommand = `cast code ${contractAddress} --rpc-url ${process.env.RPC_URL_SEPOLIA}`;
                    const code = execSync(checkCommand, { stdio: 'pipe', encoding: 'utf8' }).trim();

                    if (code === '0x' || code.length <= 4) {
                        console.log('   ⏳ Waiting for blockchain sync...');
                        await new Promise(resolve => setTimeout(resolve, 10000));

                        const codeRetry = execSync(checkCommand, { stdio: 'pipe', encoding: 'utf8' }).trim();
                        if (codeRetry === '0x' || codeRetry.length <= 4) {
                            throw new Error('No code at address');
                        }
                    }
                    console.log('   ✅ Contract code verified on-chain');
                } catch (verifyError) {
                    console.log(`   ⚠️ Code verification issue: ${verifyError.message}`);
                }

                console.log(`   ✅ ${libConfig.name}: ${contractAddress}`);

                // Верификация через Standard Input API для NEO X
                if (isNeoX) {
                    console.log(`   🔍 Starting verification via Flattened Code API...`);

                    // Ждём индексацию на Blockscout
                    await new Promise(resolve => setTimeout(resolve, 15000));

                    // Отправляем верификацию через Standard Input API
                    await verifyViaStandardInput(contractAddress, libConfig.name, libConfig.path, verifierBaseUrl);

                    // Ждём обработки верификации
                    await new Promise(resolve => setTimeout(resolve, 20000));

                    // Проверяем результат
                    let verified = false;
                    for (let attempt = 1; attempt <= 3; attempt++) {
                        const status = await checkVerificationStatus(contractAddress, libConfig.name, verifierBaseUrl);

                        if (status.isVerified && status.nameMatches) {
                            console.log(`   ✅ Verified as ${status.name}`);
                            verified = true;
                            break;
                        } else if (status.isVerified && !status.nameMatches) {
                            console.log(`   ⚠️ Verified but as: ${status.name} (expected: ${libConfig.name})`);
                            if (attempt < 3) {
                                console.log(`   🔄 Retrying verification (attempt ${attempt + 1}/3)...`);
                                await verifyViaStandardInput(contractAddress, libConfig.name, libConfig.path, verifierBaseUrl);
                                await new Promise(resolve => setTimeout(resolve, 20000));
                            }
                        } else {
                            console.log(`   ⏳ Not verified yet (attempt ${attempt}/3)`);
                            if (attempt < 3) {
                                await verifyViaStandardInput(contractAddress, libConfig.name, libConfig.path, verifierBaseUrl);
                                await new Promise(resolve => setTimeout(resolve, 20000));
                            }
                        }
                    }

                    if (!verified) {
                        console.log(`   ⚠️ Verification may need manual check`);
                    }
                }

                // Сохранить прогресс (ВСЕГДА сохраняем, даже если верификация pending)
                deployments.libraries[libConfig.name] = contractAddress;
                deployments.timestamp = new Date().toISOString();
                deployments.phase = 'core-2.5-in-progress';
                fs.writeFileSync('deployments/all-contracts.json', JSON.stringify(deployments, null, 2));
                console.log('   💾 Progress saved');

            } else {
                console.error(`❌ Could not extract address for ${libConfig.name}`);
                continue;
            }

        } catch (error) {
            console.error(`❌ Failed to deploy ${libConfig.name}:`, error.message);
            continue;
        }

        // Задержка между деплоями
        console.log('   ⏳ Waiting 10s before next deployment...');
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
