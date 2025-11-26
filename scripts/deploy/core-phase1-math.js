const { ethers } = require('ethers');
const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');
const os = require('os');

// CORE Phase 1: Math Libraries (Aave v3.5 with Solidity 0.8.27)
// 5 контрактов: WadRayMath, PercentageMath, MathUtils, Errors, DataTypes
// Верификация через Standard JSON Input API для решения проблемы constructor args

/**
 * Создаёт Standard JSON Input для верификации через Blockscout API
 * Использует flattened source для избежания "First Match" проблемы
 */
function createStandardJsonInput(contractName, flattenedSource) {
    // НЕ передаём metadata settings - пусть Blockscout использует дефолтные
    // Это соответствует успешно верифицированным контрактам на xt4scan
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
            outputSelection: {
                "*": {
                    "*": ["abi", "evm.bytecode", "evm.deployedBytecode"]
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

async function deployCorePhase1() {
    console.log('🚀 CORE Phase 1: Math Libraries (Aave v3.5)');
    console.log('===========================================');
    console.log('📋 Contracts: 5 math libraries');
    console.log('🔧 Verification: Standard JSON Input API\n');

    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL_SEPOLIA);
    const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);

    console.log('📋 Deployer:', wallet.address);
    const balance = await provider.getBalance(wallet.address);
    console.log('💰 Balance:', ethers.formatEther(balance), 'ETH');

    // Загрузить или создать deployments
    const networkName = process.env.NETWORK || 'sepolia';
    let deployments = {
        network: networkName,
        deployer: wallet.address,
        timestamp: new Date().toISOString(),
        phase: 'core-1',
        libraries: {},
        contracts: {}
    };

    if (fs.existsSync('deployments/all-contracts.json')) {
        const existing = JSON.parse(fs.readFileSync('deployments/all-contracts.json', 'utf8'));
        deployments.contracts = existing.contracts || {};
        deployments.libraries = existing.libraries || {};
        console.log('📄 Loaded existing deployments');
    }

    // CORE Phase 1 библиотеки (Aave v3.5)
    const mathLibraries = [
        {
            name: 'WadRayMath',
            path: 'contracts/aave-v3-origin/src/contracts/protocol/libraries/math/WadRayMath.sol',
            description: 'WAD and RAY math operations'
        },
        {
            name: 'PercentageMath',
            path: 'contracts/aave-v3-origin/src/contracts/protocol/libraries/math/PercentageMath.sol',
            description: 'Percentage calculations'
        },
        {
            name: 'MathUtils',
            path: 'contracts/aave-v3-origin/src/contracts/protocol/libraries/math/MathUtils.sol',
            description: 'Math utility functions'
        },
        {
            name: 'Errors',
            path: 'contracts/aave-v3-origin/src/contracts/protocol/libraries/helpers/Errors.sol',
            description: 'Error definitions'
        },
        {
            name: 'DataTypes',
            path: 'contracts/aave-v3-origin/src/contracts/protocol/libraries/types/DataTypes.sol',
            description: 'Data structure definitions'
        }
    ];

    console.log(`\n🎯 Deploying ${mathLibraries.length} math libraries...`);

    // Smart deployment mode
    const forceRedeploy = process.env.FORCE_REDEPLOY === 'true';
    const network = process.env.NETWORK || 'sepolia';
    const isNeoX = network.includes('neox');

    // Blockscout URLs
    const verifierBaseUrl = network === 'neox-mainnet'
        ? 'https://xexplorer.neo.org'
        : 'https://xt4scan.ngd.network';

    console.log(`🌐 Network: ${network}`);
    console.log(`🔧 isNeoX: ${isNeoX}`);
    console.log(`🔍 Verifier: ${verifierBaseUrl}`);

    if (isNeoX) {
        console.log('⚡ Using legacy transactions for NEO X');
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

    for (const libConfig of mathLibraries) {
        // Проверяем, уже ли задеплоена библиотека
        if (!forceRedeploy && deployments.libraries[libConfig.name]) {
            console.log(`✅ ${libConfig.name}: ${deployments.libraries[libConfig.name]} (already deployed)`);
            continue;
        }

        console.log(`🚀 Deploying ${libConfig.name}...`);

        try {
            if (!fs.existsSync(libConfig.path)) {
                console.error(`❌ File not found: ${libConfig.path}`);
                continue;
            }

            const contractForFoundry = libConfig.path + ':' + libConfig.name;

            // Деплой БЕЗ встроенной верификации forge (она использует все исходники)
            // Верификация будет через Standard Input API отдельно
            let foundryCommand;
            if (isNeoX) {
                // NEO X: --legacy для транзакций, БЕЗ --verify
                foundryCommand = `forge create "${contractForFoundry}" --private-key ${process.env.DEPLOYER_PRIVATE_KEY} --rpc-url ${process.env.RPC_URL_SEPOLIA} --legacy --broadcast --json --use 0.8.27`;
            } else {
                foundryCommand = `forge create "${contractForFoundry}" --private-key ${process.env.DEPLOYER_PRIVATE_KEY} --rpc-url ${process.env.RPC_URL_SEPOLIA} --broadcast --json --use 0.8.27`;
            }

            let foundryOutput;
            try {
                foundryOutput = execSync(foundryCommand, {
                    stdio: 'pipe',
                    encoding: 'utf8',
                    maxBuffer: 10 * 1024 * 1024,
                    timeout: 180000  // 3 минуты для деплоя
                });
                console.log(`   📥 Deployed successfully`);
            } catch (execError) {
                foundryOutput = execError.stdout ? execError.stdout.toString() : '';
                const stderr = execError.stderr ? execError.stderr.toString() : '';
                console.log(`   ⚠️ ${(stderr || foundryOutput).replace(/\n/g, ' ').substring(0, 200)}`);
            }

            // Парсим адрес из JSON
            let contractAddress = null;

            try {
                const jsonMatch = foundryOutput.match(/\{[^}]*"deployedTo"[^}]*\}/);
                if (jsonMatch) {
                    const jsonOutput = JSON.parse(jsonMatch[0]);
                    if (jsonOutput.deployedTo) {
                        contractAddress = jsonOutput.deployedTo;
                    }
                }
            } catch (e) {
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
                } catch (verifyError) {
                    console.log(`   ⚠️ Code verification issue: ${verifyError.message}`);
                }

                console.log(`   ✅ ${libConfig.name}: ${contractAddress}`);

                // Верификация через Standard Input API
                if (isNeoX) {
                    console.log(`   🔍 Starting verification via Standard Input API...`);

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
                            // Попробуем переверифицировать
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

                // Сохранить прогресс
                deployments.libraries[libConfig.name] = contractAddress;
                deployments.timestamp = new Date().toISOString();
                deployments.phase = 'core-1-in-progress';
                fs.writeFileSync('deployments/all-contracts.json', JSON.stringify(deployments, null, 2));

            } else {
                console.error(`❌ Could not extract address for ${libConfig.name}`);
                process.exit(1);
            }

        } catch (error) {
            console.error(`❌ Failed to deploy ${libConfig.name}:`, error.message);
            process.exit(1);
        }

        // Задержка между деплоями
        console.log('   ⏳ Waiting 10s before next deployment...');
        await new Promise(resolve => setTimeout(resolve, 10000));
    }

    // Финализация Phase 1
    deployments.phase = 'core-1-completed';
    deployments.timestamp = new Date().toISOString();
    fs.writeFileSync('deployments/all-contracts.json', JSON.stringify(deployments, null, 2));

    console.log('\n🎉 CORE Phase 1 Complete!');
    console.log('========================');
    console.log('📋 Deployed Math Libraries:');

    for (const lib of mathLibraries) {
        if (deployments.libraries[lib.name]) {
            console.log(`  ✅ ${lib.name}: ${deployments.libraries[lib.name]}`);
        }
    }

    console.log(`\n📊 Total: ${mathLibraries.filter(lib => deployments.libraries[lib.name]).length}/${mathLibraries.length} libraries`);
    console.log('🚀 Next: Run CORE Phase 2 (Infrastructure)');
}

// Запуск
deployCorePhase1().catch((error) => {
    console.error('\n❌ CORE Phase 1 deployment failed:');
    console.error(error);
    process.exit(1);
});
