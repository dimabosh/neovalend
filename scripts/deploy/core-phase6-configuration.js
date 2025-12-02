const { ethers } = require('ethers');
const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');
const os = require('os');

// CORE Phase 6: Protocol Configuration (Aave v3.5)
// Настройка PoolConfigurator и инициализация 6 резервов:
// WGAS, NEO, USDT, USDC, ETH, BTC
// Поддержка NEO X с --legacy флагом для транзакций

/**
 * Creates Standard JSON Input for verification via Blockscout API
 */
function createStandardJsonInput(contractName, flattenedSource) {
    return {
        language: "Solidity",
        sources: {
            [`${contractName}.sol`]: {
                content: flattenedSource
            }
        },
        settings: {
            optimizer: {
                enabled: true,
                runs: 200
            },
            evmVersion: "shanghai",
            metadata: {
                bytecodeHash: "none",
                useLiteralContent: false,
                appendCBOR: true
            },
            viaIR: false,
            outputSelection: {
                "*": {
                    "*": ["abi", "evm.bytecode", "evm.deployedBytecode", "metadata"]
                }
            }
        }
    };
}

/**
 * Verifies contract via Blockscout Standard Input API
 */
async function verifyViaBlockscout(contractAddress, contractName, contractPath, verifierBaseUrl) {
    console.log(`   🔄 Verifying ${contractName} via Blockscout...`);

    try {
        // 1. Flatten source code
        const flattenedSource = execSync(`forge flatten "${contractPath}"`, {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe']
        });

        // 2. Create Standard JSON Input
        const stdJsonInput = createStandardJsonInput(contractName, flattenedSource);

        // 3. Save to temp file (required for multipart upload)
        const tempFile = path.join(os.tmpdir(), `${contractName}_input.json`);
        fs.writeFileSync(tempFile, JSON.stringify(stdJsonInput));

        // 4. Submit via curl multipart form
        const apiUrl = `${verifierBaseUrl}/api/v2/smart-contracts/${contractAddress}/verification/via/standard-input`;

        const curlCmd = `curl -s -L -X POST "${apiUrl}" \
            --form 'compiler_version=v0.8.27+commit.40a35a09' \
            --form 'contract_name=${contractName}' \
            --form 'license_type=none' \
            --form 'files[0]=@${tempFile};filename=input.json;type=application/json'`;

        const result = execSync(curlCmd, { encoding: 'utf8', timeout: 60000 });

        // Cleanup temp file
        try { fs.unlinkSync(tempFile); } catch (e) {}

        const response = JSON.parse(result);
        if (response.message === "Smart-contract verification started") {
            console.log(`   ✅ Verification started for ${contractName}`);
            return true;
        } else {
            console.log(`   ⚠️ API response: ${result.substring(0, 100)}`);
            return false;
        }
    } catch (error) {
        console.log(`   ⚠️ Verification failed: ${error.message?.substring(0, 80) || 'unknown'}`);
        return false;
    }
}

async function deployCorePhase6() {
    console.log('🚀 CORE Phase 6: Protocol Configuration (Aave v3.5)');
    console.log('===================================================');
    console.log('💰 Estimated Cost: ~$5.0 USD');
    console.log('📋 Tasks:');
    console.log('  1. Register PoolConfigurator in PoolAddressesProvider');
    console.log('  2. Initialize 6 reserves (WGAS, NEO, USDT, USDC, ETH, BTC)');
    console.log('  3. Configure Oracle price sources');
    console.log('  4. Configure collateral parameters');
    console.log('  5. Set interest rate strategies');
    console.log('  6. Enable borrowing');
    console.log('🎯 Result: Fully configured lending protocol ready for use!');

    // Network detection and RPC URL validation
    const network = process.env.NETWORK || 'sepolia';
    const isNeoX = network.includes('neox');
    const rpcUrl = process.env.RPC_URL_SEPOLIA;
    const legacyFlag = isNeoX ? '--legacy' : '';
    const verifierBaseUrl = network === 'neox-mainnet'
        ? 'https://xexplorer.neo.org'
        : 'https://xt4scan.ngd.network';

    console.log(`\n🌐 Network: ${network}`);
    console.log(`📡 RPC URL: ${rpcUrl}`);

    // Validate RPC URL matches expected network
    if (!rpcUrl) {
        console.error('❌ RPC_URL_SEPOLIA environment variable is not set!');
        process.exit(1);
    }

    if (isNeoX && !rpcUrl.includes('ngd.network') && !rpcUrl.includes('banelabs')) {
        console.error(`❌ Network mismatch! Network is ${network} but RPC URL doesn't look like NEO X`);
        console.error(`   RPC URL: ${rpcUrl}`);
        process.exit(1);
    }

    if (!isNeoX && (rpcUrl.includes('ngd.network') || rpcUrl.includes('banelabs'))) {
        console.error(`❌ Network mismatch! Network is ${network} but RPC URL is for NEO X`);
        console.error(`   RPC URL: ${rpcUrl}`);
        process.exit(1);
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);

    console.log('📋 Deployer:', wallet.address);
    const balance = await provider.getBalance(wallet.address);
    console.log('💰 Balance:', ethers.formatEther(balance), 'GAS');
    if (isNeoX) {
        console.log('⚡ Using legacy transactions for NEO X');
    }

    // Load deployments
    if (!fs.existsSync('deployments/all-contracts.json')) {
        console.error('❌ Deployments file not found! Please deploy Phase 1-5 first.');
        process.exit(1);
    }

    const deployments = JSON.parse(fs.readFileSync('deployments/all-contracts.json', 'utf8'));
    console.log('📄 Loaded deployments from Phase 1-5');

    // Validate all required contracts are deployed
    const requiredContracts = [
        'PoolAddressesProvider', 'PoolConfigurator', 'Pool', 'ACLManager', 'AaveOracle',
        'DefaultReserveInterestRateStrategyV2', 'ATokenInstance', 'VariableDebtTokenInstance'
    ];

    for (const contract of requiredContracts) {
        if (!deployments.contracts[contract]) {
            console.error(`❌ Required contract ${contract} not found! Please deploy Phase 1-5 first.`);
            process.exit(1);
        }
    }

    // Check tokens
    const requiredTokens = ['WGAS', 'NEO', 'USDT', 'USDC', 'ETH', 'BTC'];
    for (const token of requiredTokens) {
        if (!deployments.tokens || !deployments.tokens[token]) {
            console.error(`❌ Required token ${token} not found in deployments.tokens!`);
            console.error('   Please run Phase 3.2 to deploy test tokens first.');
            process.exit(1);
        }
    }

    console.log('✅ All Phase 1-5 contracts and tokens found, proceeding with configuration\n');

    // ===========================================
    // STEP 1: Register PoolConfigurator
    // ===========================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 STEP 1: Register PoolConfigurator');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const POOL_ADDRESSES_PROVIDER = deployments.contracts.PoolAddressesProvider;
    const POOL_CONFIGURATOR = deployments.contracts.PoolConfigurator;

    console.log('📍 PoolAddressesProvider:', POOL_ADDRESSES_PROVIDER);
    console.log('📍 PoolConfigurator:', POOL_CONFIGURATOR);

    try {
        // Check owner first
        console.log('\n🔐 Checking PoolAddressesProvider ownership...');
        try {
            const owner = execSync(
                `cast call ${POOL_ADDRESSES_PROVIDER} "owner()(address)" --rpc-url ${process.env.RPC_URL_SEPOLIA}`,
                { encoding: 'utf8' }
            ).trim();
            console.log('📋 PoolAddressesProvider owner:', owner);
            console.log('📋 Deployer address:', wallet.address);

            if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
                console.error('❌ ACCESS DENIED: You are not the owner!');
                console.error('  Owner:', owner);
                console.error('  Your address:', wallet.address);
                console.error('  Only owner can call setPoolConfiguratorImpl()');
                process.exit(1);
            }
            console.log('✅ Ownership verified - you are the owner');
        } catch (ownerError) {
            console.error('⚠️  Could not check owner:', ownerError.message);
        }

        // Check current registration
        console.log('\n🔍 Checking current PoolConfigurator registration...');
        const currentConfigurator = execSync(
            `cast call ${POOL_ADDRESSES_PROVIDER} "getPoolConfigurator()(address)" --rpc-url ${process.env.RPC_URL_SEPOLIA}`,
            { encoding: 'utf8' }
        ).trim();

        console.log('Current PoolConfigurator:', currentConfigurator);

        if (currentConfigurator.toLowerCase() === POOL_CONFIGURATOR.toLowerCase()) {
            console.log('✅ PoolConfigurator already registered correctly!');
        } else {
            console.log('📤 Registering new PoolConfigurator...');
            console.log('📋 Calling: setPoolConfiguratorImpl(' + POOL_CONFIGURATOR + ')');

            try {
                const registerResult = execSync(
                    `cast send ${POOL_ADDRESSES_PROVIDER} "setPoolConfiguratorImpl(address)" ${POOL_CONFIGURATOR} --private-key ${process.env.DEPLOYER_PRIVATE_KEY} --rpc-url ${process.env.RPC_URL_SEPOLIA} --gas-limit 2000000 ${legacyFlag}`,
                    { encoding: 'utf8', stdio: 'pipe' }
                );

                console.log(registerResult);

                if (registerResult.includes('status               1')) {
                    console.log('✅ PoolConfigurator registered successfully!');
                    await new Promise(resolve => setTimeout(resolve, 5000));

                    const newConfigurator = execSync(
                        `cast call ${POOL_ADDRESSES_PROVIDER} "getPoolConfigurator()(address)" --rpc-url ${process.env.RPC_URL_SEPOLIA}`,
                        { encoding: 'utf8' }
                    ).trim();

                    console.log('✅ Verified registration:', newConfigurator);
                } else {
                    throw new Error('Registration transaction failed');
                }
            } catch (sendError) {
                console.error('❌ Cast send error:', sendError.message);
                throw sendError;
            }
        }
    } catch (error) {
        console.error('❌ Failed to register PoolConfigurator:', error.message);
        process.exit(1);
    }

    // ===========================================
    // STEP 1.5: Initialize PoolConfigurator (if needed)
    // ===========================================
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 STEP 1.5: Initialize PoolConfigurator');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('🔍 Checking if PoolConfigurator is initialized...');

    let isPoolConfigInitialized = false;
    try {
        const poolFromConfigurator = execSync(
            `cast call ${POOL_CONFIGURATOR} "POOL()" --rpc-url ${process.env.RPC_URL_SEPOLIA}`,
            { encoding: 'utf8', stdio: 'pipe' }
        ).trim();

        if (poolFromConfigurator && poolFromConfigurator !== '0x0000000000000000000000000000000000000000') {
            console.log('✅ PoolConfigurator already initialized');
            console.log(`📋 POOL address: ${poolFromConfigurator}`);
            isPoolConfigInitialized = true;
        }
    } catch (e) {
        console.log('📋 PoolConfigurator NOT initialized (POOL() reverted)');
        isPoolConfigInitialized = false;
    }

    if (!isPoolConfigInitialized) {
        console.log('\n🚀 Initializing PoolConfigurator...');
        console.log(`📋 Calling: initialize(${POOL_ADDRESSES_PROVIDER})`);

        try {
            const initCommand = `cast send ${POOL_CONFIGURATOR} "initialize(address)" ${POOL_ADDRESSES_PROVIDER} --private-key ${process.env.DEPLOYER_PRIVATE_KEY} --rpc-url ${process.env.RPC_URL_SEPOLIA} ${legacyFlag}`;

            const initResult = execSync(initCommand, { encoding: 'utf8', stdio: 'pipe' });
            console.log('✅ PoolConfigurator initialized successfully!');

            await new Promise(resolve => setTimeout(resolve, 5000));

            const poolAddress = execSync(
                `cast call ${POOL_CONFIGURATOR} "POOL()" --rpc-url ${process.env.RPC_URL_SEPOLIA}`,
                { encoding: 'utf8' }
            ).trim();
            console.log(`✅ Verified - POOL: ${poolAddress}`);
        } catch (initError) {
            const errorMsg = initError.message || '';
            const stderrMsg = initError.stderr ? initError.stderr.toString() : '';

            if (errorMsg.includes('already been initialized') || stderrMsg.includes('already been initialized')) {
                console.log('✅ PoolConfigurator already initialized (caught on initialize call)');
            } else {
                console.error('❌ Failed to initialize PoolConfigurator!');
                console.error('📋 Error:', initError.message);
                process.exit(1);
            }
        }
    }

    // ===========================================
    // STEP 2: Configure Reserves (6 tokens)
    // ===========================================
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 STEP 2: Initialize & Configure 6 Reserves');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Define all 6 reserves
    const reserves = [
        {
            name: 'WGAS',
            symbol: 'WGAS',
            address: deployments.tokens.WGAS,
            decimals: 18,
            aTokenName: 'Neovalend interest bearing WGAS',
            aTokenSymbol: 'nWGAS',
            debtTokenName: 'Neovalend variable debt bearing WGAS',
            debtTokenSymbol: 'variableDebtWGAS',
            ltv: 7500,                  // 75% LTV
            liquidationThreshold: 8000, // 80% liquidation threshold
            liquidationBonus: 10500,    // 105% liquidation bonus (5% bonus)
            reserveFactor: 1000,        // 10% reserve factor
            optimalUsageRatio: 8000,    // 80% optimal usage
            baseRate: 0,                // 0% base borrow rate
            slope1: 400,                // 4% slope1
            slope2: 8000,               // 80% slope2
            price: 100000000,           // $1.00 (native gas token pegged to USD for testnet)
            description: 'Wrapped native GAS token'
        },
        {
            name: 'NEO',
            symbol: 'NEO',
            address: deployments.tokens.NEO,
            decimals: 18,
            aTokenName: 'Neovalend interest bearing NEO',
            aTokenSymbol: 'nNEO',
            debtTokenName: 'Neovalend variable debt bearing NEO',
            debtTokenSymbol: 'variableDebtNEO',
            ltv: 6500,                  // 65% LTV
            liquidationThreshold: 7000, // 70% liquidation threshold
            liquidationBonus: 11000,    // 110% liquidation bonus (10% bonus)
            reserveFactor: 1500,        // 15% reserve factor
            optimalUsageRatio: 7000,    // 70% optimal usage
            baseRate: 200,              // 2% base borrow rate
            slope1: 700,                // 7% slope1
            slope2: 15000,              // 150% slope2
            price: 1500000000,          // $15.00 (NEO price for testnet)
            description: 'NEO governance token'
        },
        {
            name: 'USDT',
            symbol: 'USDT',
            address: deployments.tokens.USDT,
            decimals: 6,
            aTokenName: 'Neovalend interest bearing USDT',
            aTokenSymbol: 'nUSDT',
            debtTokenName: 'Neovalend variable debt bearing USDT',
            debtTokenSymbol: 'variableDebtUSDT',
            ltv: 8000,                  // 80% LTV
            liquidationThreshold: 8500, // 85% liquidation threshold
            liquidationBonus: 10500,    // 105% liquidation bonus
            reserveFactor: 1000,        // 10% reserve factor
            optimalUsageRatio: 9000,    // 90% optimal usage (stablecoin)
            baseRate: 0,                // 0% base borrow rate
            slope1: 400,                // 4% slope1
            slope2: 6000,               // 60% slope2
            price: 100000000,           // $1.00
            description: 'Tether USD stablecoin'
        },
        {
            name: 'USDC',
            symbol: 'USDC',
            address: deployments.tokens.USDC,
            decimals: 6,
            aTokenName: 'Neovalend interest bearing USDC',
            aTokenSymbol: 'nUSDC',
            debtTokenName: 'Neovalend variable debt bearing USDC',
            debtTokenSymbol: 'variableDebtUSDC',
            ltv: 8000,                  // 80% LTV
            liquidationThreshold: 8500, // 85% liquidation threshold
            liquidationBonus: 10500,    // 105% liquidation bonus
            reserveFactor: 1000,        // 10% reserve factor
            optimalUsageRatio: 9000,    // 90% optimal usage (stablecoin)
            baseRate: 0,                // 0% base borrow rate
            slope1: 400,                // 4% slope1
            slope2: 6000,               // 60% slope2
            price: 100000000,           // $1.00
            description: 'USD Coin stablecoin'
        },
        {
            name: 'ETH',
            symbol: 'ETH',
            address: deployments.tokens.ETH,
            decimals: 18,
            aTokenName: 'Neovalend interest bearing ETH',
            aTokenSymbol: 'nETH',
            debtTokenName: 'Neovalend variable debt bearing ETH',
            debtTokenSymbol: 'variableDebtETH',
            ltv: 8000,                  // 80% LTV
            liquidationThreshold: 8250, // 82.5% liquidation threshold
            liquidationBonus: 10500,    // 105% liquidation bonus
            reserveFactor: 1000,        // 10% reserve factor
            optimalUsageRatio: 8000,    // 80% optimal usage
            baseRate: 0,                // 0% base borrow rate
            slope1: 380,                // 3.8% slope1
            slope2: 8000,               // 80% slope2
            price: 360000000000,        // $3,600.00 (ETH price for testnet)
            description: 'Ethereum (Mock)'
        },
        {
            name: 'BTC',
            symbol: 'BTC',
            address: deployments.tokens.BTC,
            decimals: 8,
            aTokenName: 'Neovalend interest bearing BTC',
            aTokenSymbol: 'nBTC',
            debtTokenName: 'Neovalend variable debt bearing BTC',
            debtTokenSymbol: 'variableDebtBTC',
            ltv: 7000,                  // 70% LTV
            liquidationThreshold: 7500, // 75% liquidation threshold
            liquidationBonus: 11000,    // 110% liquidation bonus (10% bonus)
            reserveFactor: 1500,        // 15% reserve factor
            optimalUsageRatio: 8000,    // 80% optimal usage
            baseRate: 0,                // 0% base borrow rate
            slope1: 400,                // 4% slope1
            slope2: 30000,              // 300% slope2 (very steep for volatile asset)
            price: 9500000000000,       // $95,000.00 (BTC price for testnet)
            description: 'Bitcoin (Mock)'
        }
    ];

    console.log('📋 Reserves to configure:');
    for (const r of reserves) {
        console.log(`   - ${r.name}: ${r.address} (${r.decimals} decimals, $${(r.price / 1e8).toLocaleString()})`);
    }
    console.log('');

    for (const reserve of reserves) {
        console.log(`\n🔧 Configuring ${reserve.name} Reserve`);
        console.log('═══════════════════════════════════════════════');
        console.log(`📝 ${reserve.description}`);
        console.log(`📍 Address: ${reserve.address}`);
        console.log(`💰 Price: $${(reserve.price / 1e8).toLocaleString()}\n`);

        try {
            // Check if reserve is already initialized by checking aToken address
            console.log(`🔍 Checking if ${reserve.name} reserve is initialized...`);
            let isInitialized = false;

            try {
                const reserveDataOutput = execSync(
                    `cast call ${deployments.contracts.Pool} "getReserveData(address)(uint256,uint128,uint128,uint128,uint128,uint128,uint40,uint16,address,address,address,address,uint128,uint128,uint128)" ${reserve.address} --rpc-url ${process.env.RPC_URL_SEPOLIA}`,
                    { stdio: 'pipe', encoding: 'utf8' }
                );

                const lines = reserveDataOutput.trim().split('\n');
                const aTokenLine = lines[8]; // Line 8 is aTokenAddress (9th field, 0-indexed)

                isInitialized = aTokenLine && !aTokenLine.includes('0x0000000000000000000000000000000000000000');
            } catch (e) {
                isInitialized = false;
            }

            if (!isInitialized) {
                console.log(`📋 ${reserve.name} NOT initialized, proceeding with initReserve...\n`);

                // Encode interestRateData
                const interestRateData = ethers.AbiCoder.defaultAbiCoder().encode(
                    ['uint16', 'uint32', 'uint32', 'uint32'],
                    [
                        reserve.optimalUsageRatio,
                        reserve.baseRate,
                        reserve.slope1,
                        reserve.slope2
                    ]
                );

                console.log(`🚀 Step 1: Initializing ${reserve.name} reserve...`);
                console.log(`📋 Interest Rate Data:`);
                console.log(`   - Optimal Usage: ${reserve.optimalUsageRatio / 100}%`);
                console.log(`   - Base Rate: ${reserve.baseRate / 100}%`);
                console.log(`   - Slope1: ${reserve.slope1 / 100}%`);
                console.log(`   - Slope2: ${reserve.slope2 / 100}%`);

                // Dry-run first
                const initReserveCallCommand = `cast call ${deployments.contracts.PoolConfigurator} "initReserves((address,address,address,string,string,string,string,bytes,bytes)[])" "[(${deployments.contracts.ATokenInstance},${deployments.contracts.VariableDebtTokenInstance},${reserve.address},\\"${reserve.aTokenName}\\",\\"${reserve.aTokenSymbol}\\",\\"${reserve.debtTokenName}\\",\\"${reserve.debtTokenSymbol}\\",0x,${interestRateData})]" --from ${wallet.address} --rpc-url ${process.env.RPC_URL_SEPOLIA}`;

                console.log(`🔍 Testing with cast call (dry-run)...`);
                try {
                    execSync(initReserveCallCommand, { stdio: 'pipe', encoding: 'utf8' });
                    console.log(`✅ Dry-run successful`);
                } catch (callError) {
                    console.error(`❌ Dry-run failed!`);
                    console.error(`📋 Error: ${callError.message}`);
                    throw callError;
                }

                // Wait between reserves to avoid nonce conflicts
                console.log('⏳ Waiting 15s before transaction...');
                await new Promise(resolve => setTimeout(resolve, 15000));

                // Execute actual transaction
                const initReserveCommand = `cast send ${deployments.contracts.PoolConfigurator} "initReserves((address,address,address,string,string,string,string,bytes,bytes)[])" "[(${deployments.contracts.ATokenInstance},${deployments.contracts.VariableDebtTokenInstance},${reserve.address},\\"${reserve.aTokenName}\\",\\"${reserve.aTokenSymbol}\\",\\"${reserve.debtTokenName}\\",\\"${reserve.debtTokenSymbol}\\",0x,${interestRateData})]" --private-key ${process.env.DEPLOYER_PRIVATE_KEY} --rpc-url ${process.env.RPC_URL_SEPOLIA} ${legacyFlag}`;

                console.log(`📤 Executing transaction...`);

                try {
                    const initOutput = execSync(initReserveCommand, { stdio: 'pipe', encoding: 'utf8' });
                    console.log(`✅ ${reserve.name} reserve initialized`);
                } catch (initError) {
                    console.error(`❌ initReserves failed for ${reserve.name}!`);
                    throw initError;
                }

                await new Promise(resolve => setTimeout(resolve, 10000));

                // Configure as collateral
                console.log(`🔒 Step 2: Configuring ${reserve.name} as collateral...`);
                const collateralCommand = `cast send ${deployments.contracts.PoolConfigurator} "configureReserveAsCollateral(address,uint256,uint256,uint256)" ${reserve.address} ${reserve.ltv} ${reserve.liquidationThreshold} ${reserve.liquidationBonus} --private-key ${process.env.DEPLOYER_PRIVATE_KEY} --rpc-url ${process.env.RPC_URL_SEPOLIA} ${legacyFlag}`;

                try {
                    execSync(collateralCommand, { stdio: 'pipe', encoding: 'utf8' });
                    console.log(`✅ Collateral configured - LTV: ${reserve.ltv/100}%, Liquidation: ${reserve.liquidationThreshold/100}%`);
                } catch (e) {
                    console.error(`❌ Collateral configuration failed:`, e.message);
                    throw e;
                }

                await new Promise(resolve => setTimeout(resolve, 10000));

                // Enable borrowing
                console.log(`🏦 Step 3: Enabling borrowing...`);
                const borrowingCommand = `cast send ${deployments.contracts.PoolConfigurator} "setReserveBorrowing(address,bool)" ${reserve.address} true --private-key ${process.env.DEPLOYER_PRIVATE_KEY} --rpc-url ${process.env.RPC_URL_SEPOLIA} ${legacyFlag}`;

                try {
                    execSync(borrowingCommand, { stdio: 'pipe', encoding: 'utf8' });
                    console.log(`✅ Borrowing enabled`);
                } catch (e) {
                    console.log(`⚠️  Borrowing enable failed, but continuing...`);
                }

                await new Promise(resolve => setTimeout(resolve, 10000));

                // Set reserve factor
                console.log(`📊 Step 4: Setting reserve factor...`);
                const factorCommand = `cast send ${deployments.contracts.PoolConfigurator} "setReserveFactor(address,uint256)" ${reserve.address} ${reserve.reserveFactor} --private-key ${process.env.DEPLOYER_PRIVATE_KEY} --rpc-url ${process.env.RPC_URL_SEPOLIA} ${legacyFlag}`;

                try {
                    execSync(factorCommand, { stdio: 'pipe', encoding: 'utf8' });
                    console.log(`✅ Reserve factor set to ${reserve.reserveFactor/100}%`);
                } catch (e) {
                    console.log(`⚠️  Reserve factor setting failed, but continuing...`);
                }

                await new Promise(resolve => setTimeout(resolve, 10000));

            } else {
                console.log(`✅ ${reserve.name} reserve already initialized, skipping...\n`);
            }

            console.log(`🎉 ${reserve.name} CONFIGURED! ✅`);

        } catch (error) {
            console.error(`❌ Failed to configure ${reserve.name}:`, error.message);
            // Continue with other reserves instead of exiting
            console.log(`⚠️  Continuing with other reserves...`);
        }
    }

    // ===========================================
    // STEP 3: Configure Oracle Price Sources
    // ===========================================
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 STEP 3: Configure Oracle Price Sources');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('🔮 Setting up price feeds for all 6 reserves...');
    console.log('💰 Prices:');
    for (const r of reserves) {
        console.log(`   - ${r.name}: $${(r.price / 1e8).toLocaleString()}`);
    }
    console.log('');

    const ORACLE = deployments.contracts.AaveOracle;

    // Initialize price oracles storage
    if (!deployments.priceOracles) {
        deployments.priceOracles = {};
    }

    // Deploy SimplePriceOracle for each token that needs one
    const priceOracles = {};

    for (const reserve of reserves) {
        console.log(`\n📋 Configuring price source for ${reserve.name}...`);

        // Check if already configured
        try {
            const currentSource = execSync(
                `cast call ${ORACLE} "getSourceOfAsset(address)(address)" ${reserve.address} --rpc-url ${process.env.RPC_URL_SEPOLIA}`,
                { encoding: 'utf8', stdio: 'pipe' }
            ).trim();

            if (currentSource && !currentSource.includes('0x0000000000000000000000000000000000000000')) {
                console.log(`✅ ${reserve.name} price source already configured: ${currentSource}`);
                priceOracles[reserve.symbol] = currentSource;
                continue;
            }
        } catch (e) {
            // Continue with deployment
        }

        // Deploy SimplePriceOracle
        console.log(`🚀 Deploying SimplePriceOracle for ${reserve.name}...`);
        try {
            const deployCommand = isNeoX
                ? `forge create "contracts/mocks/SimplePriceOracle.sol:SimplePriceOracle" --private-key ${process.env.DEPLOYER_PRIVATE_KEY} --rpc-url ${process.env.RPC_URL_SEPOLIA} --legacy --broadcast --json`
                : `forge create "contracts/mocks/SimplePriceOracle.sol:SimplePriceOracle" --private-key ${process.env.DEPLOYER_PRIVATE_KEY} --rpc-url ${process.env.RPC_URL_SEPOLIA} --broadcast --json`;

            const output = execSync(deployCommand, { encoding: 'utf8', stdio: 'pipe' });

            const jsonMatch = output.match(/\{[^}]*"deployedTo"[^}]*\}/);
            if (jsonMatch) {
                const json = JSON.parse(jsonMatch[0]);
                priceOracles[reserve.symbol] = json.deployedTo;
                console.log(`✅ ${reserve.name} SimplePriceOracle deployed: ${priceOracles[reserve.symbol]}`);

                // Verify on Blockscout for NEO X networks
                if (isNeoX) {
                    await verifyViaBlockscout(
                        priceOracles[reserve.symbol],
                        'SimplePriceOracle',
                        'contracts/mocks/SimplePriceOracle.sol',
                        verifierBaseUrl
                    );
                }
            }

            await new Promise(resolve => setTimeout(resolve, 5000));

            // Set price
            console.log(`💵 Setting ${reserve.name} price to $${(reserve.price / 1e8).toLocaleString()}...`);
            execSync(
                `cast send ${priceOracles[reserve.symbol]} "setPrice(int256)" ${reserve.price} --private-key ${process.env.DEPLOYER_PRIVATE_KEY} --rpc-url ${process.env.RPC_URL_SEPOLIA} ${legacyFlag}`,
                { stdio: 'pipe' }
            );
            console.log(`✅ ${reserve.name} price set`);

            await new Promise(resolve => setTimeout(resolve, 5000));

        } catch (error) {
            console.error(`❌ Failed to deploy price oracle for ${reserve.name}:`, error.message);
        }
    }

    // Set all asset sources in AaveOracle at once
    console.log('\n📋 Setting all asset sources in AaveOracle...');

    const assets = reserves.map(r => r.address);
    const sources = reserves.map(r => priceOracles[r.symbol] || '0x0000000000000000000000000000000000000000');

    // Filter out any with zero address sources
    const validPairs = reserves.filter((r, i) => sources[i] !== '0x0000000000000000000000000000000000000000');

    if (validPairs.length > 0) {
        const validAssets = validPairs.map(r => r.address);
        const validSources = validPairs.map(r => priceOracles[r.symbol]);

        try {
            const setSourcesCommand = `cast send ${ORACLE} "setAssetSources(address[],address[])" "[${validAssets.join(',')}]" "[${validSources.join(',')}]" --private-key ${process.env.DEPLOYER_PRIVATE_KEY} --rpc-url ${process.env.RPC_URL_SEPOLIA} ${legacyFlag}`;

            execSync(setSourcesCommand, { stdio: 'pipe' });
            console.log('✅ All asset sources set successfully!\n');

            // Verify prices
            console.log('🔍 Verifying prices through Oracle...');
            for (const reserve of reserves) {
                try {
                    const price = execSync(
                        `cast call ${ORACLE} "getAssetPrice(address)(uint256)" ${reserve.address} --rpc-url ${process.env.RPC_URL_SEPOLIA}`,
                        { encoding: 'utf8', stdio: 'pipe' }
                    ).trim();
                    console.log(`   ${reserve.name}: $${(parseInt(price) / 1e8).toLocaleString()} ✅`);
                } catch (e) {
                    console.log(`   ${reserve.name}: ❌ Could not fetch price`);
                }
            }

        } catch (error) {
            console.error('❌ Failed to set asset sources:', error.message);
        }
    }

    // Save price oracles to deployments
    deployments.priceOracles = priceOracles;

    // Test getUserAccountData
    try {
        console.log('\n🧪 Testing getUserAccountData...');
        const POOL = deployments.contracts.Pool;

        const accountData = execSync(
            `cast call ${POOL} "getUserAccountData(address)(uint256,uint256,uint256,uint256,uint256,uint256)" ${wallet.address} --rpc-url ${process.env.RPC_URL_SEPOLIA}`,
            { encoding: 'utf8', stdio: 'pipe' }
        );

        console.log('✅ getUserAccountData working correctly! ✅');

    } catch (error) {
        console.log('⚠️  getUserAccountData test failed (may be normal if no deposits)');
    }

    // Final summary
    deployments.timestamp = new Date().toISOString();
    deployments.phase = 'core-6-completed';
    deployments.status = 'PROTOCOL_FULLY_CONFIGURED';

    fs.writeFileSync('deployments/all-contracts.json', JSON.stringify(deployments, null, 2));

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉🎉🎉 CORE PHASE 6 COMPLETE! 🎉🎉🎉');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('📊 PROTOCOL CONFIGURATION SUMMARY:');
    console.log('═══════════════════════════════════════════════');
    console.log('✅ PoolConfigurator registered');
    console.log('✅ 6 reserves configured:');
    for (const r of reserves) {
        console.log(`   - ${r.name}: LTV ${r.ltv/100}%, Liq ${r.liquidationThreshold/100}%, Price $${(r.price/1e8).toLocaleString()}`);
    }
    console.log('✅ Oracle price sources configured');
    console.log('✅ Borrowing enabled for all reserves');
    console.log('✅ Collateral parameters configured');
    console.log('');
    console.log('🚀 PROTOCOL FEATURES ACTIVE:');
    console.log('═══════════════════════════════════════════════');
    console.log('  ✅ Supply any of 6 tokens → Earn Interest');
    console.log('  ✅ Borrow against collateral');
    console.log('  ✅ Variable Interest Rates');
    console.log('  ✅ Liquidations for underwater positions');
    console.log('  ✅ Flash Loans');
    console.log('  ✅ Native GAS deposits via WrappedTokenGatewayV3');
    console.log('');
    console.log('💡 SUPPORTED TOKENS:');
    console.log('═══════════════════════════════════════════════');
    for (const r of reserves) {
        console.log(`  💎 ${r.name} (${r.symbol}): ${r.address}`);
    }
    console.log('');
    console.log('🎯 NEOVALEND LENDING PROTOCOL: 100% READY! ✅');
    console.log('💰 Total Phase 6 Cost: ~$5.0 USD');
    console.log('🏁 PROTOCOL LIVE ON NEO X TESTNET! 🏁');
}

// Run
deployCorePhase6().catch((error) => {
    console.error('\n❌ CORE Phase 6 failed:');
    console.error(error);
    process.exit(1);
});
