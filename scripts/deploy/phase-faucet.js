const { ethers } = require('ethers');
const fs = require('fs');
const { execSync } = require('child_process');

// Phase Faucet: Deploy SimpleFaucet Contract for Testnet Token Distribution
// 1 контракт: SimpleFaucet (Solidity 0.8.10)

async function deployFaucet() {
    console.log('🚰 Phase Faucet: Deploy Testnet Faucet Contract');
    console.log('===============================================');
    console.log('💰 Estimated Cost: ~$0.1 USD');
    console.log('📋 Contracts: SimpleFaucet');
    console.log('🏦 Features: Token distribution with 24h cooldown');

    const network = process.env.NETWORK || 'neox-testnet';
    const isNeoX = network.includes('neox');
    const rpcUrl = process.env.RPC_URL || (isNeoX ? 'https://neoxt4seed1.ngd.network/' : process.env.RPC_URL_SEPOLIA);

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);

    console.log('🌐 Network:', network);
    console.log('📋 Deployer:', wallet.address);
    const balance = await provider.getBalance(wallet.address);
    console.log('💰 Balance:', ethers.formatEther(balance), isNeoX ? 'GAS' : 'ETH');

    // Загрузить deployments
    let deployments = {
        network: network,
        deployer: wallet.address,
        timestamp: new Date().toISOString(),
        phase: 'faucet',
        tokens: {},
        libraries: {},
        contracts: {}
    };

    if (fs.existsSync('deployments/all-contracts.json')) {
        const existing = JSON.parse(fs.readFileSync('deployments/all-contracts.json', 'utf8'));
        deployments = { ...deployments, ...existing };
        console.log('📄 Loaded existing deployments');
    }

    // Token addresses from deployments
    const tokens = deployments.tokens || {};
    console.log('\n📋 Token Addresses:');
    Object.entries(tokens).forEach(([name, address]) => {
        console.log(`  ${name}: ${address}`);
    });

    // Smart deployment mode
    const forceRedeploy = process.env.FORCE_REDEPLOY === 'true';
    if (forceRedeploy) {
        console.log('🔥 Force redeploy mode: will redeploy Faucet contract');
    } else if (deployments.contracts.SimpleFaucet) {
        console.log(`\n✅ SimpleFaucet already deployed at: ${deployments.contracts.SimpleFaucet}`);
        console.log(`⏭️  Skipping redeployment (use FORCE_REDEPLOY=true to override)`);

        const explorerUrl = isNeoX ? 'https://xt4scan.ngd.network/address/' : 'https://sepolia.etherscan.io/address/';
        console.log(`📊 Explorer: ${explorerUrl}${deployments.contracts.SimpleFaucet}`);
        return;
    } else {
        console.log('🔄 Smart mode: deploying SimpleFaucet contract');
    }

    console.log(`\n🎯 Deploying SimpleFaucet contract...`);

    // SimpleFaucet contract configuration
    const faucetConfig = {
        name: 'SimpleFaucet',
        path: 'contracts/faucet/SimpleFaucet.sol',
        description: 'Testnet faucet for distributing tokens with 24h cooldown'
    };

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📦 Deploying: ${faucetConfig.name}`);
    console.log(`📝 ${faucetConfig.description}`);
    console.log(`📄 Path: ${faucetConfig.path}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    // Базовая команда forge create
    let foundryCommand;
    if (isNeoX) {
        // NEO X: --legacy for non-EIP1559, no Etherscan verification
        foundryCommand = `forge create "${faucetConfig.path}:${faucetConfig.name}" ` +
            `--private-key ${process.env.DEPLOYER_PRIVATE_KEY} ` +
            `--rpc-url ${rpcUrl} ` +
            `--legacy ` +
            `--broadcast ` +
            `--json`;
    } else {
        foundryCommand = `forge create "${faucetConfig.path}:${faucetConfig.name}" ` +
            `--private-key ${process.env.DEPLOYER_PRIVATE_KEY} ` +
            `--rpc-url ${rpcUrl} ` +
            `--verify ` +
            `--etherscan-api-key ${process.env.ETHERSCAN_API_KEY} ` +
            `--broadcast ` +
            `--json`;
    }

    console.log('🔨 Executing foundry command...');

    let foundryOutput = '';
    let contractAddress = null;

    try {
        foundryOutput = execSync(foundryCommand, {
            stdio: 'pipe',
            encoding: 'utf8'
        });
        console.log('✅ Deployment successful!');
    } catch (execError) {
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
            const checkCommand = `cast code ${contractAddress} --rpc-url ${rpcUrl}`;
            const code = execSync(checkCommand, { stdio: 'pipe', encoding: 'utf8' }).trim();

            if (code === '0x' || code.length <= 4) {
                console.log('❌ Contract code not found - waiting 15s for sync...');
                await new Promise(resolve => setTimeout(resolve, 15000));

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
        deployments.contracts.SimpleFaucet = contractAddress;
        deployments.timestamp = new Date().toISOString();
        fs.writeFileSync('deployments/all-contracts.json', JSON.stringify(deployments, null, 2));

        const explorerUrl = isNeoX ? 'https://xt4scan.ngd.network/address/' : 'https://sepolia.etherscan.io/address/';
        console.log(`\n✅ ${faucetConfig.name} deployed at: ${contractAddress}`);
        console.log(`📊 Explorer: ${explorerUrl}${contractAddress}`);
    } else {
        console.error('❌ Could not extract contract address from foundry output');
        console.log('📋 Foundry output:', foundryOutput);
        process.exit(1);
    }

    // Configure claim amounts for tokens
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⚙️  Configuring claim amounts...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Default claim amounts (in token units)
    const claimAmounts = {
        'USDT': { amount: '1000', decimals: 6 },      // 1000 USDT
        'USDC': { amount: '1000', decimals: 6 },      // 1000 USDC
        'NEO': { amount: '100', decimals: 18 },       // 100 NEO
        'ETH': { amount: '1', decimals: 18 },         // 1 ETH
        'BTC': { amount: '0.1', decimals: 8 },        // 0.1 BTC
    };

    const tokenAddresses = [];
    const amounts = [];

    for (const [symbol, config] of Object.entries(claimAmounts)) {
        const tokenAddress = tokens[symbol];
        if (tokenAddress) {
            tokenAddresses.push(tokenAddress);
            const amountWei = ethers.parseUnits(config.amount, config.decimals);
            amounts.push(amountWei.toString());
            console.log(`  ${symbol}: ${config.amount} tokens (${amountWei.toString()} wei)`);
        }
    }

    if (tokenAddresses.length > 0) {
        // Format arrays for cast send
        const tokensArg = `[${tokenAddresses.join(',')}]`;
        const amountsArg = `[${amounts.join(',')}]`;

        const setAmountsCommand = `cast send ${contractAddress} ` +
            `"setClaimAmounts(address[],uint256[])" ` +
            `"${tokensArg}" "${amountsArg}" ` +
            `--private-key ${process.env.DEPLOYER_PRIVATE_KEY} ` +
            `--rpc-url ${rpcUrl}` +
            (isNeoX ? ' --legacy' : '');

        console.log('\n🔧 Setting claim amounts...');
        try {
            execSync(setAmountsCommand, { stdio: 'inherit' });
            console.log('✅ Claim amounts configured!');
        } catch (error) {
            console.log('⚠️ Failed to set claim amounts:', error.message);
            console.log('📋 You can set them manually later');
        }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Phase Faucet Deployment Complete!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('📊 Deployment Summary:');
    console.log('  SimpleFaucet:', contractAddress);
    console.log('  Cooldown Period: 24 hours');
    console.log('');

    console.log('🎯 Next Steps:');
    console.log('  1. Fund the Faucet contract with tokens');
    console.log(`     Faucet Address: ${contractAddress}`);
    console.log('');

    console.log('  Example transfer commands:');
    for (const [symbol, address] of Object.entries(tokens)) {
        if (symbol === 'WGAS') continue; // Skip WGAS - it's wrapped native token
        console.log(`     # Transfer ${symbol} to Faucet:`);
        console.log(`     cast send ${address} "transfer(address,uint256)" ${contractAddress} <AMOUNT> --private-key $DEPLOYER_PRIVATE_KEY --rpc-url ${rpcUrl}${isNeoX ? ' --legacy' : ''}`);
        console.log('');
    }

    console.log('  2. Update frontend at /faucet page');
    console.log('  3. Users can claim tokens with 24h cooldown');
}

// Запуск скрипта
deployFaucet()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('❌ Deployment failed:', error);
        process.exit(1);
    });
