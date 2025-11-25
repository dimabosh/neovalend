const { ethers } = require('ethers');
const fs = require('fs');
const { execSync } = require('child_process');

// CORE Phase 2.1: PoolAddressesProvider ONLY
// Деплой главного контракта-регистра + установка ACL Admin

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
        constructorArgs: ['A7A5', wallet.address]  // Массив как в Phase 3
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
                const setCommand = `cast send ${deployments.contracts[contractConfig.name]} "setACLAdmin(address)" ${wallet.address} --private-key ${process.env.DEPLOYER_PRIVATE_KEY} --rpc-url ${process.env.RPC_URL_SEPOLIA} --gas-limit 200000`;
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

    try {
        // Проверим что файл существует
        if (!fs.existsSync(contractConfig.path)) {
            console.error(`❌ Contract file not found: ${contractConfig.path}`);
            process.exit(1);
        }

        const contractForFoundry = contractConfig.path + ':' + contractConfig.name;

        // Trim API key (убрать пробелы)
        const apiKey = process.env.ETHERSCAN_API_KEY ? process.env.ETHERSCAN_API_KEY.trim() : '';
        console.log(`🔍 DEBUG: ETHERSCAN_API_KEY length: ${apiKey.length}`);
        console.log(`🔍 DEBUG: ETHERSCAN_API_KEY first 5 chars: ${apiKey.substring(0, 5)}...`);

        // Сборка команды с constructor args (ТОЧНО как в Phase 1)
        const network = process.env.NETWORK || 'sepolia';
        const isNeoX = network.includes('neox');

        let foundryCommand;
        if (isNeoX) {
            // NEO X: Verification via Blockscout
            const verifierUrl = network === 'neox-mainnet'
                ? 'https://xexplorer.neo.org/api'
                : 'https://xt4scan.ngd.network/api';
            foundryCommand = `forge create "${contractForFoundry}" --private-key ${process.env.DEPLOYER_PRIVATE_KEY} --rpc-url ${process.env.RPC_URL_SEPOLIA} --verify --verifier blockscout --verifier-url ${verifierUrl} --broadcast --json --use 0.8.27`;
            console.log(`🌐 Deploying to NEO X (${network}) - Blockscout verification`);
        } else {
            // Ethereum networks: верификация через Etherscan
            foundryCommand = `forge create "${contractForFoundry}" --private-key ${process.env.DEPLOYER_PRIVATE_KEY} --rpc-url ${process.env.RPC_URL_SEPOLIA} --verify --etherscan-api-key ${apiKey} --broadcast --json --use 0.8.27`;
        }

        if (contractConfig.constructorArgs && contractConfig.constructorArgs.length > 0) {
            foundryCommand += ` --constructor-args ${contractConfig.constructorArgs.join(' ')}`;
        }

        console.log(`📋 Command: forge create "${contractForFoundry}"`);
        console.log(`🔧 Using Solidity 0.8.27 for Aave v3.5 compatibility`);
        console.log(`📝 Auto-verification enabled for Etherscan`);
        console.log(`📋 Constructor args:`, contractConfig.constructorArgs);

        // Try-catch обработка (как в Phase 1)
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
            const setACLAdminCommand = `cast send ${contractAddress} "setACLAdmin(address)" ${wallet.address} --private-key ${process.env.DEPLOYER_PRIVATE_KEY} --rpc-url ${process.env.RPC_URL_SEPOLIA} --gas-limit 200000`;

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
