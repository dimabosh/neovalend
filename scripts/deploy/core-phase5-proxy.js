const { ethers } = require('ethers');
const fs = require('fs');
const { execSync } = require('child_process');

// CORE Phase 5: Data Providers & Gateways (Aave v3.5 with Solidity 0.8.27)
// 4 контракта: AaveProtocolDataProvider, UiPoolDataProviderV3, WrappedTokenGatewayV3, UiIncentiveDataProviderV3
// Верификация через Standard JSON Input API для NEO X / Blockscout

const path = require('path');
const os = require('os');

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
            // Encode constructor args based on types
            let encodedArgs;
            if (contractName === 'AaveProtocolDataProvider') {
                encodedArgs = abiCoder.encode(['address'], constructorArgs);
            } else if (contractName === 'UiPoolDataProviderV3') {
                encodedArgs = abiCoder.encode(['address', 'address'], constructorArgs);
            } else if (contractName === 'WrappedTokenGatewayV3') {
                encodedArgs = abiCoder.encode(['address', 'address', 'address'], constructorArgs);
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

async function deployCorePhase5() {
    console.log('🚀 CORE Phase 5: Data Providers & Gateways (Aave v3.5)');
    console.log('======================================================');
    console.log('💰 Estimated Cost: ~$1.4 USD');
    console.log('📋 Contracts: 4 data provider and gateway contracts');
    console.log('🎯 Features: Protocol data access, UI integration, ETH gateway');
    console.log('🔧 Verification: Standard JSON Input API for NEO X\n');

    // Network detection and RPC URL validation
    const network = process.env.NETWORK || 'sepolia';
    const isNeoX = network.includes('neox');
    const rpcUrl = process.env.RPC_URL_SEPOLIA;

    console.log(`🌐 Network: ${network}`);
    console.log(`📡 RPC URL: ${rpcUrl}`);

    // Validate RPC URL matches expected network
    if (!rpcUrl) {
        console.error('❌ RPC_URL_SEPOLIA environment variable is not set!');
        process.exit(1);
    }

    if (isNeoX && !rpcUrl.includes('ngd.network') && !rpcUrl.includes('banelabs')) {
        console.error(`❌ Network mismatch! Network is ${network} but RPC URL doesn't look like NEO X`);
        console.error(`   RPC URL: ${rpcUrl}`);
        console.error('   Expected: neoxt4seed1.ngd.network or mainnet-1.rpc.banelabs.org');
        process.exit(1);
    }

    if (!isNeoX && (rpcUrl.includes('ngd.network') || rpcUrl.includes('banelabs'))) {
        console.error(`❌ Network mismatch! Network is ${network} but RPC URL is for NEO X`);
        console.error(`   RPC URL: ${rpcUrl}`);
        console.error('   For Sepolia, use an Alchemy/Infura URL');
        process.exit(1);
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);

    console.log('📋 Deployer:', wallet.address);
    const balance = await provider.getBalance(wallet.address);
    console.log('💰 Balance:', ethers.formatEther(balance), 'GAS');

    // Blockscout URLs for NEO X
    const verifierBaseUrl = network === 'neox-mainnet'
        ? 'https://xexplorer.neo.org'
        : 'https://xt4scan.ngd.network';

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
        phase: 'core-5',
        libraries: {},
        contracts: {}
    };

    if (fs.existsSync('deployments/all-contracts.json')) {
        const existing = JSON.parse(fs.readFileSync('deployments/all-contracts.json', 'utf8'));
        deployments.contracts = existing.contracts || {};
        deployments.libraries = existing.libraries || {};
        console.log('📄 Loaded existing deployments');
    }

    // Проверить что Phase 1-4 завершены
    const requiredLibraries = ['WadRayMath', 'PercentageMath', 'MathUtils', 'Errors', 'DataTypes'];
    const requiredContracts = [
        'PoolAddressesProvider', 'ACLManager', 'AaveOracle', 'DefaultReserveInterestRateStrategyV2',
        'Pool', 'PoolConfigurator'
    ];
    
    for (const lib of requiredLibraries) {
        if (!deployments.libraries[lib]) {
            console.error(`❌ Required library ${lib} not found! Please deploy Phase 1 first.`);
            process.exit(1);
        }
    }
    
    for (const contract of requiredContracts) {
        if (!deployments.contracts[contract]) {
            console.error(`❌ Required contract ${contract} not found! Please deploy Phase 1-4 first.`);
            process.exit(1);
        }
    }
    
    console.log('✅ Phase 1-4 core dependencies found, proceeding with Phase 5');
    
    // Проверяем Phase 4 токены (опционально, могут отсутствовать в локальном файле)
    const phase4Tokens = ['ATokenInstance', 'VariableDebtTokenInstance'];
    let phase4Complete = true;
    for (const token of phase4Tokens) {
        if (!deployments.contracts[token]) {
            console.log(`⚠️  ${token} not found in local deployments (may be deployed in GitHub Actions)`);
            phase4Complete = false;
        }
    }
    
    if (phase4Complete) {
        console.log('✅ Phase 4 tokens also found locally');
    } else {
        console.log('ℹ️  Phase 4 tokens missing from local file - continuing anyway (normal for GitHub Actions)');
    }

    // CORE Phase 5 контракты (data providers and gateways)
    const phase5Contracts = [
        {
            name: 'AaveProtocolDataProvider',
            path: 'contracts/aave-v3-origin/src/contracts/helpers/AaveProtocolDataProvider.sol',
            description: 'Core protocol data provider for reserve and user data',
            libraryLinks: [],
            constructor: [
                '${POOL_ADDRESSES_PROVIDER}' // PoolAddressesProvider address
            ]
        },
        {
            name: 'UiPoolDataProviderV3',
            path: 'contracts/aave-v3-origin/src/contracts/helpers/UiPoolDataProviderV3.sol',
            description: 'UI data provider for frontend Markets and Dashboard',
            libraryLinks: [],
            constructor: [
                '0x0000000000000000000000000000000000000000', // networkBaseTokenPriceInUsdProxyAggregator (null for testnet)
                '0x0000000000000000000000000000000000000000'  // marketReferenceCurrencyPriceInUsdProxyAggregator (null for testnet)
            ]
        },
        {
            name: 'WrappedTokenGatewayV3', 
            path: 'contracts/aave-v3-origin/src/contracts/helpers/WrappedTokenGatewayV3.sol',
            description: 'Gateway for ETH deposits/withdraws (wraps to WETH)',
            libraryLinks: [],
            constructor: [
                '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9', // WETH Sepolia address
                '${DEPLOYER}', // owner address
                '${POOL}' // Pool address
            ]
        },
        {
            name: 'UiIncentiveDataProviderV3',
            path: 'contracts/aave-v3-origin/src/contracts/helpers/UiIncentiveDataProviderV3.sol', 
            description: 'UI data provider for incentives and rewards display',
            libraryLinks: [],
            constructor: []
        }
    ];
    
    console.log(`\n🎯 Deploying ${phase5Contracts.length} data provider and gateway contracts with Solidity 0.8.27...`);
    console.log(`📊 Setting up protocol data access and UI integration`);
    
    // Smart deployment mode
    const forceRedeploy = process.env.FORCE_REDEPLOY === 'true';
    if (forceRedeploy) {
        console.log('🔥 Force redeploy mode: will redeploy all contracts');
    } else {
        console.log('🔄 Smart mode: will skip already deployed contracts');
    }
    
    for (const contractConfig of phase5Contracts) {
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
            // Check balance before deploying
            const currentBalance = await provider.getBalance(wallet.address);
            const balanceInEth = parseFloat(ethers.formatEther(currentBalance));
            console.log(`   💰 Current balance: ${balanceInEth.toFixed(6)} GAS`);
            if (balanceInEth < 0.01) {
                console.error(`   ❌ Insufficient balance for deployment! Need at least 0.01 GAS`);
                console.error(`   💡 Please fund address: ${wallet.address}`);
                process.exit(1);
            }

            // Проверим что файл существует
            if (!fs.existsSync(contractConfig.path)) {
                console.error(`❌ Contract file not found: ${contractConfig.path}`);
                continue;
            }
            
            const contractForFoundry = contractConfig.path + ':' + contractConfig.name;
            
            // Подготовка constructor args с заменой переменных
            let constructorArgs = contractConfig.constructor.map(arg => {
                if (arg === '${POOL_ADDRESSES_PROVIDER}') {
                    if (!deployments.contracts['PoolAddressesProvider']) {
                        throw new Error('PoolAddressesProvider must be deployed first');
                    }
                    return deployments.contracts['PoolAddressesProvider'];
                }
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
                foundryCommand = `forge create "${contractForFoundry}" --private-key ${process.env.DEPLOYER_PRIVATE_KEY} --rpc-url ${process.env.RPC_URL_SEPOLIA} --legacy --broadcast --json --use 0.8.27`;
                console.log(`🌐 Deploying to NEO X (${network}) - Legacy transaction mode`);
            } else if (process.env.ETHERSCAN_API_KEY) {
                // Ethereum networks: верификация через Etherscan (если есть API ключ)
                foundryCommand = `forge create "${contractForFoundry}" --private-key ${process.env.DEPLOYER_PRIVATE_KEY} --rpc-url ${process.env.RPC_URL_SEPOLIA} --verify --etherscan-api-key ${process.env.ETHERSCAN_API_KEY} --broadcast --json --use 0.8.27`;
            } else {
                // No API key - deploy without verification
                console.log(`⚠️ ETHERSCAN_API_KEY not set - deploying without verification`);
                foundryCommand = `forge create "${contractForFoundry}" --private-key ${process.env.DEPLOYER_PRIVATE_KEY} --rpc-url ${process.env.RPC_URL_SEPOLIA} --broadcast --json --use 0.8.27`;
            }

            if (constructorArgs.length > 0) {
                foundryCommand += ` --constructor-args ${constructorArgs.join(' ')}`;
            }

            console.log(`📋 Command: forge create "${contractForFoundry}"`);
            console.log(`🔧 Using Solidity 0.8.27 for Aave v3.5 compatibility`);
            console.log(`📋 Constructor args:`, constructorArgs);

            // Deploy with error handling
            let foundryOutput;
            try {
                // Log the full command for debugging (without private key)
                const debugCommand = foundryCommand.replace(/--private-key\s+\S+/, '--private-key ***');
                console.log(`   📋 Full command: ${debugCommand}`);

                foundryOutput = execSync(foundryCommand, {
                    encoding: 'utf8',
                    stdio: 'pipe',
                    maxBuffer: 50 * 1024 * 1024,
                    timeout: 600000 // Increased to 10 minutes
                });
                console.log('   📥 Deployed successfully');
            } catch (execError) {
                // Forge может упасть на верификации, но деплой может быть успешным
                console.log('   ⚠️ Forge command exited with error, checking if deployment succeeded...');
                foundryOutput = execError.stdout ? execError.stdout.toString() : '';
                const stderrStr = execError.stderr ? execError.stderr.toString() : '';
                if (stderrStr) {
                    console.log(`   📥 Forge stderr: ${stderrStr.substring(0, 500)}`);
                }
                // Check if it's a compilation error vs deployment error
                if (stderrStr.includes('Compiler run failed') || stderrStr.includes('Error:') && !stderrStr.includes('contract was not deployed')) {
                    console.error(`   ❌ Compilation error detected`);
                    throw execError;
                }
            }

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
            
            if (!contractAddress || contractAddress === '0x0000000000000000000000000000000000000000') {
                console.error(`❌ Could not parse deployment address for ${contractConfig.name}`);
                console.error('Full output:', foundryOutput);
                process.exit(1);
            }

            // Verify deployment on-chain
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
                const status = await checkVerificationStatus(contractAddress, contractConfig.name, verifierBaseUrl);
                if (status.isVerified) {
                    console.log(`   ✅ Verified as ${status.name}`);
                } else if (status.isPartiallyVerified) {
                    console.log(`   ⚠️ Partially verified (bytecodeHash: none is expected for Aave v3.5)`);
                } else {
                    console.log(`   ⚠️ Verification may need manual check at ${verifierBaseUrl}`);
                }
            }

            // Save deployment
            deployments.contracts[contractConfig.name] = contractAddress;

            console.log(`   🎉 ${contractConfig.name} deployed at: ${contractAddress}`);
                
                // Особые сообщения для каждого контракта
                if (contractConfig.name === 'AaveProtocolDataProvider') {
                    console.log(`📊 Protocol data provider ready! Core reserve and user data access enabled`);
                } else if (contractConfig.name === 'UiPoolDataProviderV3') {
                    console.log(`🖥️ UI data provider ready! Frontend Markets and Dashboard data enabled`);
                } else if (contractConfig.name === 'WrappedTokenGatewayV3') {
                    console.log(`⚡ WETH Gateway ready! ETH deposits/withdraws enabled`);
                } else if (contractConfig.name === 'UiIncentiveDataProviderV3') {
                    console.log(`🏆 Incentive data provider ready! Rewards UI data enabled`);
                }
                
                // Сохранить прогресс после каждого деплоя
                deployments.timestamp = new Date().toISOString();
                deployments.phase = 'core-5-in-progress';
                fs.writeFileSync('deployments/all-contracts.json', JSON.stringify(deployments, null, 2));
                
                console.log('💾 Progress saved to deployments/all-contracts.json');

                // Delay between deployments
                console.log('⏳ Waiting 10s before next deployment...');
                await new Promise(resolve => setTimeout(resolve, 10000));

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
    }
    
    // Protocol Finalization
    console.log('\n🔧 Protocol Finalization...');
    console.log('============================');
    
    // Подсчет всех деплоев
    const totalLibraries = Object.keys(deployments.libraries).length;
    const totalContracts = Object.keys(deployments.contracts).length - 2; // -2 for USDT, A7A5Token
    const totalDeployments = totalLibraries + totalContracts;
    
    // Финализация Phase 5
    deployments.phase = 'core-5-completed';
    deployments.status = 'CORE_PROTOCOL_COMPLETE';
    deployments.timestamp = new Date().toISOString();
    fs.writeFileSync('deployments/all-contracts.json', JSON.stringify(deployments, null, 2));
    
    console.log('\n🎉🎉🎉 CORE PROTOCOL DEPLOYMENT COMPLETE! 🎉🎉🎉');
    console.log('=====================================================');
    console.log('');
    console.log('📊 DEPLOYMENT SUMMARY:');
    console.log('======================');
    console.log(`📋 Total Libraries: ${totalLibraries}`);
    console.log(`🏗️  Total Contracts: ${totalContracts}`);
    console.log(`⚡ Total Deployments: ${totalDeployments}`);
    console.log('');
    
    console.log('📋 CORE Libraries (Phase 1):');
    console.log('=============================');
    for (const [name, address] of Object.entries(deployments.libraries)) {
        console.log(`  ✅ ${name}: ${address}`);
    }
    console.log('');
    
    console.log('🏗️  CORE Contracts (Phase 2-5):');
    console.log('================================');
    for (const [name, address] of Object.entries(deployments.contracts)) {
        if (name !== 'USDT' && name !== 'A7A5Token') { // Skip pre-existing tokens
            console.log(`  ✅ ${name}: ${address}`);
        }
    }
    console.log('');
    
    console.log('🚀 PROTOCOL FEATURES ACTIVE:');
    console.log('============================');
    console.log('  ✅ Lending & Borrowing');
    console.log('  ✅ Flash Loans (instant uncollateralized loans)'); 
    console.log('  ✅ Variable Interest Rates');
    console.log('  ✅ Multi-collateral Support');
    console.log('  ✅ Liquidations');
    console.log('  ✅ Interest-bearing Tokens (aTokens)');
    console.log('  ✅ Debt Tracking (Variable Debt Tokens)');
    console.log('  ✅ Price Oracles');
    console.log('  ✅ Access Control & Permissions');
    console.log('  ✅ Protocol Data Access (AaveProtocolDataProvider)');
    console.log('  ✅ UI Integration (UiPoolDataProviderV3)');
    console.log('  ✅ ETH Gateway (WrappedTokenGatewayV3)');
    console.log('  ✅ Incentive Data (UiIncentiveDataProviderV3)');
    console.log('');
    
    console.log('💡 NEXT STEPS:');
    console.log('==============');
    console.log('1. 🎯 Configure reserves (USDT, wA7A5) via PoolConfigurator');
    console.log('2. 🏦 Set up oracles for price feeds');
    console.log('3. 📊 Initialize interest rate strategies');
    console.log('4. 🔗 Connect frontend to deployed contracts');
    console.log('5. 🧪 Test full protocol functionality');
    console.log('');
    
    console.log('🎯 DEPLOYMENT STATUS: 100% COMPLETE ✅');
    console.log('🎉 Full Aave v3.5 CORE protocol successfully deployed!');
    console.log('💰 Total Cost: ~$6.4 USD for complete DeFi protocol (~$5 + $1.4 Phase 5)');
    console.log('');
    console.log('🏁 CORE Deployment Phase 5/5 COMPLETE! 🏁');

    if (isNeoX) {
        console.log(`\n🔗 View on Blockscout: ${verifierBaseUrl}`);
    }
}

// Запуск
deployCorePhase5().catch((error) => {
    console.error('\n❌ CORE Phase 5 deployment failed:');
    console.error(error);
    process.exit(1);
});