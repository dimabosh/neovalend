const { ethers } = require('ethers');
const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');
const os = require('os');

// CORE Phase 3.2: Test Tokens Deployment
// Деплой 5 тестовых токенов: NEO, USDT, USDC, BTC, ETH
// Верификация через Standard JSON Input API для NEO X / Blockscout

/**
 * Создаёт Standard JSON Input для верификации через Blockscout API
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
 * Верифицирует контракт через Blockscout Standard Input API
 */
async function verifyViaStandardInput(contractAddress, contractName, contractPath, verifierBaseUrl, constructorArgsHex = '') {
    console.log(`   🔄 Verifying via Standard Input API...`);

    try {
        // 1. Flatten source code
        const flattenedSource = execSync(`forge flatten "${contractPath}"`, {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe']
        });

        // 2. Create Standard JSON Input
        const stdJsonInput = createStandardJsonInput(contractName, flattenedSource);

        // 3. Save to temp file
        const tempFile = path.join(os.tmpdir(), `${contractName}_${Date.now()}_input.json`);
        fs.writeFileSync(tempFile, JSON.stringify(stdJsonInput));

        // 4. Submit via curl multipart form
        const apiUrl = `${verifierBaseUrl}/api/v2/smart-contracts/${contractAddress}/verification/via/standard-input`;

        let curlCmd = `curl -s -L -X POST "${apiUrl}" \
            --form 'compiler_version=v0.8.27+commit.40a35a09' \
            --form 'contract_name=${contractName}' \
            --form 'license_type=none' \
            --form 'files[0]=@${tempFile};filename=input.json;type=application/json'`;

        // Добавляем constructor args если есть
        if (constructorArgsHex) {
            curlCmd += ` --form 'constructor_args=${constructorArgsHex}'`;
        }

        const result = execSync(curlCmd, { encoding: 'utf8', timeout: 60000 });

        // Cleanup
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
 * Проверяет статус верификации контракта
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

async function deployTestTokens() {
    console.log('🚀 CORE Phase 3.2: Test Tokens Deployment');
    console.log('=========================================');
    console.log('📋 Deploying 5 test tokens: NEO, USDT, USDC, BTC, ETH');
    console.log('🔧 Verification: Standard JSON Input API for NEO X\n');

    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL_SEPOLIA);
    const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);

    console.log('📋 Deployer:', wallet.address);
    const balance = await provider.getBalance(wallet.address);
    console.log('💰 Balance:', ethers.formatEther(balance), 'GAS');

    // Network detection
    const network = process.env.NETWORK || 'sepolia';
    const isNeoX = network.includes('neox');

    // Blockscout URLs for NEO X
    const verifierBaseUrl = network === 'neox-mainnet'
        ? 'https://xexplorer.neo.org'
        : 'https://xt4scan.ngd.network';

    console.log(`🌐 Network: ${network}`);
    console.log(`🔧 isNeoX: ${isNeoX}`);
    if (isNeoX) {
        console.log(`🔍 Verifier: ${verifierBaseUrl}`);
        console.log('⚡ Using legacy transactions for NEO X');
    }
    console.log('');

    // Load deployments
    if (!fs.existsSync('deployments/all-contracts.json')) {
        console.error('❌ deployments/all-contracts.json not found!');
        process.exit(1);
    }

    const deployments = JSON.parse(fs.readFileSync('deployments/all-contracts.json', 'utf8'));

    // Initialize tokens object if not exists
    if (!deployments.tokens) {
        deployments.tokens = {};
    }

    // Token configurations
    // NEO, USDC, USDT - 100M supply
    // ETH, BTC - 10M supply
    const tokens = [
        {
            name: 'Mock NEO',
            symbol: 'NEO',
            decimals: 18,
            supply: ethers.parseUnits('100000000', 18), // 100M
            supplyFormatted: '100,000,000'
        },
        {
            name: 'Mock USDT',
            symbol: 'USDT',
            decimals: 6,  // USDT has 6 decimals
            supply: ethers.parseUnits('100000000', 6), // 100M
            supplyFormatted: '100,000,000'
        },
        {
            name: 'Mock USDC',
            symbol: 'USDC',
            decimals: 6,  // USDC has 6 decimals
            supply: ethers.parseUnits('100000000', 6), // 100M
            supplyFormatted: '100,000,000'
        },
        {
            name: 'Mock Bitcoin',
            symbol: 'BTC',
            decimals: 8,  // BTC has 8 decimals
            supply: ethers.parseUnits('10000000', 8), // 10M
            supplyFormatted: '10,000,000'
        },
        {
            name: 'Mock Ethereum',
            symbol: 'ETH',
            decimals: 18,
            supply: ethers.parseUnits('10000000', 18), // 10M
            supplyFormatted: '10,000,000'
        }
    ];

    // WGAS - special WETH9-style contract for wrapping native GAS token
    // Deployed separately because it has different constructor pattern
    const wgasConfig = {
        name: 'WGAS',
        path: 'contracts/mocks/WGAS.sol',
        description: 'Wrapped GAS (WETH9-style) for native token deposits/withdrawals'
    };

    const contractPath = 'contracts/mocks/MockERC20.sol';
    const contractName = 'MockERC20';
    const contractForFoundry = `${contractPath}:${contractName}`;

    // Smart deployment mode
    const forceRedeploy = process.env.FORCE_REDEPLOY === 'true';
    if (forceRedeploy) {
        console.log('🔥 Force redeploy mode: will redeploy all tokens');
    } else {
        console.log('🔄 Smart mode: will skip already deployed tokens');
    }

    // Компиляция один раз в начале
    console.log('\n🔨 Compiling contracts...');
    try {
        execSync(`forge build --use 0.8.27`, { stdio: 'pipe' });
        console.log('✅ Compilation successful!\n');
    } catch (buildError) {
        console.error('❌ Compilation failed!');
        if (buildError.stderr) console.error(buildError.stderr.toString());
        process.exit(1);
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🪙 DEPLOYING TEST TOKENS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    for (const token of tokens) {
        console.log(`\n🔍 Processing ${token.symbol}...`);
        console.log(`   📋 Name: ${token.name}`);
        console.log(`   📋 Decimals: ${token.decimals}`);
        console.log(`   📋 Supply: ${token.supplyFormatted}`);

        // Check if already deployed
        if (!forceRedeploy && deployments.tokens[token.symbol]) {
            console.log(`   ✅ ${token.symbol} already deployed at: ${deployments.tokens[token.symbol]}`);
            console.log(`   ⏭️  Skipping (use FORCE_REDEPLOY=true to override)`);
            continue;
        }

        console.log(`   🚀 Deploying ${token.symbol}...`);

        try {
            // Constructor args: name, symbol, decimals, initialSupply
            const constructorArgs = [
                `"${token.name}"`,
                `"${token.symbol}"`,
                token.decimals.toString(),
                token.supply.toString()
            ];

            // Build forge command
            let foundryCommand;
            if (isNeoX) {
                // NEO X: --legacy, no --verify (will verify via API)
                foundryCommand = `forge create "${contractForFoundry}" --private-key ${process.env.DEPLOYER_PRIVATE_KEY} --rpc-url ${process.env.RPC_URL_SEPOLIA} --legacy --broadcast --json --use 0.8.27 --constructor-args ${constructorArgs.join(' ')}`;
            } else {
                // Ethereum: with --verify
                foundryCommand = `forge create "${contractForFoundry}" --private-key ${process.env.DEPLOYER_PRIVATE_KEY} --rpc-url ${process.env.RPC_URL_SEPOLIA} --verify --etherscan-api-key ${process.env.ETHERSCAN_API_KEY} --broadcast --json --use 0.8.27 --constructor-args ${constructorArgs.join(' ')}`;
            }

            // Deploy
            let output;
            try {
                output = execSync(foundryCommand, {
                    encoding: 'utf8',
                    stdio: 'pipe',
                    maxBuffer: 50 * 1024 * 1024,
                    timeout: 180000
                });
                console.log(`   📥 Deployed successfully`);
            } catch (execError) {
                console.log(`   ⚠️ Forge exited with error, checking if deployment succeeded...`);
                output = execError.stdout ? execError.stdout.toString() : '';
                if (execError.stderr) {
                    console.log(`   📥 stderr: ${execError.stderr.toString().substring(0, 200)}`);
                }
            }

            // Parse address
            let tokenAddress = null;
            try {
                const jsonMatch = output.match(/\{[^}]*"deployedTo"[^}]*\}/);
                if (jsonMatch) {
                    const jsonOutput = JSON.parse(jsonMatch[0]);
                    tokenAddress = jsonOutput.deployedTo;
                }
            } catch (e) {
                const addressMatch = output.match(/Deployed to: (0x[a-fA-F0-9]{40})/);
                if (addressMatch) {
                    tokenAddress = addressMatch[1];
                }
            }

            if (!tokenAddress || tokenAddress === '0x0000000000000000000000000000000000000000') {
                console.error(`   ❌ Could not parse deployment address for ${token.symbol}`);
                continue;
            }

            // Verify code exists
            console.log(`   🔍 Verifying deployment...`);
            try {
                const checkCommand = `cast code ${tokenAddress} --rpc-url ${process.env.RPC_URL_SEPOLIA}`;
                const code = execSync(checkCommand, { stdio: 'pipe', encoding: 'utf8' }).trim();

                if (code === '0x' || code.length <= 4) {
                    console.log(`   ⏳ Waiting for blockchain sync...`);
                    await new Promise(resolve => setTimeout(resolve, 10000));

                    const codeRetry = execSync(checkCommand, { stdio: 'pipe', encoding: 'utf8' }).trim();
                    if (codeRetry === '0x' || codeRetry.length <= 4) {
                        throw new Error('No code at address');
                    }
                }
                console.log(`   ✅ Contract code verified on-chain`);
            } catch (verifyError) {
                console.log(`   ⚠️ Code verification issue: ${verifyError.message}`);
            }

            console.log(`   ✅ ${token.symbol}: ${tokenAddress}`);

            // Verify via Blockscout API for NEO X
            if (isNeoX) {
                console.log(`   🔍 Starting verification via Standard Input API...`);

                // Wait for indexing
                await new Promise(resolve => setTimeout(resolve, 15000));

                // Encode constructor args for verification
                const abiCoder = new ethers.AbiCoder();
                const encodedArgs = abiCoder.encode(
                    ['string', 'string', 'uint8', 'uint256'],
                    [token.name, token.symbol, token.decimals, token.supply]
                );
                const constructorArgsHex = encodedArgs.slice(2); // Remove 0x

                await verifyViaStandardInput(tokenAddress, contractName, contractPath, verifierBaseUrl, constructorArgsHex);

                // Wait and check
                await new Promise(resolve => setTimeout(resolve, 20000));

                let verified = false;
                for (let attempt = 1; attempt <= 2; attempt++) {
                    const status = await checkVerificationStatus(tokenAddress, contractName, verifierBaseUrl);

                    if (status.isVerified || status.isPartiallyVerified) {
                        console.log(`   ✅ Verified${status.isPartiallyVerified ? ' (partial)' : ''}`);
                        verified = true;
                        break;
                    } else {
                        console.log(`   ⏳ Not verified yet (attempt ${attempt}/2)`);
                        if (attempt < 2) {
                            await verifyViaStandardInput(tokenAddress, contractName, contractPath, verifierBaseUrl, constructorArgsHex);
                            await new Promise(resolve => setTimeout(resolve, 15000));
                        }
                    }
                }

                if (!verified) {
                    console.log(`   ⚠️ Verification may need manual check`);
                }
            }

            // Save to deployments
            deployments.tokens[token.symbol] = tokenAddress;
            deployments.timestamp = new Date().toISOString();
            fs.writeFileSync('deployments/all-contracts.json', JSON.stringify(deployments, null, 2));
            console.log(`   💾 Saved to deployments`);

        } catch (error) {
            console.error(`   ❌ Failed to deploy ${token.symbol}:`, error.message);
            continue;
        }

        // Delay between deployments
        console.log(`   ⏳ Waiting 5s before next token...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
    }

    // ===========================================
    // DEPLOY WGAS (WETH9-style wrapper)
    // ===========================================
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔥 DEPLOYING WGAS (Wrapped GAS)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log(`📋 ${wgasConfig.description}`);
    console.log(`📋 No constructor arguments (WETH9-style)`);

    // Check if already deployed
    if (!forceRedeploy && deployments.tokens && deployments.tokens.WGAS) {
        console.log(`✅ WGAS already deployed at: ${deployments.tokens.WGAS}`);
        console.log(`⏭️  Skipping (use FORCE_REDEPLOY=true to override)`);
    } else {
        console.log(`🚀 Deploying WGAS...`);

        try {
            const wgasContractPath = `${wgasConfig.path}:${wgasConfig.name}`;

            // Build forge command - WGAS has NO constructor arguments
            let wgasCommand;
            if (isNeoX) {
                // NEO X: --legacy, no --verify (will verify via API)
                wgasCommand = `forge create "${wgasContractPath}" --private-key ${process.env.DEPLOYER_PRIVATE_KEY} --rpc-url ${process.env.RPC_URL_SEPOLIA} --legacy --broadcast --json --use 0.8.27`;
            } else {
                // Ethereum: with --verify
                wgasCommand = `forge create "${wgasContractPath}" --private-key ${process.env.DEPLOYER_PRIVATE_KEY} --rpc-url ${process.env.RPC_URL_SEPOLIA} --verify --etherscan-api-key ${process.env.ETHERSCAN_API_KEY} --broadcast --json --use 0.8.27`;
            }

            // Deploy
            let wgasOutput;
            try {
                wgasOutput = execSync(wgasCommand, {
                    encoding: 'utf8',
                    stdio: 'pipe',
                    maxBuffer: 50 * 1024 * 1024,
                    timeout: 180000
                });
                console.log(`   📥 Deployed successfully`);
            } catch (execError) {
                console.log(`   ⚠️ Forge exited with error, checking if deployment succeeded...`);
                wgasOutput = execError.stdout ? execError.stdout.toString() : '';
                if (execError.stderr) {
                    console.log(`   📥 stderr: ${execError.stderr.toString().substring(0, 200)}`);
                }
            }

            // Parse address
            let wgasAddress = null;
            try {
                const jsonMatch = wgasOutput.match(/\{[^}]*"deployedTo"[^}]*\}/);
                if (jsonMatch) {
                    const jsonOutput = JSON.parse(jsonMatch[0]);
                    wgasAddress = jsonOutput.deployedTo;
                }
            } catch (e) {
                const addressMatch = wgasOutput.match(/Deployed to: (0x[a-fA-F0-9]{40})/);
                if (addressMatch) {
                    wgasAddress = addressMatch[1];
                }
            }

            if (!wgasAddress || wgasAddress === '0x0000000000000000000000000000000000000000') {
                console.error(`   ❌ Could not parse WGAS deployment address`);
            } else {
                // Verify code exists
                console.log(`   🔍 Verifying deployment...`);
                try {
                    const checkCommand = `cast code ${wgasAddress} --rpc-url ${process.env.RPC_URL_SEPOLIA}`;
                    const code = execSync(checkCommand, { stdio: 'pipe', encoding: 'utf8' }).trim();

                    if (code === '0x' || code.length <= 4) {
                        console.log(`   ⏳ Waiting for blockchain sync...`);
                        await new Promise(resolve => setTimeout(resolve, 10000));

                        const codeRetry = execSync(checkCommand, { stdio: 'pipe', encoding: 'utf8' }).trim();
                        if (codeRetry === '0x' || codeRetry.length <= 4) {
                            throw new Error('No code at address');
                        }
                    }
                    console.log(`   ✅ Contract code verified on-chain`);
                } catch (verifyError) {
                    console.log(`   ⚠️ Code verification issue: ${verifyError.message}`);
                }

                console.log(`   ✅ WGAS: ${wgasAddress}`);

                // Verify via Blockscout API for NEO X
                if (isNeoX) {
                    console.log(`   🔍 Starting verification via Standard Input API...`);

                    // Wait for indexing
                    await new Promise(resolve => setTimeout(resolve, 15000));

                    // No constructor args for WGAS
                    await verifyViaStandardInput(wgasAddress, wgasConfig.name, wgasConfig.path, verifierBaseUrl, '');

                    // Wait and check
                    await new Promise(resolve => setTimeout(resolve, 20000));

                    let verified = false;
                    for (let attempt = 1; attempt <= 2; attempt++) {
                        const status = await checkVerificationStatus(wgasAddress, wgasConfig.name, verifierBaseUrl);

                        if (status.isVerified || status.isPartiallyVerified) {
                            console.log(`   ✅ Verified${status.isPartiallyVerified ? ' (partial)' : ''}`);
                            verified = true;
                            break;
                        } else {
                            console.log(`   ⏳ Not verified yet (attempt ${attempt}/2)`);
                            if (attempt < 2) {
                                await verifyViaStandardInput(wgasAddress, wgasConfig.name, wgasConfig.path, verifierBaseUrl, '');
                                await new Promise(resolve => setTimeout(resolve, 15000));
                            }
                        }
                    }

                    if (!verified) {
                        console.log(`   ⚠️ Verification may need manual check`);
                    }
                }

                // Save to deployments
                if (!deployments.tokens) {
                    deployments.tokens = {};
                }
                deployments.tokens.WGAS = wgasAddress;
                deployments.timestamp = new Date().toISOString();
                fs.writeFileSync('deployments/all-contracts.json', JSON.stringify(deployments, null, 2));
                console.log(`   💾 Saved WGAS to deployments`);
            }

        } catch (error) {
            console.error(`   ❌ Failed to deploy WGAS:`, error.message);
        }
    }

    // ===========================================
    // VERIFICATION SUMMARY
    // ===========================================
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 VERIFYING TOKEN PROPERTIES');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    for (const token of tokens) {
        const tokenAddress = deployments.tokens[token.symbol];
        if (!tokenAddress) {
            console.log(`❌ ${token.symbol}: NOT DEPLOYED`);
            continue;
        }

        try {
            // Check total supply
            const totalSupplyData = await provider.call({
                to: tokenAddress,
                data: '0x18160ddd' // totalSupply()
            });
            const totalSupply = BigInt(totalSupplyData);
            const formattedSupply = ethers.formatUnits(totalSupply, token.decimals);

            console.log(`✅ ${token.symbol}: ${tokenAddress}`);
            console.log(`   Supply: ${formattedSupply} ${token.symbol}`);
        } catch (error) {
            console.log(`⚠️ ${token.symbol}: ${tokenAddress} (could not verify properties)`);
        }
    }

    // Finalize
    deployments.phase = 'core-3.2-completed';
    deployments.timestamp = new Date().toISOString();
    fs.writeFileSync('deployments/all-contracts.json', JSON.stringify(deployments, null, 2));

    console.log('\n🎉 CORE Phase 3.2 Complete!');
    console.log('============================');
    console.log('📋 Deployed Tokens:');
    for (const token of tokens) {
        if (deployments.tokens[token.symbol]) {
            console.log(`  ✅ ${token.symbol}: ${deployments.tokens[token.symbol]}`);
        }
    }
    console.log('');
    console.log('⚡ TEST TOKENS READY FOR LENDING PROTOCOL!');
    console.log('📋 Can now be used as reserves in Pool');
    console.log('🚀 Next: Run CORE Phase 4 (AToken & VariableDebtToken Implementation)');
    console.log('');
    console.log('🎯 CORE Progress: Phase 3.2/5 ✅');

    if (isNeoX) {
        console.log(`\n🔗 View on Blockscout: ${verifierBaseUrl}`);
    }
}

// Run
deployTestTokens().catch((error) => {
    console.error('\n❌ CORE Phase 3.2 failed:');
    console.error(error);
    process.exit(1);
});
