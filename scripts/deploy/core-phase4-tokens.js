const { ethers } = require('ethers');
const fs = require('fs');
const { execSync } = require('child_process');

// CORE Phase 4: Token Implementation (Aave v3.5 with Solidity 0.8.27)
// 2 контракта: AToken, VariableDebtToken

async function deployCorePhase4() {
    console.log('🚀 CORE Phase 4: Token Implementation (Aave v3.5)');
    console.log('===============================================');
    console.log('💰 Estimated Cost: ~$0.4 USD');
    console.log('📋 Contracts: 2 token implementation contracts');
    console.log('🏦 Features: Interest-bearing tokens & Debt tracking');
    
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
        phase: 'core-4',
        libraries: {},
        contracts: {}
    };

    if (fs.existsSync('deployments/all-contracts.json')) {
        const existing = JSON.parse(fs.readFileSync('deployments/all-contracts.json', 'utf8'));
        deployments.contracts = existing.contracts || {};
        deployments.libraries = existing.libraries || {};
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
            libraryLinks: [
                'WadRayMath',
                'Errors'
            ],
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
            libraryLinks: [
                'WadRayMath',
                'Errors'
            ],
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
                        default:
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
            
            // Сборка команды с library linking и constructor args
            const network = process.env.NETWORK || 'sepolia';
            const isNeoX = network.includes('neox');

            let foundryCommand;
            if (isNeoX) {
                // NEO X: Verification via Blockscout
                const verifierUrl = network === 'neox-mainnet'
                    ? 'https://xexplorer.neo.org/api'
                    : 'https://xt4scan.ngd.network/api';
                foundryCommand = `forge create "${contractForFoundry}" --private-key ${process.env.DEPLOYER_PRIVATE_KEY} --rpc-url ${process.env.RPC_URL_SEPOLIA} --verify --verifier blockscout --verifier-url ${verifierUrl} --broadcast --json --use 0.8.27${libraryFlags}`;
                console.log(`🌐 Deploying to NEO X (${network}) - Blockscout verification`);
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
            
            const foundryOutput = execSync(foundryCommand, { 
                stdio: 'pipe', 
                encoding: 'utf8' 
            });
            
            console.log('✅ Deployment successful!');
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
                deployments.contracts[contractConfig.name] = contractAddress;
                
                console.log(`🎉 ${contractConfig.name} deployed at: ${contractAddress}`);
                
                // Особые сообщения для каждого токена
                if (contractConfig.name === 'ATokenInstance') {
                    console.log(`🏦 ATokenInstance implementation ready! Represents deposits that earn interest`);
                    console.log(`📈 Users will receive aTokens when depositing assets`);
                } else if (contractConfig.name === 'VariableDebtTokenInstance') {
                    console.log(`📊 VariableDebtTokenInstance implementation ready! Tracks borrowed amounts`);
                    console.log(`📉 Automatically tracks variable rate debt for borrowers`);
                }
                
                // Сохранить прогресс после каждого деплоя
                deployments.timestamp = new Date().toISOString();
                deployments.phase = 'core-4-in-progress';
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
        
        // Небольшая задержка между деплоями
        console.log('⏳ Waiting 2s before next deployment...');
        await new Promise(resolve => setTimeout(resolve, 2000));
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
    console.log(`📊 Tokenization Features Now Active:`);
    console.log(`  ✅ AToken - Interest-bearing deposit tokens`);
    console.log(`  ✅ VariableDebtToken - Variable rate debt tracking`);
    console.log(`  ✅ Automatic interest accrual`);
    console.log(`  ✅ Transferable aTokens (with balance updates)`);
    console.log('');
    console.log('💡 Token implementations ready for proxy deployment in Phase 5');
    console.log('🚀 Next: Run CORE Phase 5 (Proxy & Finalization)');
    console.log('');
    console.log('🎯 CORE Progress: Phase 4/5 ✅');
}

// Запуск
deployCorePhase4().catch((error) => {
    console.error('\n❌ CORE Phase 4 deployment failed:');
    console.error(error);
    process.exit(1);
});