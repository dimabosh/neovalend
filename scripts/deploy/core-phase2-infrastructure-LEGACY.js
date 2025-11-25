const { ethers } = require('ethers');
const fs = require('fs');
const { execSync } = require('child_process');

// CORE Phase 2: Infrastructure (Aave v3.5 with Solidity 0.8.27)
// 4 контракта: AddressesProvider, ACLManager, Oracle, InterestRateStrategy

async function deployCorePhase2() {
    console.log('🚀 CORE Phase 2: Infrastructure (Aave v3.5)');
    console.log('===========================================');
    console.log('💰 Estimated Cost: ~$0.8 USD');
    console.log('📋 Contracts: 4 infrastructure contracts');
    
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
        phase: 'core-2',
        libraries: {},
        contracts: {}
    };

    if (fs.existsSync('deployments/all-contracts.json')) {
        const existing = JSON.parse(fs.readFileSync('deployments/all-contracts.json', 'utf8'));
        deployments.contracts = existing.contracts || {};
        deployments.libraries = existing.libraries || {};
        console.log('📄 Loaded existing deployments');
    }

    // Проверить что Phase 1 завершен (нужны math libraries)
    const requiredLibraries = ['WadRayMath', 'PercentageMath', 'MathUtils', 'Errors', 'DataTypes'];
    for (const lib of requiredLibraries) {
        if (!deployments.libraries[lib]) {
            console.error(`❌ Required library ${lib} not found! Please deploy Phase 1 first.`);
            process.exit(1);
        }
    }
    console.log('✅ Phase 1 math libraries found, proceeding with Phase 2');

    // CORE Phase 2 контракты
    const infrastructureContracts = [
        {
            name: 'PoolAddressesProvider',
            path: 'contracts/aave-v3-origin/src/contracts/protocol/configuration/PoolAddressesProvider.sol',
            description: 'Main registry and access point for the protocol',
            dependencies: [],
            constructor: [
                '"A7A5"',     // marketId
                wallet.address // owner
            ]
        },
        {
            name: 'ACLManager',
            path: 'contracts/aave-v3-origin/src/contracts/protocol/configuration/ACLManager.sol',
            description: 'Access Control List manager for protocol permissions',
            dependencies: [],
            constructor: [
                '${POOL_ADDRESSES_PROVIDER}' // Will be replaced with actual address
            ]
        },
        {
            name: 'AaveOracle',
            path: 'contracts/aave-v3-origin/src/contracts/misc/AaveOracle.sol',
            description: 'Price oracle for asset valuations',
            dependencies: [],
            constructor: [
                '${POOL_ADDRESSES_PROVIDER}', // poolAddressesProvider
                '[]',                         // assets (empty for now)
                '[]',                         // sources (empty for now)
                '0x0000000000000000000000000000000000000000', // fallbackOracle
                '0x0000000000000000000000000000000000000000', // baseCurrency (USD)
                '100000000'                   // baseCurrencyUnit (8 decimals for USD)
            ]
        },
        {
            name: 'DefaultReserveInterestRateStrategyV2',
            path: 'contracts/aave-v3-origin/src/contracts/misc/DefaultReserveInterestRateStrategyV2.sol',
            description: 'Variable interest rate strategy for lending/borrowing',
            dependencies: [],
            constructor: [
                '${POOL_ADDRESSES_PROVIDER}',     // poolAddressesProvider
                '800000000000000000000000000',    // optimalUsageRatio (80%)
                '0',                              // baseVariableBorrowRate (0%)
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
    
    console.log(`\n🎯 Deploying ${infrastructureContracts.length} infrastructure contracts with Solidity 0.8.27...`);
    
    // Smart deployment mode
    const forceRedeploy = process.env.FORCE_REDEPLOY === 'true';
    if (forceRedeploy) {
        console.log('🔥 Force redeploy mode: will redeploy all contracts');
    } else {
        console.log('🔄 Smart mode: will skip already deployed contracts');
    }
    
    for (const contractConfig of infrastructureContracts) {
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
            
            // Подготовка constructor args с заменой переменных
            let constructorArgs = contractConfig.constructor.map(arg => {
                if (arg === '${POOL_ADDRESSES_PROVIDER}') {
                    if (!deployments.contracts['PoolAddressesProvider']) {
                        throw new Error('PoolAddressesProvider must be deployed first');
                    }
                    return deployments.contracts['PoolAddressesProvider'];
                }
                return arg;
            });
            
            // Сборка команды с constructor args
            let foundryCommand = `forge create "${contractForFoundry}" --private-key ${process.env.DEPLOYER_PRIVATE_KEY} --rpc-url ${process.env.RPC_URL_SEPOLIA} --verify --etherscan-api-key ${process.env.ETHERSCAN_API_KEY} --broadcast --json --use 0.8.27`;
            
            if (constructorArgs.length > 0) {
                foundryCommand += ` --constructor-args ${constructorArgs.join(' ')}`;
            }
            
            console.log(`📋 Command: forge create "${contractForFoundry}"`);
            console.log(`🔧 Using Solidity 0.8.27 for Aave v3.5 compatibility`);
            console.log(`📋 Constructor args:`, constructorArgs);
            
            const foundryOutput = execSync(foundryCommand, { 
                stdio: 'pipe', 
                encoding: 'utf8' 
            });
            
            console.log('✅ Deployment successful!');
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
                console.log('🔍 Verifying contract deployment...');
                
                try {
                    // Проверяем что контракт действительно деплоен
                    const checkCommand = `cast code ${contractAddress} --rpc-url ${process.env.RPC_URL_SEPOLIA}`;
                    const code = execSync(checkCommand, { stdio: 'pipe', encoding: 'utf8' }).trim();
                    
                    if (code === '0x' || code.length <= 4) {
                        console.log('❌ Contract code not found - deployment may have failed');
                        console.log('🔄 Waiting 10s for blockchain to sync...');
                        await new Promise(resolve => setTimeout(resolve, 10000));
                        
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
            }
            
            if (contractAddress && contractAddress !== '0x0000000000000000000000000000000000000000') {
                // Проверяем верификацию контракта
                let isVerified = false;
                if (foundryOutput.includes('Contract successfully verified')) {
                    isVerified = true;
                    console.log('✅ Contract verified on Etherscan');
                } else if (foundryOutput.includes('Pass - Verified')) {
                    isVerified = true;
                    console.log('✅ Contract verified on Etherscan');
                } else {
                    console.log('⚠️ Contract not verified - will not add to deployments');
                    console.log('🔄 Contract address:', contractAddress);
                    console.log('📋 Transaction hash:', transactionHash);
                }
                
                // Сохраняем только верифицированные контракты
                if (isVerified) {
                    deployments.contracts[contractConfig.name] = contractAddress;
                    console.log(`🎉 ${contractConfig.name} deployed & verified at: ${contractAddress}`);
                    console.log(`📊 Infrastructure component ready for protocol integration`);
                } else {
                    console.log(`⏭️ Skipping ${contractConfig.name} - not verified yet`);
                    console.log(`🔄 You can manually verify and add later: ${contractAddress}`);
                }
                
                // Специальная логика для PoolAddressesProvider - установить ACL Admin
                if (contractConfig.name === 'PoolAddressesProvider') {
                    console.log(`🔧 Setting ACL Admin for PoolAddressesProvider...`);
                    
                    try {
                        // Устанавливаем deployer как ACL Admin
                        const setACLAdminCommand = `cast send ${contractAddress} "setAddress(bytes32,address)" 0x41434c5f41444d494e00000000000000000000000000000000000000000000 ${wallet.address} --private-key ${process.env.DEPLOYER_PRIVATE_KEY} --rpc-url ${process.env.RPC_URL_SEPOLIA}`;
                        
                        console.log(`📋 Setting ACL_ADMIN to: ${wallet.address}`);
                        execSync(setACLAdminCommand, { stdio: 'pipe' });
                        console.log(`✅ ACL Admin set successfully`);
                        
                    } catch (aclError) {
                        console.error(`⚠️ Failed to set ACL Admin:`, aclError.message);
                        console.log(`🔄 Continuing deployment - can be set later manually`);
                    }
                }
                
                // Сохранить прогресс после каждого деплоя
                deployments.timestamp = new Date().toISOString();
                deployments.phase = 'core-2-in-progress';
                fs.writeFileSync('deployments/all-contracts.json', JSON.stringify(deployments, null, 2));
                
                console.log('💾 Progress saved to deployments/all-contracts.json');
                
            } else {
                console.error(`❌ Could not extract deployment address for ${contractConfig.name}`);
                console.error('Full output:', foundryOutput);
                process.exit(1);
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
        
        // Увеличенная задержка между деплоями для стабильности сети
        console.log('⏳ Waiting 5s before next deployment...');
        await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    // Финализация Phase 2
    deployments.phase = 'core-2-completed';
    deployments.timestamp = new Date().toISOString();
    fs.writeFileSync('deployments/all-contracts.json', JSON.stringify(deployments, null, 2));
    
    console.log('\n🎉 CORE Phase 2 Complete!');
    console.log('========================');
    console.log('📋 Deployed Infrastructure Contracts:');
    
    for (const contract of infrastructureContracts) {
        if (deployments.contracts[contract.name]) {
            console.log(`  ✅ ${contract.name}: ${deployments.contracts[contract.name]}`);
        }
    }
    
    console.log(`\n📊 Total infrastructure: ${Object.keys(deployments.contracts).length - 2} contracts`); // -2 for USDT, A7A5Token
    console.log('💡 Infrastructure ready for Pool deployment in Phase 3');
    console.log('🚀 Next: Run CORE Phase 3 (Pool Implementation)');
    console.log('');
    console.log('🎯 CORE Progress: Phase 2/5 ✅');
}

// Запуск
deployCorePhase2().catch((error) => {
    console.error('\n❌ CORE Phase 2 deployment failed:');
    console.error(error);
    process.exit(1);
});