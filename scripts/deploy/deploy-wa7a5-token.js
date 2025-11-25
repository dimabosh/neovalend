const { ethers } = require('ethers');
const fs = require('fs');
const { execSync } = require('child_process');

// Deploy wA7A5 Token with 100 billion supply
// ВАЖНО: Этот токен будет использоваться как wrapped A7A5 в протоколе

async function deployWA7A5Token() {
    console.log('🚀 Deploying wA7A5 Token (Wrapped A7A5)');
    console.log('==========================================');
    console.log('📋 Initial Supply: 100,000,000,000 wA7A5 (100 billion)');
    console.log('📋 Decimals: 18');
    console.log('📋 Symbol: wA7A5');
    console.log('📋 Name: Wrapped A7A5 Token\n');

    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL_SEPOLIA);
    const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);

    console.log('📋 Deployer:', wallet.address);
    const balance = await provider.getBalance(wallet.address);
    console.log('💰 Balance:', ethers.formatEther(balance), 'ETH\n');

    if (balance === 0n) {
        console.error('❌ Deployer has no ETH! Fund the wallet first.');
        process.exit(1);
    }

    // Load or create deployments file
    let deployments = {
        network: 'sepolia',
        deployer: wallet.address,
        timestamp: new Date().toISOString(),
        libraries: {},
        contracts: {}
    };

    if (fs.existsSync('deployments/all-contracts.json')) {
        const existing = JSON.parse(fs.readFileSync('deployments/all-contracts.json', 'utf8'));
        deployments = { ...deployments, ...existing };
        console.log('📄 Loaded existing deployments\n');
    }

    // Check if wA7A5 already deployed
    if (deployments.contracts['wA7A5Token']) {
        console.log(`⚠️  wA7A5Token already deployed at: ${deployments.contracts['wA7A5Token']}`);
        console.log('❌ Cannot redeploy token (would create new supply)');
        console.log('💡 Use existing token or delete deployments/all-contracts.json to start fresh\n');
        process.exit(1);
    }

    try {
        // Deploy wA7A5 Token using Foundry
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🔨 DEPLOYING wA7A5 TOKEN CONTRACT');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // Initial supply: 100 billion tokens (18 decimals)
        const initialSupply = '100000000000000000000000000000'; // 100,000,000,000 * 10^18

        const contractPath = 'contracts/WA7A5Token.sol:WA7A5Token';

        console.log(`📋 Contract: ${contractPath}`);
        console.log(`📋 Initial Supply: 100,000,000,000 wA7A5`);
        console.log(`📋 Owner: ${wallet.address}\n`);

        // Forge create command with constructor args
        const deployCommand = `forge create "${contractPath}" --private-key ${process.env.DEPLOYER_PRIVATE_KEY} --rpc-url ${process.env.RPC_URL_SEPOLIA} --verify --etherscan-api-key ${process.env.ETHERSCAN_API_KEY} --broadcast --json --use 0.8.27 --constructor-args ${initialSupply} ${wallet.address}`;

        console.log('🔧 Deploying wA7A5Token...');
        const output = execSync(deployCommand, { encoding: 'utf8', stdio: 'pipe' });

        // Parse deployment address
        const jsonMatch = output.match(/\{[^}]*"deployedTo"[^}]*\}/);
        if (!jsonMatch) {
            console.error('❌ Could not parse deployment output');
            console.error('Output:', output);
            process.exit(1);
        }

        const jsonOutput = JSON.parse(jsonMatch[0]);
        const tokenAddress = jsonOutput.deployedTo;

        console.log(`\n✅ wA7A5 Token deployed at: ${tokenAddress}`);
        console.log(`🔗 Etherscan: https://sepolia.etherscan.io/address/${tokenAddress}\n`);

        // Verify deployment by checking totalSupply
        console.log('🔍 Verifying token deployment...');
        const totalSupply = await provider.call({
            to: tokenAddress,
            data: '0x18160ddd' // totalSupply() selector
        });

        const supplyBigInt = BigInt(totalSupply);
        const supplyFormatted = ethers.formatEther(supplyBigInt);

        console.log(`📊 Total Supply: ${supplyFormatted} wA7A5`);

        if (supplyBigInt === BigInt(initialSupply)) {
            console.log('✅ Supply verified: 100,000,000,000 wA7A5');
        } else {
            console.log('⚠️  Supply mismatch!');
            console.log(`   Expected: ${ethers.formatEther(initialSupply)}`);
            console.log(`   Actual: ${supplyFormatted}`);
        }

        // Check owner balance
        const ownerBalance = await provider.call({
            to: tokenAddress,
            data: '0x70a08231' + wallet.address.slice(2).padStart(64, '0') // balanceOf(owner)
        });

        const ownerBalanceFormatted = ethers.formatEther(BigInt(ownerBalance));
        console.log(`💰 Owner Balance: ${ownerBalanceFormatted} wA7A5`);
        console.log(`📋 All tokens minted to: ${wallet.address}\n`);

        // Save to deployments
        deployments.contracts['wA7A5Token'] = tokenAddress;
        deployments.timestamp = new Date().toISOString();
        fs.writeFileSync('deployments/all-contracts.json', JSON.stringify(deployments, null, 2));

        console.log('🎉 wA7A5 Token Deployment Complete!');
        console.log('====================================');
        console.log(`📋 Token Address: ${tokenAddress}`);
        console.log(`📋 Total Supply: 100,000,000,000 wA7A5`);
        console.log(`📋 Owner: ${wallet.address}`);
        console.log(`📋 Network: Sepolia Testnet`);
        console.log('');
        console.log('🚀 Next: Deploy CORE Protocol (Phase 1-5)');
        console.log('💡 Update NEXT_PUBLIC_A7A5_ADDRESS in .env.local with this address');

    } catch (error) {
        console.error('❌ Failed to deploy wA7A5 Token:', error.message);
        process.exit(1);
    }
}

// Run deployment
deployWA7A5Token().catch((error) => {
    console.error('\n❌ wA7A5 Token deployment failed:');
    console.error(error);
    process.exit(1);
});
