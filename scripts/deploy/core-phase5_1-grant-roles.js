const { ethers } = require('ethers');
const fs = require('fs');
const { execSync } = require('child_process');

// CORE Phase 5.1: Grant Admin Roles (Aave v3.5)
// Назначение ролей POOL_ADMIN и ASSET_LISTING_ADMIN для deployer
// Поддержка NEO X с --legacy флагом для транзакций

async function grantRoles() {
    console.log('🔐 CORE Phase 5.1: Grant Admin Roles');
    console.log('====================================');
    console.log('💰 Cost: ~$0.05 USD | 2 transactions');
    console.log('📋 Roles: POOL_ADMIN + ASSET_LISTING_ADMIN');
    console.log('⚡ Required for Phase 6 (reserve initialization)\n');

    // Setup provider and wallet
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL_SEPOLIA);
    const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);

    // Network detection
    const network = process.env.NETWORK || 'sepolia';
    const isNeoX = network.includes('neox');
    const legacyFlag = isNeoX ? '--legacy' : '';

    console.log('📋 Deployer:', wallet.address);
    const balance = await provider.getBalance(wallet.address);
    console.log('💰 Balance:', ethers.formatEther(balance), 'GAS');
    console.log(`🌐 Network: ${network}`);
    if (isNeoX) {
        console.log('⚡ Using legacy transactions for NEO X');
    }
    console.log('');

    // Load deployments
    if (!fs.existsSync('deployments/all-contracts.json')) {
        console.error('❌ deployments/all-contracts.json not found!');
        console.error('💡 Please deploy Phase 1-5 first.');
        process.exit(1);
    }

    const deployments = JSON.parse(fs.readFileSync('deployments/all-contracts.json', 'utf8'));

    // Validate ACLManager exists
    if (!deployments.contracts.ACLManager) {
        console.error('❌ ACLManager not found in deployments!');
        console.error('💡 Please deploy Phase 2 first.');
        process.exit(1);
    }

    const aclManager = deployments.contracts.ACLManager;
    const deployer = wallet.address;

    console.log('📍 ACLManager:', aclManager);
    console.log('👤 Admin Address:', deployer);
    console.log('');

    // ===========================================
    // STEP 1: Check current roles
    // ===========================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 CHECKING CURRENT ROLES');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    let hasPoolAdmin = false;
    let hasAssetListingAdmin = false;

    try {
        // Check POOL_ADMIN role
        const poolAdminCheck = execSync(
            `cast call ${aclManager} "isPoolAdmin(address)(bool)" ${deployer} --rpc-url ${process.env.RPC_URL_SEPOLIA}`,
            { encoding: 'utf8' }
        ).trim();

        hasPoolAdmin = poolAdminCheck === 'true';
        console.log(`📋 POOL_ADMIN: ${hasPoolAdmin ? '✅ Already granted' : '❌ Not granted'}`);

        // Check ASSET_LISTING_ADMIN role
        const assetAdminCheck = execSync(
            `cast call ${aclManager} "isAssetListingAdmin(address)(bool)" ${deployer} --rpc-url ${process.env.RPC_URL_SEPOLIA}`,
            { encoding: 'utf8' }
        ).trim();

        hasAssetListingAdmin = assetAdminCheck === 'true';
        console.log(`📋 ASSET_LISTING_ADMIN: ${hasAssetListingAdmin ? '✅ Already granted' : '❌ Not granted'}`);

    } catch (error) {
        console.log('⚠️ Could not check current roles:', error.message);
        console.log('💡 Continuing with role assignment...');
    }

    console.log('');

    // ===========================================
    // STEP 2: Grant POOL_ADMIN role
    // ===========================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔓 GRANTING POOL_ADMIN ROLE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (hasPoolAdmin) {
        console.log('✅ POOL_ADMIN already granted, skipping...');
    } else {
        console.log('🚀 Adding POOL_ADMIN role to deployer...');
        console.log('💡 This allows Pool configuration and parameter changes\n');

        try {
            execSync(
                `cast send ${aclManager} "addPoolAdmin(address)" ${deployer} --private-key ${process.env.DEPLOYER_PRIVATE_KEY} --rpc-url ${process.env.RPC_URL_SEPOLIA} ${legacyFlag}`,
                { stdio: 'inherit' }
            );
            console.log('\n✅ POOL_ADMIN role granted successfully!');
        } catch (e) {
            console.error('\n❌ Failed to grant POOL_ADMIN role:', e.message);
            console.error('💡 This may be due to:');
            console.error('   - Insufficient permissions (only ACLManager admin can grant roles)');
            console.error('   - Role already granted');
            console.error('   - Network issues');
            process.exit(1);
        }
    }

    console.log('');

    // ===========================================
    // STEP 3: Grant ASSET_LISTING_ADMIN role
    // ===========================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔓 GRANTING ASSET_LISTING_ADMIN ROLE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (hasAssetListingAdmin) {
        console.log('✅ ASSET_LISTING_ADMIN already granted, skipping...');
    } else {
        console.log('🚀 Adding ASSET_LISTING_ADMIN role to deployer...');
        console.log('💡 This allows adding new reserves (assets) to the protocol\n');

        try {
            execSync(
                `cast send ${aclManager} "addAssetListingAdmin(address)" ${deployer} --private-key ${process.env.DEPLOYER_PRIVATE_KEY} --rpc-url ${process.env.RPC_URL_SEPOLIA} ${legacyFlag}`,
                { stdio: 'inherit' }
            );
            console.log('\n✅ ASSET_LISTING_ADMIN role granted successfully!');
        } catch (e) {
            console.error('\n❌ Failed to grant ASSET_LISTING_ADMIN role:', e.message);
            console.error('💡 This may be due to:');
            console.error('   - Insufficient permissions (only ACLManager admin can grant roles)');
            console.error('   - Role already granted');
            console.error('   - Network issues');
            process.exit(1);
        }
    }

    console.log('');

    // ===========================================
    // STEP 4: Verify roles granted
    // ===========================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 VERIFYING ROLES');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    try {
        // Verify POOL_ADMIN
        const poolAdminFinal = execSync(
            `cast call ${aclManager} "isPoolAdmin(address)(bool)" ${deployer} --rpc-url ${process.env.RPC_URL_SEPOLIA}`,
            { encoding: 'utf8' }
        ).trim();

        console.log(`📋 POOL_ADMIN: ${poolAdminFinal === 'true' ? '✅ VERIFIED' : '❌ FAILED'}`);

        // Verify ASSET_LISTING_ADMIN
        const assetAdminFinal = execSync(
            `cast call ${aclManager} "isAssetListingAdmin(address)(bool)" ${deployer} --rpc-url ${process.env.RPC_URL_SEPOLIA}`,
            { encoding: 'utf8' }
        ).trim();

        console.log(`📋 ASSET_LISTING_ADMIN: ${assetAdminFinal === 'true' ? '✅ VERIFIED' : '❌ FAILED'}`);

        if (poolAdminFinal === 'true' && assetAdminFinal === 'true') {
            console.log('\n✅ All roles verified successfully!');
        } else {
            console.error('\n❌ Role verification failed!');
            process.exit(1);
        }

    } catch (error) {
        console.error('⚠️ Could not verify roles:', error.message);
    }

    // Update deployments
    deployments.phase = 'core-5.1-completed';
    deployments.timestamp = new Date().toISOString();
    fs.writeFileSync('deployments/all-contracts.json', JSON.stringify(deployments, null, 2));

    console.log('');
    console.log('🎉 CORE Phase 5.1 Complete!');
    console.log('===========================');
    console.log('✅ Admin roles granted to deployer:');
    console.log(`  📋 POOL_ADMIN: ${deployer}`);
    console.log(`  📋 ASSET_LISTING_ADMIN: ${deployer}`);
    console.log('');
    console.log('💡 PERMISSIONS ENABLED:');
    console.log('  ✅ Configure Pool parameters');
    console.log('  ✅ Add/remove reserves (assets)');
    console.log('  ✅ Set collateral parameters');
    console.log('  ✅ Configure interest rate strategies');
    console.log('  ✅ Enable/disable borrowing');
    console.log('');
    console.log('🚀 Next: Run CORE Phase 6 (Protocol Configuration)');
    console.log('📋 Phase 6 will initialize USDT and wA7A5 reserves');
    console.log('');
    console.log('🎯 CORE Progress: Phase 5.1/6 ✅');
}

// Run
grantRoles().catch((error) => {
    console.error('\n❌ CORE Phase 5.1 failed:');
    console.error(error);
    process.exit(1);
});
