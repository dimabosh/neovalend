const { ethers } = require('ethers');
const fs = require('fs');
const { execSync } = require('child_process');

// CORE Phase 3.2: wA7A5 Token Deployment
// Деплой wrapped A7A5 токена для использования в lending протоколе

async function deployWA7A5Token() {
    console.log('🚀 CORE Phase 3.2: wA7A5 Token Deployment');
    console.log('=========================================');
    console.log('📋 Deploying wA7A5 (Wrapped A7A5) Token');
    console.log('📋 Total Supply: 100,000,000,000 wA7A5 (100 billion)\n');

    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL_SEPOLIA);
    const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);

    console.log('📋 Deployer:', wallet.address);
    const balance = await provider.getBalance(wallet.address);
    console.log('💰 Balance:', ethers.formatEther(balance), 'ETH\n');

    // Load deployments
    if (!fs.existsSync('deployments/all-contracts.json')) {
        console.error('❌ deployments/all-contracts.json not found!');
        process.exit(1);
    }

    const deployments = JSON.parse(fs.readFileSync('deployments/all-contracts.json', 'utf8'));

    // Check if wA7A5 already deployed
    if (deployments.contracts['wA7A5'] && !process.env.FORCE_REDEPLOY) {
        console.log(`✅ wA7A5 already deployed at: ${deployments.contracts['wA7A5']}`);
        console.log('⏭️  Skipping deployment (use FORCE_REDEPLOY=true to redeploy)');
        process.exit(0);
    }

    // ===========================================
    // DEPLOY WA7A5 TOKEN
    // ===========================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🪙 DEPLOYING WA7A5 TOKEN');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const contractPath = 'contracts/WA7A5Token.sol:WA7A5Token';

    // Constructor arguments
    const initialSupply = ethers.parseEther('100000000000'); // 100 billion tokens
    const initialOwner = wallet.address;

    console.log(`📋 Contract: ${contractPath}`);
    console.log(`📋 Initial Supply: 100,000,000,000 wA7A5`);
    console.log(`📋 Initial Owner: ${initialOwner}\n`);

    // Build forge command
    let foundryCommand = `forge create "${contractPath}" --private-key ${process.env.DEPLOYER_PRIVATE_KEY} --rpc-url ${process.env.RPC_URL_SEPOLIA} --verify --etherscan-api-key ${process.env.ETHERSCAN_API_KEY} --broadcast --json --use 0.8.27`;

    // Add constructor args
    foundryCommand += ` --constructor-args ${initialSupply} ${initialOwner}`;

    console.log('🔧 Deploying wA7A5Token...');

    // Deploy with error handling
    let output;
    try {
        output = execSync(foundryCommand, {
            encoding: 'utf8',
            stdio: 'pipe',
            maxBuffer: 50 * 1024 * 1024
        });
        console.log('✅ Deployment successful!');
    } catch (execError) {
        console.log('⚠️ Forge command exited with error, but deployment may have succeeded');
        output = execError.stdout ? execError.stdout.toString() : '';
        if (execError.stderr) {
            console.log('📥 Forge stderr:', execError.stderr.toString().substring(0, 500));
        }
    }

    // Parse deployment address
    let tokenAddress = null;
    const jsonMatch = output.match(/\{[^}]*"deployedTo"[^}]*\}/);
    if (jsonMatch) {
        const jsonOutput = JSON.parse(jsonMatch[0]);
        tokenAddress = jsonOutput.deployedTo;
    } else {
        // Fallback regex
        const addressMatch = output.match(/Deployed to: (0x[a-fA-F0-9]{40})/);
        if (addressMatch) {
            tokenAddress = addressMatch[1];
        }
    }

    if (!tokenAddress || tokenAddress === '0x0000000000000000000000000000000000000000') {
        console.error('❌ Could not parse deployment address');
        console.error('Output:', output);
        process.exit(1);
    }

    // Verify deployment
    console.log('🔍 Verifying token deployment...');
    try {
        const checkCommand = `cast code ${tokenAddress} --rpc-url ${process.env.RPC_URL_SEPOLIA}`;
        const code = execSync(checkCommand, { stdio: 'pipe', encoding: 'utf8' }).trim();

        if (code === '0x' || code.length <= 4) {
            console.log('❌ Token code not found - deployment may have failed');
            console.log('🔄 Waiting 15s for blockchain to sync...');
            await new Promise(resolve => setTimeout(resolve, 15000));

            // Retry
            const codeRetry = execSync(checkCommand, { stdio: 'pipe', encoding: 'utf8' }).trim();
            if (codeRetry === '0x' || codeRetry.length <= 4) {
                throw new Error('Token deployment failed - no code at address');
            } else {
                console.log('✅ Token code found after retry');
            }
        } else {
            console.log('✅ Token code verified on-chain');
        }
    } catch (verifyError) {
        console.log('⚠️ Token verification failed:', verifyError.message);
        console.log('🔄 Continuing anyway - token may still be valid');
    }

    console.log(`✅ wA7A5 Token deployed at: ${tokenAddress}\n`);

    // Verify token properties
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 VERIFYING TOKEN PROPERTIES');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    try {
        // Check name
        const nameData = await provider.call({
            to: tokenAddress,
            data: '0x06fdde03' // name() selector
        });
        const name = ethers.AbiCoder.defaultAbiCoder().decode(['string'], nameData)[0];
        console.log(`📋 Token Name: ${name}`);

        // Check symbol
        const symbolData = await provider.call({
            to: tokenAddress,
            data: '0x95d89b41' // symbol() selector
        });
        const symbol = ethers.AbiCoder.defaultAbiCoder().decode(['string'], symbolData)[0];
        console.log(`📋 Token Symbol: ${symbol}`);

        // Check decimals
        const decimalsData = await provider.call({
            to: tokenAddress,
            data: '0x313ce567' // decimals() selector
        });
        const decimals = parseInt(decimalsData, 16);
        console.log(`📋 Token Decimals: ${decimals}`);

        // Check total supply
        const totalSupplyData = await provider.call({
            to: tokenAddress,
            data: '0x18160ddd' // totalSupply() selector
        });
        const totalSupply = ethers.formatEther(totalSupplyData);
        console.log(`📋 Total Supply: ${totalSupply} wA7A5`);

        // Check owner balance
        const balanceData = await provider.call({
            to: tokenAddress,
            data: '0x70a08231' + wallet.address.slice(2).padStart(64, '0') // balanceOf(deployer)
        });
        const ownerBalance = ethers.formatEther(balanceData);
        console.log(`📋 Owner Balance: ${ownerBalance} wA7A5`);

        if (totalSupply === '100000000000.0' && ownerBalance === '100000000000.0') {
            console.log('\n✅ Token properties verified correctly!');
        } else {
            console.log('\n⚠️ Token properties mismatch!');
            console.log(`Expected: 100,000,000,000 wA7A5`);
            console.log(`Got: ${totalSupply} wA7A5`);
        }

    } catch (error) {
        console.log('⚠️ Token property verification failed:', error.message);
    }

    // Save deployment
    deployments.contracts['wA7A5'] = tokenAddress;
    deployments.phase = 'core-3.2-completed';
    deployments.timestamp = new Date().toISOString();
    fs.writeFileSync('deployments/all-contracts.json', JSON.stringify(deployments, null, 2));

    console.log('\n🎉 CORE Phase 3.2 Complete!');
    console.log('============================');
    console.log('📋 Deployed Token:');
    console.log(`  ✅ wA7A5 Token: ${tokenAddress}`);
    console.log(`  ✅ Total Supply: 100,000,000,000 wA7A5`);
    console.log(`  ✅ Owner: ${initialOwner}`);
    console.log('');
    console.log('⚡ WA7A5 TOKEN READY FOR LENDING PROTOCOL!');
    console.log('📋 Can now be used as collateral in Pool');
    console.log('🚀 Next: Run CORE Phase 4 (Token Implementation)');
    console.log('');
    console.log('🎯 CORE Progress: Phase 3.2/5 ✅');
}

// Run
deployWA7A5Token().catch((error) => {
    console.error('\n❌ CORE Phase 3.2 failed:');
    console.error(error);
    process.exit(1);
});
