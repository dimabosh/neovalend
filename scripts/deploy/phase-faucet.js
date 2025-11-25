const { ethers } = require('ethers');
const fs = require('fs');
const { execSync } = require('child_process');

// Phase Faucet: Deploy Faucet Contract for Testnet Token Distribution
// 1 контракт: Faucet (Solidity 0.8.27)

async function deployFaucet() {
    console.log('🚰 Phase Faucet: Deploy Testnet Faucet Contract');
    console.log('===============================================');
    console.log('💰 Estimated Cost: ~$0.2 USD');
    console.log('📋 Contracts: 1 faucet contract');
    console.log('🏦 Features: Token distribution with 24h cooldown');

    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL_SEPOLIA);
    const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);

    console.log('📋 Deployer:', wallet.address);
    const balance = await provider.getBalance(wallet.address);
    console.log('💰 Balance:', ethers.formatEther(balance), 'ETH');

    // Загрузить deployments
    let deployments = {
        network: process.env.NETWORK || 'sepolia',
        deployer: wallet.address,
        timestamp: new Date().toISOString(),
        phase: 'faucet',
        libraries: {},
        contracts: {}
    };

    if (fs.existsSync('deployments/all-contracts.json')) {
        const existing = JSON.parse(fs.readFileSync('deployments/all-contracts.json', 'utf8'));
        deployments.contracts = existing.contracts || {};
        deployments.libraries = existing.libraries || {};
        console.log('📄 Loaded existing deployments');
    }

    // Token addresses
    const USDT = deployments.contracts.USDT || process.env.USDT_ADDRESS || '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0';
    const WA7A5 = deployments.contracts.wA7A5 || process.env.WA7A5_ADDRESS || '0x18fb744Eb960480179006E3391293c77bB6f8De6';
    const WBTC = deployments.contracts.WBTC || process.env.WBTC_ADDRESS || '0x29f2D40B0605204364af54EC677bD022dA425d03';

    console.log('\n📋 Token Addresses:');
    console.log('  USDT:', USDT);
    console.log('  wA7A5:', WA7A5);
    console.log('  WBTC:', WBTC);

    // Smart deployment mode
    const forceRedeploy = process.env.FORCE_REDEPLOY === 'true';
    if (forceRedeploy) {
        console.log('🔥 Force redeploy mode: will redeploy Faucet contract');
    } else if (deployments.contracts.Faucet) {
        console.log(`✅ Faucet already deployed at: ${deployments.contracts.Faucet}`);
        console.log(`⏭️  Skipping redeployment (use FORCE_REDEPLOY=true to override)`);

        // Вывести информацию о Faucet
        console.log('\n📊 Faucet Contract Information:');
        console.log('  Address:', deployments.contracts.Faucet);
        console.log('  Etherscan:', `https://sepolia.etherscan.io/address/${deployments.contracts.Faucet}`);

        return;
    } else {
        console.log('🔄 Smart mode: deploying Faucet contract');
    }

    console.log(`\n🎯 Deploying Faucet contract with Solidity 0.8.27...`);

    // Faucet contract configuration
    const faucetConfig = {
        name: 'Faucet',
        path: 'contracts/Faucet.sol',
        description: 'Testnet faucet for distributing USDT, wA7A5, and WBTC tokens',
        constructor: [USDT, WA7A5, WBTC]
    };

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📦 Deploying: ${faucetConfig.name}`);
    console.log(`📝 ${faucetConfig.description}`);
    console.log(`📄 Path: ${faucetConfig.path}`);
    console.log(`🏗️  Constructor Args:`);
    console.log(`   USDT: ${faucetConfig.constructor[0]}`);
    console.log(`   wA7A5: ${faucetConfig.constructor[1]}`);
    console.log(`   WBTC: ${faucetConfig.constructor[2]}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    // Базовая команда forge create
    let foundryCommand = `forge create "${faucetConfig.path}:${faucetConfig.name}" ` +
        `--private-key ${process.env.DEPLOYER_PRIVATE_KEY} ` +
        `--rpc-url ${process.env.RPC_URL_SEPOLIA} ` +
        `--verify ` +
        `--etherscan-api-key ${process.env.ETHERSCAN_API_KEY} ` +
        `--broadcast ` +
        `--json ` +
        `--use 0.8.27`;

    // Добавить constructor args
    if (faucetConfig.constructor && faucetConfig.constructor.length > 0) {
        foundryCommand += ` --constructor-args ${faucetConfig.constructor.join(' ')}`;
    }

    console.log('🔨 Executing foundry command...');
    console.log('📋 Command:', foundryCommand.replace(process.env.DEPLOYER_PRIVATE_KEY, '***'));

    let foundryOutput = '';
    let contractAddress = null;

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
            console.log('⚠️ Error output:', execError.stderr.toString());
        }
    }

    // Парсинг адреса контракта
    const jsonMatch = foundryOutput.match(/\{[^}]*"deployedTo"[^}]*\}/);
    if (jsonMatch) {
        try {
            const jsonOutput = JSON.parse(jsonMatch[0]);
            contractAddress = jsonOutput.deployedTo;
            console.log('✅ Found deployedTo address:', contractAddress);
        } catch (e) {
            console.log('⚠️ Could not parse JSON output');
        }
    }

    // Fallback: текстовый формат
    if (!contractAddress) {
        const addressMatch = foundryOutput.match(/Deployed to: (0x[a-fA-F0-9]{40})/);
        if (addressMatch) {
            contractAddress = addressMatch[1];
            console.log('✅ Found address in text output:', contractAddress);
        }
    }

    // Верификация деплоя через cast code
    if (contractAddress) {
        console.log('🔍 Verifying contract deployment...');

        try {
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
            console.log('❌ Deployment failed!');
            process.exit(1);
        }

        // Сохранить адрес в deployments
        deployments.contracts.Faucet = contractAddress;
        deployments.timestamp = new Date().toISOString();
        fs.writeFileSync('deployments/all-contracts.json', JSON.stringify(deployments, null, 2));

        console.log(`\n✅ ${faucetConfig.name} deployed at: ${contractAddress}`);
        console.log(`📊 Etherscan: https://sepolia.etherscan.io/address/${contractAddress}`);
    } else {
        console.error('❌ Could not extract contract address from foundry output');
        console.log('📋 Foundry output:', foundryOutput);
        process.exit(1);
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Phase Faucet Deployment Complete!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('📊 Deployment Summary:');
    console.log('  Faucet Contract:', contractAddress);
    console.log('  USDT Token:', USDT);
    console.log('  wA7A5 Token:', WA7A5);
    console.log('  WBTC Token:', WBTC);
    console.log('  Cooldown Period: 24 hours');
    console.log('');

    console.log('📋 Faucet Amounts:');
    console.log('  USDT: 1,000 tokens (per request)');
    console.log('  wA7A5: 100,000 tokens (per request)');
    console.log('  WBTC: 0.1 tokens (per request)');
    console.log('');

    console.log('🎯 Next Steps:');
    console.log('  1. Transfer USDT, wA7A5, and WBTC tokens to Faucet contract');
    console.log(`     Faucet Address: ${contractAddress}`);
    console.log('');
    console.log('  Example transfer commands:');
    console.log(`     cast send ${USDT} "transfer(address,uint256)" ${contractAddress} 1000000000000 --private-key $DEPLOYER_PRIVATE_KEY --rpc-url $RPC_URL_SEPOLIA`);
    console.log(`     # Transfer 1M USDT (6 decimals)`);
    console.log('');
    console.log(`     cast send ${WA7A5} "transfer(address,uint256)" ${contractAddress} 10000000000000000000000000 --private-key $DEPLOYER_PRIVATE_KEY --rpc-url $RPC_URL_SEPOLIA`);
    console.log(`     # Transfer 10M wA7A5 (18 decimals)`);
    console.log('');
    console.log(`     cast send ${WBTC} "transfer(address,uint256)" ${contractAddress} 10000000000 --private-key $DEPLOYER_PRIVATE_KEY --rpc-url $RPC_URL_SEPOLIA`);
    console.log(`     # Transfer 100 WBTC (8 decimals)`);
    console.log('');
    console.log('  2. Update frontend to use Faucet contract');
    console.log('  3. Users can request tokens via requestUSDT(), requestWA7A5(), requestWBTC()');
}

// Запуск скрипта
deployFaucet()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('❌ Deployment failed:', error);
        process.exit(1);
    });
