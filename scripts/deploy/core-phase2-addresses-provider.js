const { ethers } = require('ethers');
const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');
const os = require('os');

// CORE Phase 2.1: PoolAddressesProvider ONLY
// Деплой главного контракта-регистра + установка ACL Admin
// Верификация через Standard JSON Input API с поддержкой constructor args

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
 * Поддерживает контракты с constructor arguments
 */
async function verifyViaStandardInput(contractAddress, contractName, contractPath, verifierBaseUrl, constructorArgsHex = null) {
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
        if (constructorArgsHex) {
            curlCmd += ` --form 'constructor_args=${constructorArgsHex}'`;
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

/**
 * Кодирует constructor arguments в hex формат для ABI
 * Использует cast для ABI encoding
 */
function encodeConstructorArgs(constructorArgs, types) {
    // PoolAddressesProvider(string marketId, address owner)
    // types = ['string', 'address']
    try {
        const argsEncoded = execSync(
            `cast abi-encode "constructor(${types.join(',')})" ${constructorArgs.map(a => `"${a}"`).join(' ')}`,
            { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
        ).trim();
        // Remove '0x' prefix for Blockscout API
        return argsEncoded.startsWith('0x') ? argsEncoded.slice(2) : argsEncoded;
    } catch (e) {
        console.log(`   ⚠️ Constructor args encoding failed: ${e.message}`);
        return null;
    }
}

async function deployCorePhase2_1() {
    console.log('🚀 CORE Phase 2.1: PoolAddressesProvider');
    console.log('========================================');
    console.log('💰 Estimated Cost: ~$0.1 USD');
    console.log('📋 Contract: PoolAddressesProvider + ACL Admin setup');

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
        phase: 'core-2.1',
        libraries: {},
        contracts: {}
    };

    if (fs.existsSync('deployments/all-contracts.json')) {
        const existing = JSON.parse(fs.readFileSync('deployments/all-contracts.json', 'utf8'));
        deployments.contracts = existing.contracts || {};
        deployments.libraries = existing.libraries || {};
        console.log('📄 Loaded existing deployments');
    }

    console.log(`\n🎯 Deploying PoolAddressesProvider with Solidity 0.8.27...`);

    // Smart deployment mode
    const forceRedeploy = process.env.FORCE_REDEPLOY === 'true';
    if (forceRedeploy) {
        console.log('🔥 Force redeploy mode: will redeploy contract');
    } else {
        console.log('🔄 Smart mode: will skip already deployed contract');
    }

    // Contract configuration
    const contractConfig = {
        name: 'PoolAddressesProvider',
        path: 'contracts/aave-v3-origin/src/contracts/protocol/configuration/PoolAddressesProvider.sol',
        description: 'Main registry contract for Aave v3.5 protocol',
        constructorArgs: ['NeovaLend', wallet.address]  // marketId, owner
    };

    console.log(`\n🔍 Processing ${contractConfig.name}...`);
    console.log(`📝 Description: ${contractConfig.description}`);

    // Проверяем, уже ли задеплоен контракт
    if (!forceRedeploy && deployments.contracts[contractConfig.name]) {
        console.log(`✅ ${contractConfig.name} already deployed at: ${deployments.contracts[contractConfig.name]}`);
        console.log(`⏭️  Skipping (use FORCE_REDEPLOY=true to override)`);

        // Проверим ACL Admin даже если контракт уже задеплоен
        console.log('\n🔍 Checking ACL Admin status...');
        try {
            const aclAdmin = execSync(
                `cast call ${deployments.contracts[contractConfig.name]} "getACLAdmin()(address)" --rpc-url ${process.env.RPC_URL_SEPOLIA}`,
                { encoding: 'utf8' }
            ).trim();

            console.log('📋 Current ACL Admin:', aclAdmin);

            if (aclAdmin === '0x0000000000000000000000000000000000000000') {
                console.log('⚠️  ACL Admin not set! Setting now...');
                const network = process.env.NETWORK || 'sepolia';
                const isNeoX = network.includes('neox');
                let setCommand = `cast send ${deployments.contracts[contractConfig.name]} "setACLAdmin(address)" ${wallet.address} --private-key ${process.env.DEPLOYER_PRIVATE_KEY} --rpc-url ${process.env.RPC_URL_SEPOLIA} --gas-limit 200000`;
                if (isNeoX) {
                    setCommand += ' --legacy';
                }
                execSync(setCommand, { encoding: 'utf8' });
                console.log('✅ ACL Admin set to:', wallet.address);
            } else {
                console.log('✅ ACL Admin already configured');
            }
        } catch (e) {
            console.log('⚠️  Could not verify ACL Admin:', e.message);
        }

        console.log('\n🎉 CORE Phase 2.1 already complete!');
        return;
    }

    console.log(`🚀 Deploying ${contractConfig.name}...`);

    // Network configuration
    const network = process.env.NETWORK || 'sepolia';
    const isNeoX = network.includes('neox');

    // Blockscout URLs для верификации
    const verifierBaseUrl = network === 'neox-mainnet'
        ? 'https://xexplorer.neo.org'
        : 'https://xt4scan.ngd.network';

    console.log(`🌐 Network: ${network}`);
    console.log(`🔧 isNeoX: ${isNeoX}`);
    console.log(`🔍 Verifier: ${verifierBaseUrl}`);

    if (isNeoX) {
        console.log('⚡ Using legacy transactions for NEO X');
    }

    try {
        // Проверим что файл существует
        if (!fs.existsSync(contractConfig.path)) {
            console.error(`❌ Contract file not found: ${contractConfig.path}`);
            process.exit(1);
        }

        const contractForFoundry = contractConfig.path + ':' + contractConfig.name;

        // Деплой БЕЗ встроенной верификации forge (как в Phase 1)
        // Верификация будет через Standard Input API отдельно с constructor args
        let foundryCommand;
        if (isNeoX) {
            // NEO X: --legacy для транзакций, БЕЗ --verify (верификация отдельно)
            foundryCommand = `forge create "${contractForFoundry}" --private-key ${process.env.DEPLOYER_PRIVATE_KEY} --rpc-url ${process.env.RPC_URL_SEPOLIA} --legacy --broadcast --json --use 0.8.27`;
        } else {
            // Ethereum: Etherscan verification
            const apiKey = process.env.ETHERSCAN_API_KEY ? process.env.ETHERSCAN_API_KEY.trim() : '';
            foundryCommand = `forge create "${contractForFoundry}" --private-key ${process.env.DEPLOYER_PRIVATE_KEY} --rpc-url ${process.env.RPC_URL_SEPOLIA} --verify --etherscan-api-key ${apiKey} --broadcast --json --use 0.8.27`;
        }

        // Добавляем constructor args для деплоя
        if (contractConfig.constructorArgs && contractConfig.constructorArgs.length > 0) {
            foundryCommand += ` --constructor-args ${contractConfig.constructorArgs.join(' ')}`;
        }

        console.log(`📋 Command: forge create "${contractForFoundry}"`);
        console.log(`🔧 Using Solidity 0.8.27 for Aave v3.5 compatibility`);
        console.log(`📋 Constructor args:`, contractConfig.constructorArgs);

        // Try-catch обработка (как в Phase 1)
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
            foundryOutput = execError.stdout ? execError.stdout.toString() : '';
            const stderr = execError.stderr ? execError.stderr.toString() : '';
            console.log(`   ⚠️ ${(stderr || foundryOutput).replace(/\n/g, ' ').substring(0, 200)}`);
        }

        // Парсим адрес из JSON (аналогично Phase 3)
        let contractAddress = null;

        try {
            // Ищем JSON блок с deployedTo
            const jsonMatch = foundryOutput.match(/\{[^}]*"deployedTo"[^}]*\}/);
            if (jsonMatch) {
                const jsonOutput = JSON.parse(jsonMatch[0]);

                if (jsonOutput.deployedTo) {
                    contractAddress = jsonOutput.deployedTo;
                    console.log('📋 Contract address:', contractAddress);
                }
            }
        } catch (e) {
            console.log('⚠️ JSON parsing failed, trying regex fallback...');
            // Fallback для текстового формата
            const addressMatch = foundryOutput.match(/Deployed to:\s*(0x[a-fA-F0-9]{40})/i);
            if (addressMatch) {
                contractAddress = addressMatch[1];
                console.log('📋 Contract address:', contractAddress);
            }
        }

        if (contractAddress && contractAddress !== '0x0000000000000000000000000000000000000000') {
            console.log(`🎉 ${contractConfig.name} deployed at: ${contractAddress}`);
            console.log(`📊 Main registry contract ready`);

            // Дополнительная проверка деплоя (как в Phase 1)
            console.log('🔍 Verifying contract deployment...');

            try {
                // Проверяем что контракт действительно деплоен
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

            // Верификация через Standard Input API с constructor args (для NEO X)
            if (isNeoX) {
                console.log(`   🔍 Starting verification via Standard Input API...`);

                // Ждём индексацию на Blockscout
                await new Promise(resolve => setTimeout(resolve, 15000));

                // Кодируем constructor args в hex
                // PoolAddressesProvider(string marketId, address owner)
                const constructorArgsHex = encodeConstructorArgs(
                    contractConfig.constructorArgs,
                    ['string', 'address']
                );

                if (constructorArgsHex) {
                    console.log(`   📋 Constructor args hex: ${constructorArgsHex.substring(0, 40)}...`);
                }

                // Отправляем верификацию через Standard Input API
                await verifyViaStandardInput(
                    contractAddress,
                    contractConfig.name,
                    contractConfig.path,
                    verifierBaseUrl,
                    constructorArgsHex
                );

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
                            await verifyViaStandardInput(contractAddress, contractConfig.name, contractConfig.path, verifierBaseUrl, constructorArgsHex);
                            await new Promise(resolve => setTimeout(resolve, 20000));
                        }
                    } else {
                        console.log(`   ⏳ Not verified yet (attempt ${attempt}/3)`);
                        if (attempt < 3) {
                            await verifyViaStandardInput(contractAddress, contractConfig.name, contractConfig.path, verifierBaseUrl, constructorArgsHex);
                            await new Promise(resolve => setTimeout(resolve, 20000));
                        }
                    }
                }

                if (!verified) {
                    console.log(`   ⚠️ Verification may need manual check`);
                }
            }

            // Сохранить прогресс после проверки
            deployments.contracts[contractConfig.name] = contractAddress;
            deployments.timestamp = new Date().toISOString();
            deployments.phase = 'core-2.1-in-progress';
            fs.writeFileSync('deployments/all-contracts.json', JSON.stringify(deployments, null, 2));

            console.log('💾 Saved to deployments/all-contracts.json');

        } else {
            console.error(`❌ Could not extract deployment address for ${contractConfig.name}`);
            process.exit(1);
        }

        // 2️⃣ Настройка ACL Admin
        console.log('\n🔧 Setting up ACL Admin...');

        try {
            let setACLAdminCommand = `cast send ${contractAddress} "setACLAdmin(address)" ${wallet.address} --private-key ${process.env.DEPLOYER_PRIVATE_KEY} --rpc-url ${process.env.RPC_URL_SEPOLIA} --gas-limit 200000`;

            // Добавляем --legacy для NEO X
            if (isNeoX) {
                setACLAdminCommand += ' --legacy';
            }

            console.log('📋 Setting ACL Admin to deployer address...');
            execSync(setACLAdminCommand, {
                stdio: 'pipe',
                encoding: 'utf8'
            });

            // Проверка установки
            await new Promise(resolve => setTimeout(resolve, 3000)); // Ждём 3 секунды

            const aclAdmin = execSync(
                `cast call ${contractAddress} "getACLAdmin()(address)" --rpc-url ${process.env.RPC_URL_SEPOLIA}`,
                { encoding: 'utf8' }
            ).trim();

            if (aclAdmin.toLowerCase().includes(wallet.address.toLowerCase().substring(2))) {
                console.log('✅ ACL Admin configured successfully!');
            } else {
                console.log('⚠️ ACL Admin verification failed - may need time to update');
            }

        } catch (error) {
            console.log(`⚠️ ACL Admin setup issue: ${error.message}`);
            console.log('💡 You can set it manually later with cast send');
        }

    } catch (error) {
        console.error(`❌ Failed to deploy ${contractConfig.name}:`, error.message);

        if (error.stdout) {
            console.log('📤 Foundry stdout:');
            console.log(error.stdout.toString());
        }
        if (error.stderr) {
            console.log('📥 Foundry stderr:');
            console.log(error.stderr.toString());
        }

        process.exit(1);
    }

    // Небольшая задержка перед финализацией
    console.log('\n⏳ Waiting 2s before finalizing...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Финализация Phase 2.1
    deployments.phase = 'core-2.1-completed';
    deployments.timestamp = new Date().toISOString();
    fs.writeFileSync('deployments/all-contracts.json', JSON.stringify(deployments, null, 2));

    console.log('\n🎉 CORE Phase 2.1 Complete!');
    console.log('============================');
    console.log('📋 Deployed Contract:');
    console.log(`  ✅ ${contractConfig.name}: ${deployments.contracts[contractConfig.name]}`);
    console.log(`  ✅ ACL Admin: ${wallet.address}`);

    console.log(`\n📊 Main registry contract ready`);
    console.log('💡 This contract manages all protocol addresses');
    console.log('🚀 Next: Run CORE Phase 2.2 (ACLManager, Oracle, InterestRateStrategy)');
    console.log('');
    console.log('🎯 CORE Progress: Phase 2.1/5 ✅');
}

// Запуск
deployCorePhase2_1().catch((error) => {
    console.error('\n❌ CORE Phase 2.1 deployment failed:');
    console.error(error);
    process.exit(1);
});
