const { ethers } = require('ethers');
const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');
const os = require('os');

// CORE Phase 4: Token Implementation (Aave v3.5 with Solidity 0.8.27)
// 2 контракта: AToken, VariableDebtToken
// Верификация через Standard JSON Input API для NEO X / Blockscout

/**
 * Создаёт Standard JSON Input для верификации через Blockscout API
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
            const abiCoder = new ethers.AbiCoder();
            // Encode based on contract type
            let encodedArgs;
            if (contractName === 'ATokenInstance') {
                encodedArgs = abiCoder.encode(['address', 'address', 'address'], constructorArgs);
            } else if (contractName === 'VariableDebtTokenInstance') {
                encodedArgs = abiCoder.encode(['address', 'address'], constructorArgs);
            }
            if (encodedArgs) {
                const argsHex = encodedArgs.slice(2);
                curlCmd += ` --form 'constructor_args=${argsHex}'`;
            }
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

async function deployCorePhase4() {
    console.log('🚀 CORE Phase 4: Token Implementation (Aave v3.5)');
    console.log('===============================================');
    console.log('💰 Estimated Cost: ~$0.4 USD');
    console.log('📋 Contracts: 2 token implementation contracts');
    console.log('🏦 Features: Interest-bearing tokens & Debt tracking');
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
        phase: 'core-4',
        libraries: {},
        contracts: {}
    };

    if (fs.existsSync('deployments/all-contracts.json')) {
        const existing = JSON.parse(fs.readFileSync('deployments/all-contracts.json', 'utf8'));
        deployments.contracts = existing.contracts || {};
        deployments.libraries = existing.libraries || {};
        deployments.tokens = existing.tokens || {};
        console.log('📄 Loaded existing deployments');
    }

    // Проверить что Phase 1-3 завершены
    const requiredLibraries = ['WadRayMath', 'PercentageMath', 'MathUtils', 'Errors', 'DataTypes'];
    const requiredContracts = ['PoolAddressesProvider', 'Pool', 'PoolConfigurator'];

    for (const lib of requiredLibraries) {
        if (!deployments.libraries[lib]) {
            console.error(`❌ Required library ${lib} not found! Please deploy Phase 1 first.`);
            process.exit(1);
        }
    }

    for (const contract of requiredContracts) {
        if (!deployments.contracts[contract]) {
            console.error(`❌ Required contract ${contract} not found! Please deploy Phase 1-3 first.`);
            process.exit(1);
        }
    }

    console.log('✅ Phase 1-3 dependencies found, proceeding with Phase 4');

    // CORE Phase 4 контракты (token implementations)
    const tokenContracts = [
        {
            name: 'ATokenInstance',
            path: 'contracts/aave-v3-origin/src/contracts/instances/ATokenInstance.sol',
            description: 'Interest-bearing token representing deposits in the protocol',
            libraryLinks: [],
            constructor: [
                '${POOL}', // Pool address
                '0x0000000000000000000000000000000000000000', // rewardsController (zero address)
                '${DEPLOYER}' // treasury (deployer address)
            ]
        },
        {
            name: 'VariableDebtTokenInstance',
            path: 'contracts/aave-v3-origin/src/contracts/instances/VariableDebtTokenInstance.sol',
            description: 'Variable debt token for tracking borrowed amounts',
            libraryLinks: [],
            constructor: [
                '${POOL}', // Pool address
                '0x0000000000000000000000000000000000000000' // rewardsController (zero address)
            ]
        }
    ];

    console.log(`\n🎯 Deploying ${tokenContracts.length} token implementation contracts with Solidity 0.8.27...`);
    console.log(`🏦 These are the core tokenization contracts for lending protocol`);

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

    for (const contractConfig of tokenContracts) {
        console.log(`\n🔍 Processing ${contractConfig.name}...`);
        console.log(`📝 Description: ${contractConfig.description}`);

        // Проверяем, уже ли задеплоен контракт
        if (!forceRedeploy && deployments.contracts[contractConfig.name]) {
            console.log(`✅ ${contractConfig.name} already deployed at: ${deployments.contracts[contractConfig.name]}`);
            console.log(`⏭️  Skipping (use FORCE_REDEPLOY=true to override)`);
            continue;
        }

        console.log(`🚀 Deploying ${contractConfig.name}...`);

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

                const libPaths = {
                    'WadRayMath': 'contracts/aave-v3-origin/src/contracts/protocol/libraries/math/WadRayMath.sol',
                    'PercentageMath': 'contracts/aave-v3-origin/src/contracts/protocol/libraries/math/PercentageMath.sol',
                    'MathUtils': 'contracts/aave-v3-origin/src/contracts/protocol/libraries/math/MathUtils.sol',
                    'Errors': 'contracts/aave-v3-origin/src/contracts/protocol/libraries/helpers/Errors.sol',
                    'DataTypes': 'contracts/aave-v3-origin/src/contracts/protocol/libraries/types/DataTypes.sol'
                };

                for (const libName of contractConfig.libraryLinks) {
                    if (!deployments.libraries[libName]) {
                        throw new Error(`Required library ${libName} not found in deployments`);
                    }
                    const libPath = libPaths[libName];
                    if (!libPath) {
                        throw new Error(`Unknown library: ${libName}`);
                    }
                    libraryFlags += ` --libraries ${libPath}:${libName}:${deployments.libraries[libName]}`;
                }
            }

            // Подготовка constructor args с заменой переменных
            let constructorArgs = contractConfig.constructor.map(arg => {
                if (arg === '${POOL}') {
                    if (!deployments.contracts['Pool']) {
                        throw new Error('Pool must be deployed first');
                    }
                    return deployments.contracts['Pool'];
                }
                if (arg === '${DEPLOYER}') {
                    return wallet.address;
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
                    timeout: 300000
                });
                console.log('   📥 Deployed successfully');
            } catch (execError) {
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

                    // Отправляем верификацию
                    await verifyViaStandardInput(contractAddress, contractConfig.name, contractConfig.path, verifierBaseUrl, constructorArgs);

                    // Ждём обработки
                    await new Promise(resolve => setTimeout(resolve, 15000));

                    // Проверяем результат
                    const status = await checkVerificationStatus(contractAddress, contractConfig.name, verifierBaseUrl);
                    if (status.isVerified || status.isPartiallyVerified) {
                        console.log(`   ✅ Verified as ${status.name || contractConfig.name}`);
                    } else {
                        console.log(`   ⚠️ Verification pending - check ${verifierBaseUrl}`);
                    }
                }

                deployments.contracts[contractConfig.name] = contractAddress;

                // Особые сообщения для каждого токена
                if (contractConfig.name === 'ATokenInstance') {
                    console.log(`   🏦 ATokenInstance implementation ready!`);
                } else if (contractConfig.name === 'VariableDebtTokenInstance') {
                    console.log(`   📊 VariableDebtTokenInstance implementation ready!`);
                }

                // Сохранить прогресс после каждого деплоя
                deployments.timestamp = new Date().toISOString();
                deployments.phase = 'core-4-in-progress';
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
        console.log('   ⏳ Waiting 10s before next deployment...');
        await new Promise(resolve => setTimeout(resolve, 10000));
    }

    // Финализация Phase 4
    deployments.phase = 'core-4-completed';
    deployments.timestamp = new Date().toISOString();
    fs.writeFileSync('deployments/all-contracts.json', JSON.stringify(deployments, null, 2));

    console.log('\n🎉 CORE Phase 4 Complete!');
    console.log('========================');
    console.log('📋 Deployed Token Contracts:');

    for (const contract of tokenContracts) {
        if (deployments.contracts[contract.name]) {
            console.log(`  ✅ ${contract.name}: ${deployments.contracts[contract.name]}`);
        }
    }

    console.log(`\n🏦 TOKEN IMPLEMENTATIONS READY!`);
    console.log(`📊 Tokenization Features:`);
    console.log(`  ✅ AToken - Interest-bearing deposit tokens`);
    console.log(`  ✅ VariableDebtToken - Variable rate debt tracking`);
    console.log('');
    console.log('🚀 Next: Run CORE Phase 5 (Data Providers & Gateways)');
    console.log('');
    console.log('🎯 CORE Progress: Phase 4/5 ✅');

    if (isNeoX) {
        console.log(`\n🔗 View on Blockscout: ${verifierBaseUrl}`);
    }
}

// Запуск
deployCorePhase4().catch((error) => {
    console.error('\n❌ CORE Phase 4 deployment failed:');
    console.error(error);
    process.exit(1);
});
