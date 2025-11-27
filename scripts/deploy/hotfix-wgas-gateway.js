const { ethers } = require('ethers');
const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');
const os = require('os');

// HOTFIX: Deploy WrappedTokenGatewayV3 with WGAS for NEO X
// This hotfix deploys the WGAS Gateway that was skipped in Phase 5 due to GitHub Actions job isolation

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
async function verifyViaStandardInput(contractAddress, contractName, contractPath, verifierBaseUrl, constructorArgs = []) {
    console.log(`   🔄 Verifying via Standard Input API...`);

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

        let curlCmd = `curl -s -L -X POST "${apiUrl}" \
            --form 'compiler_version=v0.8.27+commit.40a35a09' \
            --form 'contract_name=${contractName}' \
            --form 'license_type=none' \
            --form 'files[0]=@${tempFile};filename=input.json;type=application/json'`;

        // Add constructor args
        if (constructorArgs && constructorArgs.length > 0) {
            const abiCoder = new ethers.AbiCoder();
            // WrappedTokenGatewayV3 constructor: (address weth, address owner, address pool)
            const encodedArgs = abiCoder.encode(['address', 'address', 'address'], constructorArgs);
            const argsHex = encodedArgs.slice(2);
            curlCmd += ` --form 'constructor_args=${argsHex}'`;
        }

        const result = execSync(curlCmd, { encoding: 'utf8', timeout: 60000 });

        // Cleanup temp file
        try { fs.unlinkSync(tempFile); } catch (e) {}

        const response = JSON.parse(result);
        if (response.message === "Smart-contract verification started") {
            console.log(`   📤 Verification started successfully`);
            return true;
        } else {
            console.log(`   ⚠️ API response: ${result.substring(0, 100)}`);
            return false;
        }
    } catch (error) {
        console.log(`   ⚠️ Standard Input verification failed: ${error.message?.substring(0, 80) || 'unknown'}`);
        return false;
    }
}

/**
 * Checks verification status of contract
 */
async function checkVerificationStatus(contractAddress, expectedName, verifierBaseUrl) {
    try {
        const checkUrl = `${verifierBaseUrl}/api/v2/smart-contracts/${contractAddress}`;
        const result = execSync(`curl -s "${checkUrl}"`, { encoding: 'utf8' });
        const contractInfo = JSON.parse(result);

        return {
            isVerified: contractInfo.is_verified === true,
            isPartiallyVerified: contractInfo.is_partially_verified === true,
            name: contractInfo.name,
            nameMatches: contractInfo.name === expectedName
        };
    } catch (error) {
        return { isVerified: false, isPartiallyVerified: false, name: null, nameMatches: false };
    }
}

async function deployWgasGateway() {
    console.log('🔧 HOTFIX: Deploy WrappedTokenGatewayV3 with WGAS');
    console.log('================================================');
    console.log('📋 This hotfix deploys the WGAS Gateway that was skipped in Phase 5');
    console.log('🎯 Reason: GitHub Actions job isolation - WGAS address not synced\n');

    // Network detection
    const network = process.env.NETWORK || 'neox-testnet';
    const isNeoX = network.includes('neox');
    const rpcUrl = process.env.RPC_URL_SEPOLIA;

    console.log(`🌐 Network: ${network}`);
    console.log(`📡 RPC URL: ${rpcUrl}`);

    if (!rpcUrl) {
        console.error('❌ RPC_URL_SEPOLIA environment variable is not set!');
        process.exit(1);
    }

    // Validate network
    if (!isNeoX) {
        console.error('❌ This hotfix is only for NEO X networks!');
        console.error('   For Ethereum networks, WETH is already available.');
        process.exit(1);
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);

    console.log('📋 Deployer:', wallet.address);
    const balance = await provider.getBalance(wallet.address);
    console.log('💰 Balance:', ethers.formatEther(balance), 'GAS');

    // Blockscout URLs for NEO X
    const verifierBaseUrl = network === 'neox-mainnet'
        ? 'https://xexplorer.neo.org'
        : 'https://xt4scan.ngd.network';

    console.log(`🔍 Verifier: ${verifierBaseUrl}`);
    console.log('⚡ Using legacy transactions for NEO X\n');

    // Load deployments
    if (!fs.existsSync('deployments/all-contracts.json')) {
        console.error('❌ deployments/all-contracts.json not found!');
        console.error('   Please run Phase 1-5 first.');
        process.exit(1);
    }

    const deployments = JSON.parse(fs.readFileSync('deployments/all-contracts.json', 'utf8'));

    // Verify required contracts exist
    if (!deployments.contracts.Pool) {
        console.error('❌ Pool address not found in deployments!');
        process.exit(1);
    }

    // Get WGAS address - this is the key reason for this hotfix
    let wgasAddress = null;
    if (deployments.tokens && deployments.tokens.WGAS) {
        wgasAddress = deployments.tokens.WGAS;
        console.log(`✅ Found WGAS from deployments: ${wgasAddress}`);
    } else {
        console.error('❌ WGAS not found in deployments!');
        console.error('   Please run Phase 3.2 first to deploy WGAS.');
        process.exit(1);
    }

    // Check if WrappedTokenGatewayV3 already deployed
    if (deployments.contracts.WrappedTokenGatewayV3) {
        console.log(`⚠️  WrappedTokenGatewayV3 already deployed at: ${deployments.contracts.WrappedTokenGatewayV3}`);
        console.log(`   Use FORCE_REDEPLOY=true to override.`);

        if (process.env.FORCE_REDEPLOY !== 'true') {
            console.log('\n✅ Hotfix not needed - gateway already deployed!');
            process.exit(0);
        }
    }

    // Contract configuration
    const contractConfig = {
        name: 'WrappedTokenGatewayV3',
        path: 'contracts/aave-v3-origin/src/contracts/helpers/WrappedTokenGatewayV3.sol',
        description: 'Gateway for native GAS deposits/withdraws (wraps to WGAS)',
        constructor: [
            wgasAddress,           // WGAS address
            wallet.address,        // owner
            deployments.contracts.Pool  // Pool address
        ]
    };

    console.log('\n📋 Contract Configuration:');
    console.log(`   Name: ${contractConfig.name}`);
    console.log(`   Description: ${contractConfig.description}`);
    console.log(`   WGAS: ${contractConfig.constructor[0]}`);
    console.log(`   Owner: ${contractConfig.constructor[1]}`);
    console.log(`   Pool: ${contractConfig.constructor[2]}`);

    // Check balance
    const currentBalance = await provider.getBalance(wallet.address);
    const balanceInEth = parseFloat(ethers.formatEther(currentBalance));
    console.log(`\n💰 Current balance: ${balanceInEth.toFixed(6)} GAS`);

    if (balanceInEth < 0.01) {
        console.error(`❌ Insufficient balance! Need at least 0.01 GAS`);
        console.error(`💡 Please fund address: ${wallet.address}`);
        process.exit(1);
    }

    // Check contract file exists
    if (!fs.existsSync(contractConfig.path)) {
        console.error(`❌ Contract file not found: ${contractConfig.path}`);
        process.exit(1);
    }

    console.log('\n🚀 Deploying WrappedTokenGatewayV3...');

    try {
        const contractForFoundry = contractConfig.path + ':' + contractConfig.name;
        const constructorArgs = contractConfig.constructor;

        // Build forge command - NEO X requires --legacy
        let foundryCommand = `forge create "${contractForFoundry}" --private-key ${process.env.DEPLOYER_PRIVATE_KEY} --rpc-url ${process.env.RPC_URL_SEPOLIA} --legacy --broadcast --json --use 0.8.27`;

        // Add constructor args
        if (constructorArgs.length > 0) {
            foundryCommand += ` --constructor-args ${constructorArgs.join(' ')}`;
        }

        console.log(`📋 Constructor args: [${constructorArgs.join(', ')}]`);

        // Deploy
        let foundryOutput;
        try {
            const debugCommand = foundryCommand.replace(/--private-key\s+\S+/, '--private-key ***');
            console.log(`   📋 Command: ${debugCommand.substring(0, 200)}...`);

            foundryOutput = execSync(foundryCommand, {
                encoding: 'utf8',
                stdio: 'pipe',
                maxBuffer: 50 * 1024 * 1024,
                timeout: 600000
            });
            console.log('   📥 Deployed successfully');
        } catch (execError) {
            console.log('   ⚠️ Forge command exited with error, checking if deployment succeeded...');
            foundryOutput = execError.stdout ? execError.stdout.toString() : '';
            const stderrStr = execError.stderr ? execError.stderr.toString() : '';
            if (stderrStr) {
                console.log(`   📥 Forge stderr: ${stderrStr.substring(0, 300)}`);
            }
            if (stderrStr.includes('Compiler run failed')) {
                console.error(`   ❌ Compilation error detected`);
                throw execError;
            }
        }

        // Parse address from JSON
        let contractAddress = null;
        try {
            const jsonMatch = foundryOutput.match(/\{[^}]*"deployedTo"[^}]*\}/);
            if (jsonMatch) {
                const jsonOutput = JSON.parse(jsonMatch[0]);
                if (jsonOutput.deployedTo) {
                    contractAddress = jsonOutput.deployedTo;
                    console.log('   ✅ Deployed to:', contractAddress);
                }
            }
        } catch (e) {
            const addressMatch = foundryOutput.match(/Deployed to: (0x[a-fA-F0-9]{40})/);
            if (addressMatch) {
                contractAddress = addressMatch[1];
                console.log('   ✅ Found address via regex:', contractAddress);
            }
        }

        if (!contractAddress || contractAddress === '0x0000000000000000000000000000000000000000') {
            console.error(`❌ Could not parse deployment address`);
            console.error('Full output:', foundryOutput);
            process.exit(1);
        }

        // Verify deployment on-chain
        console.log('   🔍 Verifying contract deployment...');
        try {
            const checkCommand = `cast code ${contractAddress} --rpc-url ${process.env.RPC_URL_SEPOLIA}`;
            const code = execSync(checkCommand, { stdio: 'pipe', encoding: 'utf8' }).trim();

            if (code === '0x' || code.length <= 4) {
                console.log('   ⏳ Waiting for blockchain sync...');
                await new Promise(resolve => setTimeout(resolve, 15000));

                const codeRetry = execSync(checkCommand, { stdio: 'pipe', encoding: 'utf8' }).trim();
                if (codeRetry === '0x' || codeRetry.length <= 4) {
                    throw new Error('Contract deployment failed - no code at address');
                }
                console.log('   ✅ Contract code found after retry');
            } else {
                console.log('   ✅ Contract code verified on-chain');
            }
        } catch (verifyError) {
            console.log(`   ⚠️ Code verification issue: ${verifyError.message}`);
        }

        // Verification via Standard Input API for NEO X
        console.log(`   🔍 Starting verification via Standard Input API...`);

        await new Promise(resolve => setTimeout(resolve, 15000));

        await verifyViaStandardInput(contractAddress, contractConfig.name, contractConfig.path, verifierBaseUrl, constructorArgs);

        await new Promise(resolve => setTimeout(resolve, 20000));

        const status = await checkVerificationStatus(contractAddress, contractConfig.name, verifierBaseUrl);
        if (status.isVerified) {
            console.log(`   ✅ Verified as ${status.name}`);
        } else if (status.isPartiallyVerified) {
            console.log(`   ⚠️ Partially verified (bytecodeHash: none is expected for Aave v3.5)`);
        } else {
            console.log(`   ⚠️ Verification may need manual check at ${verifierBaseUrl}`);
        }

        // Save deployment
        deployments.contracts.WrappedTokenGatewayV3 = contractAddress;
        deployments.timestamp = new Date().toISOString();
        fs.writeFileSync('deployments/all-contracts.json', JSON.stringify(deployments, null, 2));

        console.log('\n🎉 HOTFIX COMPLETE!');
        console.log('==================');
        console.log(`✅ WrappedTokenGatewayV3: ${contractAddress}`);
        console.log(`⚡ Gateway ready for native GAS deposits/withdrawals`);
        console.log(`\n🔗 View on Blockscout: ${verifierBaseUrl}/address/${contractAddress}`);
        console.log('\n💾 Saved to deployments/all-contracts.json');

    } catch (error) {
        console.error(`\n❌ HOTFIX FAILED:`, error.message);
        if (error.stdout) {
            console.log('📤 Foundry stdout:', error.stdout.toString().substring(0, 500));
        }
        if (error.stderr) {
            console.log('📥 Foundry stderr:', error.stderr.toString().substring(0, 500));
        }
        process.exit(1);
    }
}

// Run
deployWgasGateway().catch((error) => {
    console.error('\n❌ Hotfix failed:', error);
    process.exit(1);
});
