const { execSync } = require('child_process');
const fs = require('fs');

// HOTFIX: Configure wA7A5 as collateral
// Phase 6 failed to configure collateral due to wrong function signature

async function fixWA7A5Collateral() {
    console.log('🔧 HOTFIX: Configuring wA7A5 as collateral');
    console.log('==========================================\n');

    // Load deployments
    const deployments = JSON.parse(fs.readFileSync('deployments/all-contracts.json', 'utf8'));

    const poolConfigurator = deployments.contracts.PoolConfigurator;
    const wA7A5Address = deployments.contracts.wA7A5;

    console.log('📍 PoolConfigurator:', poolConfigurator);
    console.log('📍 wA7A5:', wA7A5Address);
    console.log('');

    // wA7A5 collateral parameters
    const ltv = 5000;                    // 50% LTV
    const liquidationThreshold = 6000;   // 60% Liquidation Threshold
    const liquidationBonus = 11000;      // 110% = 10% bonus

    console.log('📋 Configuration Parameters:');
    console.log(`   - LTV: ${ltv} bps (${ltv/100}%)`);
    console.log(`   - Liquidation Threshold: ${liquidationThreshold} bps (${liquidationThreshold/100}%)`);
    console.log(`   - Liquidation Bonus: ${liquidationBonus} bps (${liquidationBonus/100}%)`);
    console.log('');

    // Step 1: Check current configuration
    console.log('🔍 Checking current configuration...');
    try {
        const configOutput = execSync(
            `cast call ${deployments.contracts.Pool} "getConfiguration(address)" ${wA7A5Address} --rpc-url ${process.env.RPC_URL_SEPOLIA}`,
            { encoding: 'utf8' }
        ).trim();

        console.log(`📋 Current config bitmap: ${configOutput}`);
        console.log('');
    } catch (e) {
        console.error('⚠️ Could not read current config');
    }

    // Step 2: Configure collateral
    console.log('🚀 Configuring wA7A5 as collateral...');
    console.log('💡 Using correct Aave v3.5 signature: configureReserveAsCollateral(address,uint256,uint256,uint256)');
    console.log('');

    const collateralCommand = `cast send ${poolConfigurator} "configureReserveAsCollateral(address,uint256,uint256,uint256)" ${wA7A5Address} ${ltv} ${liquidationThreshold} ${liquidationBonus} --private-key ${process.env.DEPLOYER_PRIVATE_KEY} --rpc-url ${process.env.RPC_URL_SEPOLIA}`;

    try {
        const output = execSync(collateralCommand, { stdio: 'pipe', encoding: 'utf8' });
        console.log('✅ Collateral configured successfully!');
        console.log('📋 Transaction output:');
        console.log(output);
    } catch (error) {
        console.error('❌ Failed to configure collateral:');
        console.error(error.message);
        if (error.stderr) {
            console.error('📋 Error details:');
            console.error(error.stderr.toString());
        }
        process.exit(1);
    }

    // Step 3: Verify configuration
    console.log('');
    console.log('🔍 Verifying configuration...');

    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for block confirmation

    try {
        const configOutput = execSync(
            `cast call ${deployments.contracts.Pool} "getConfiguration(address)" ${wA7A5Address} --rpc-url ${process.env.RPC_URL_SEPOLIA}`,
            { encoding: 'utf8' }
        ).trim();

        console.log(`📋 New config bitmap: ${configOutput}`);

        // Decode configuration
        const config = BigInt(configOutput);
        const newLtv = Number(config & BigInt(0xFFFF));
        const newLiqThreshold = Number((config >> BigInt(16)) & BigInt(0xFFFF));
        const newLiqBonus = Number((config >> BigInt(32)) & BigInt(0xFFFF));

        console.log('');
        console.log('📊 Verified Configuration:');
        console.log(`   ✅ LTV: ${newLtv} bps (${newLtv/100}%)`);
        console.log(`   ✅ Liquidation Threshold: ${newLiqThreshold} bps (${newLiqThreshold/100}%)`);
        console.log(`   ✅ Liquidation Bonus: ${newLiqBonus} bps (${(newLiqBonus-10000)/100}% bonus)`);

        if (newLtv === ltv && newLiqThreshold === liquidationThreshold && newLiqBonus === liquidationBonus) {
            console.log('');
            console.log('🎉 HOTFIX SUCCESSFUL! wA7A5 now configured as collateral! ✅');
        } else {
            console.error('');
            console.error('⚠️ Configuration mismatch! Please verify manually.');
        }

    } catch (e) {
        console.error('⚠️ Could not verify configuration:', e.message);
    }
}

// Run
fixWA7A5Collateral().catch((error) => {
    console.error('\\n❌ Hotfix failed:');
    console.error(error);
    process.exit(1);
});
