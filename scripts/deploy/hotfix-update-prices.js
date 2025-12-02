const { execSync } = require('child_process');

// HOTFIX: Update Oracle Prices to real market values
// WGAS: $2.2, NEO: $4.3, ETH: $3000, BTC: $90000

async function updatePrices() {
    console.log('🔧 HOTFIX: Update Oracle Prices');
    console.log('================================');
    console.log('📋 Updating to real market prices:\n');

    const network = process.env.NETWORK || 'neox-testnet';
    const isNeoX = network.includes('neox');
    const rpcUrl = process.env.RPC_URL_SEPOLIA;
    const legacyFlag = isNeoX ? '--legacy' : '';

    console.log(`🌐 Network: ${network}`);
    console.log(`📡 RPC URL: ${rpcUrl}\n`);

    // Price oracles deployed in Phase 6 (from log)
    const priceUpdates = [
        { name: 'WGAS', oracle: '0x4092044B42c93a3ee6BDf94121a76b5E1d95FcBD', price: 220000000, display: '$2.20' },
        { name: 'NEO', oracle: '0xdaeA5fF2C2ac92EC9c6EF779637E0535Ec496A29', price: 430000000, display: '$4.30' },
        { name: 'USDT', oracle: '0xE95550a9d57aAaa29BC5d98292498005b59A1dbE', price: 100000000, display: '$1.00' },
        { name: 'USDC', oracle: '0x860d916B194442AfE285ff6Bc63f692D839C37b4', price: 100000000, display: '$1.00' },
        { name: 'ETH', oracle: '0xb97128eb749FB405b618e13FFAcECE2Dd4DCE62E', price: 300000000000, display: '$3,000' },
        { name: 'BTC', oracle: '0xc5F96a82135E430652CC55f1fbce6895bDA2518f', price: 9000000000000, display: '$90,000' }
    ];

    for (const update of priceUpdates) {
        console.log(`💵 Setting ${update.name} price to ${update.display}...`);

        try {
            const cmd = `cast send ${update.oracle} "setPrice(int256)" ${update.price} --private-key ${process.env.DEPLOYER_PRIVATE_KEY} --rpc-url ${rpcUrl} ${legacyFlag}`;
            execSync(cmd, { stdio: 'pipe' });
            console.log(`✅ ${update.name} price updated\n`);
        } catch (error) {
            console.error(`❌ Failed to update ${update.name}:`, error.message);
        }

        await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // Verify prices through AaveOracle
    console.log('\n🔍 Verifying prices through AaveOracle...');
    const ORACLE = '0x6e6A9582dc97827621312bEb6095FDCEBFB4679A';
    const tokens = {
        'WGAS': '0x9b9032D047D7F879F54F5b54aE0EcE03bef39a8e',
        'NEO': '0x8B0652a4db1670741dAb3c4bf882afbACDb44D3C',
        'USDT': '0xbCEAb9b0cee639E8b37607eBA8370e60789bcE7C',
        'USDC': '0x4d7B02c427e3508BbCc14f3079BB364c2Cf2a358',
        'ETH': '0x5f2f94b7F57C713EBA6c1b1aaC2Da7617617a609',
        'BTC': '0x456b48FA869d0409C953a9042e036Ab667cc47C5'
    };

    for (const [name, address] of Object.entries(tokens)) {
        try {
            const price = execSync(
                `cast call ${ORACLE} "getAssetPrice(address)(uint256)" ${address} --rpc-url ${rpcUrl}`,
                { encoding: 'utf8', stdio: 'pipe' }
            ).trim();
            console.log(`   ${name}: $${(parseInt(price) / 1e8).toLocaleString()} ✅`);
        } catch (e) {
            console.log(`   ${name}: ❌ Could not fetch price`);
        }
    }

    console.log('\n🎉 Price update complete!');
}

updatePrices().catch(console.error);
