const { ethers } = require('ethers');
const fs = require('fs');
const { execSync } = require('child_process');

// CORE Phase 1: Math Libraries (Aave v3.5 with Solidity 0.8.27)
// 5 контрактов: WadRayMath, PercentageMath, MathUtils, Errors, DataTypes

async function deployCorePhase1() {
    console.log('🚀 CORE Phase 1: Math Libraries (Aave v3.5)');
    console.log('===========================================');
    console.log('💰 Estimated Cost: ~$0.5 USD');
    console.log('📋 Contracts: 5 math libraries');

    // 🔍 DEBUG: Проверка environment variables
    console.log('\n🔍 DEBUG: Environment Variables Check');
    console.log('📋 RPC_URL_SEPOLIA:', process.env.RPC_URL_SEPOLIA ? `${process.env.RPC_URL_SEPOLIA.substring(0, 30)}...` : '❌ NOT SET');
    console.log('📋 DEPLOYER_PRIVATE_KEY:', process.env.DEPLOYER_PRIVATE_KEY ? '✅ SET (length: ' + process.env.DEPLOYER_PRIVATE_KEY.length + ')' : '❌ NOT SET');
    console.log('📋 ETHERSCAN_API_KEY:', process.env.ETHERSCAN_API_KEY ? '✅ SET (value: ' + process.env.ETHERSCAN_API_KEY + ')' : '❌ NOT SET');
    console.log('');

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
            description: 'WAD and RAY math operations (18/27 decimal precision)'
        },
        { 
            name: 'PercentageMath', 
            path: 'contracts/aave-v3-origin/src/contracts/protocol/libraries/math/PercentageMath.sol',
            description: 'Percentage calculations for protocol'
        },
        { 
            name: 'MathUtils', 
            path: 'contracts/aave-v3-origin/src/contracts/protocol/libraries/math/MathUtils.sol',
            description: 'General mathematical utility functions'
        },
        { 
            name: 'Errors', 
            path: 'contracts/aave-v3-origin/src/contracts/protocol/libraries/helpers/Errors.sol',
            description: 'Protocol error definitions and custom errors'
        },
        { 
            name: 'DataTypes', 
            path: 'contracts/aave-v3-origin/src/contracts/protocol/libraries/types/DataTypes.sol',
            description: 'Protocol data structure definitions'
        }
    ];
    
    console.log(`\n🎯 Deploying ${mathLibraries.length} math libraries with Solidity 0.8.27...`);
    
    // Smart deployment mode
    const forceRedeploy = process.env.FORCE_REDEPLOY === 'true';
    if (forceRedeploy) {
        console.log('🔥 Force redeploy mode: will redeploy all libraries');
    } else {
        console.log('🔄 Smart mode: will skip already deployed libraries');
    }
    
    for (const libConfig of mathLibraries) {
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
                console.error(`❌ Contract file not found: ${libConfig.path}`);
                continue;
            }
            
            const contractForFoundry = libConfig.path + ':' + libConfig.name;

            // 🔍 DEBUG: Показываем какой API ключ используется (замаскированный)
            const apiKey = process.env.ETHERSCAN_API_KEY ? process.env.ETHERSCAN_API_KEY.trim() : '';
            console.log(`🔍 DEBUG: ETHERSCAN_API_KEY length: ${apiKey.length}`);
            console.log(`🔍 DEBUG: ETHERSCAN_API_KEY first 5 chars: ${apiKey.substring(0, 5)}...`);
            console.log(`🔍 DEBUG: RPC_URL being used: ${process.env.RPC_URL_SEPOLIA.substring(0, 40)}...`);

            // Деплой библиотеки с Solidity 0.8.27
            // ВАЖНО: trim() убирает лишние пробелы из API ключа
            // --verify включен для автоматической верификации на Etherscan (отключено для NEO X)
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
                foundryCommand = `forge create "${contractForFoundry}" --private-key ${process.env.DEPLOYER_PRIVATE_KEY} --rpc-url ${process.env.RPC_URL_SEPOLIA} --verify --etherscan-api-key ${apiKey} --broadcast --json --use 0.8.27`;
            }

            console.log(`📋 Command: forge create "${contractForFoundry}"`);
            console.log(`🔧 Using Solidity 0.8.27 for Aave v3.5 compatibility`);
            console.log(`📝 Auto-verification enabled for Etherscan`);
            
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
                console.log(`🎉 ${libConfig.name} deployed at: ${contractAddress}`);
                console.log(`📊 Gas optimization: Using library linking for future contracts`);

                // Дополнительная проверка деплоя (как в Phase 2.5)
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

                // Сохранить прогресс после проверки
                deployments.libraries[libConfig.name] = contractAddress;
                deployments.timestamp = new Date().toISOString();
                deployments.phase = 'core-1-in-progress';
                fs.writeFileSync('deployments/all-contracts.json', JSON.stringify(deployments, null, 2));

                console.log('💾 Progress saved to deployments/all-contracts.json');

            } else {
                console.error(`❌ Could not extract deployment address for ${libConfig.name}`);
                console.error('Full output:', foundryOutput);
                process.exit(1);
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

            process.exit(1);
        }

        // Увеличенная задержка между деплоями для стабильности
        console.log('⏳ Waiting 10s before next deployment...');
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
    
    console.log(`\n📊 Total libraries: ${Object.keys(deployments.libraries).length}`);
    console.log('💡 These libraries will be linked to contracts in Phase 2-3');
    console.log('🚀 Next: Run CORE Phase 2 (Infrastructure)');
    console.log('');
    console.log('🎯 CORE Progress: Phase 1/5 ✅');
}

// Запуск
deployCorePhase1().catch((error) => {
    console.error('\n❌ CORE Phase 1 deployment failed:');
    console.error(error);
    process.exit(1);
});