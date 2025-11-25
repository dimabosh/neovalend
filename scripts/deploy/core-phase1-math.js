const { ethers } = require('ethers');
const fs = require('fs');
const { execSync } = require('child_process');

// CORE Phase 1: Math Libraries (Aave v3.5 with Solidity 0.8.27)
// 5 контрактов: WadRayMath, PercentageMath, MathUtils, Errors, DataTypes

async function deployCorePhase1() {
    console.log('🚀 CORE Phase 1: Math Libraries (Aave v3.5)');
    console.log('===========================================');
    console.log('📋 Contracts: 5 math libraries\n');

    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL_SEPOLIA);
    const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);

    console.log('📋 Deployer:', wallet.address);
    const balance = await provider.getBalance(wallet.address);
    console.log('💰 Balance:', ethers.formatEther(balance), 'ETH');

    // Загрузить или создать deployments
    const networkName = process.env.NETWORK || 'sepolia';
    let deployments = {
        network: networkName,
        deployer: wallet.address,
        timestamp: new Date().toISOString(),
        phase: 'core-1',
        libraries: {},
        contracts: {}
    };

    if (fs.existsSync('deployments/all-contracts.json')) {
        const existing = JSON.parse(fs.readFileSync('deployments/all-contracts.json', 'utf8'));
        deployments.contracts = existing.contracts || {};
        deployments.libraries = existing.libraries || {};
        console.log('📄 Loaded existing deployments');
    }

    // CORE Phase 1 библиотеки (Aave v3.5)
    const mathLibraries = [
        {
            name: 'WadRayMath',
            path: 'contracts/aave-v3-origin/src/contracts/protocol/libraries/math/WadRayMath.sol',
            description: 'WAD and RAY math operations'
        },
        {
            name: 'PercentageMath',
            path: 'contracts/aave-v3-origin/src/contracts/protocol/libraries/math/PercentageMath.sol',
            description: 'Percentage calculations'
        },
        {
            name: 'MathUtils',
            path: 'contracts/aave-v3-origin/src/contracts/protocol/libraries/math/MathUtils.sol',
            description: 'Math utility functions'
        },
        {
            name: 'Errors',
            path: 'contracts/aave-v3-origin/src/contracts/protocol/libraries/helpers/Errors.sol',
            description: 'Error definitions'
        },
        {
            name: 'DataTypes',
            path: 'contracts/aave-v3-origin/src/contracts/protocol/libraries/types/DataTypes.sol',
            description: 'Data structure definitions'
        }
    ];

    console.log(`\n🎯 Deploying ${mathLibraries.length} math libraries...`);

    // Smart deployment mode
    const forceRedeploy = process.env.FORCE_REDEPLOY === 'true';
    const network = process.env.NETWORK || 'sepolia';
    const isNeoX = network.includes('neox');

    if (isNeoX) {
        console.log('🌐 Network: NEO X (legacy transactions)');
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

    for (const libConfig of mathLibraries) {
        // Проверяем, уже ли задеплоена библиотека
        if (!forceRedeploy && deployments.libraries[libConfig.name]) {
            console.log(`✅ ${libConfig.name}: ${deployments.libraries[libConfig.name]} (already deployed)`);
            continue;
        }

        console.log(`🚀 Deploying ${libConfig.name}...`);

        try {
            if (!fs.existsSync(libConfig.path)) {
                console.error(`❌ File not found: ${libConfig.path}`);
                continue;
            }

            const contractForFoundry = libConfig.path + ':' + libConfig.name;

            // Деплой с --legacy флагом для NEO X
            let foundryCommand;
            if (isNeoX) {
                foundryCommand = `forge create "${contractForFoundry}" --private-key ${process.env.DEPLOYER_PRIVATE_KEY} --rpc-url ${process.env.RPC_URL_SEPOLIA} --broadcast --json --use 0.8.27 --legacy`;
            } else {
                const apiKey = process.env.ETHERSCAN_API_KEY ? process.env.ETHERSCAN_API_KEY.trim() : '';
                foundryCommand = `forge create "${contractForFoundry}" --private-key ${process.env.DEPLOYER_PRIVATE_KEY} --rpc-url ${process.env.RPC_URL_SEPOLIA} --verify --etherscan-api-key ${apiKey} --broadcast --json --use 0.8.27`;
            }

            let foundryOutput;
            try {
                foundryOutput = execSync(foundryCommand, {
                    stdio: 'pipe',
                    encoding: 'utf8',
                    maxBuffer: 10 * 1024 * 1024
                });
            } catch (execError) {
                foundryOutput = execError.stdout ? execError.stdout.toString() : '';
            }

            // Парсим адрес из JSON
            let contractAddress = null;

            try {
                const jsonMatch = foundryOutput.match(/\{[^}]*"deployedTo"[^}]*\}/);
                if (jsonMatch) {
                    const jsonOutput = JSON.parse(jsonMatch[0]);
                    if (jsonOutput.deployedTo) {
                        contractAddress = jsonOutput.deployedTo;
                    }
                }
            } catch (e) {
                const addressMatch = foundryOutput.match(/Deployed to: (0x[a-fA-F0-9]{40})/);
                if (addressMatch) {
                    contractAddress = addressMatch[1];
                }
            }

            if (contractAddress && contractAddress !== '0x0000000000000000000000000000000000000000') {
                // Проверка что код на месте
                try {
                    const checkCommand = `cast code ${contractAddress} --rpc-url ${process.env.RPC_URL_SEPOLIA}`;
                    const code = execSync(checkCommand, { stdio: 'pipe', encoding: 'utf8' }).trim();

                    if (code === '0x' || code.length <= 4) {
                        console.log('⏳ Waiting for blockchain sync...');
                        await new Promise(resolve => setTimeout(resolve, 10000));

                        const codeRetry = execSync(checkCommand, { stdio: 'pipe', encoding: 'utf8' }).trim();
                        if (codeRetry === '0x' || codeRetry.length <= 4) {
                            throw new Error('No code at address');
                        }
                    }
                } catch (verifyError) {
                    console.log(`⚠️ Code verification issue: ${verifyError.message}`);
                }

                // Верификация через Blockscout для NEO X
                if (isNeoX) {
                    console.log(`   📝 Verifying on Blockscout...`);
                    try {
                        const verifierUrl = network === 'neox-mainnet'
                            ? 'https://xexplorer.neo.org/api'
                            : 'https://xt4scan.ngd.network/api';

                        // Верификация с flattened source для лучшей совместимости с Blockscout
                        // --flatten создаёт единый файл без импортов
                        const verifyCommand = `forge verify-contract ${contractAddress} "${contractForFoundry}" --verifier blockscout --verifier-url ${verifierUrl} --compiler-version 0.8.27 --num-of-optimizations 200 --evm-version shanghai --flatten --watch`;

                        const verifyOutput = execSync(verifyCommand, {
                            stdio: 'pipe',
                            encoding: 'utf8',
                            timeout: 120000
                        });

                        // Проверяем что верификация успешна
                        if (verifyOutput.includes('Successfully verified') || verifyOutput.includes('Contract successfully verified')) {
                            console.log(`✅ ${libConfig.name}: ${contractAddress} (verified)`);
                        } else {
                            console.log(`✅ ${libConfig.name}: ${contractAddress} (submitted)`);
                        }
                    } catch (verifyError) {
                        const errorMsg = verifyError.stderr ? verifyError.stderr.toString() : verifyError.message;
                        // Если уже верифицирован - это OK
                        if (errorMsg.includes('already verified') || errorMsg.includes('Already Verified')) {
                            console.log(`✅ ${libConfig.name}: ${contractAddress} (already verified)`);
                        } else {
                            console.log(`✅ ${libConfig.name}: ${contractAddress} (verification pending)`);
                            console.log(`   ⚠️ ${errorMsg.substring(0, 100)}`);
                        }
                    }
                } else {
                    console.log(`✅ ${libConfig.name}: ${contractAddress}`);
                }

                // Сохранить прогресс
                deployments.libraries[libConfig.name] = contractAddress;
                deployments.timestamp = new Date().toISOString();
                deployments.phase = 'core-1-in-progress';
                fs.writeFileSync('deployments/all-contracts.json', JSON.stringify(deployments, null, 2));

            } else {
                console.error(`❌ Could not extract address for ${libConfig.name}`);
                process.exit(1);
            }

        } catch (error) {
            console.error(`❌ Failed to deploy ${libConfig.name}:`, error.message);
            process.exit(1);
        }

        // Задержка между деплоями
        await new Promise(resolve => setTimeout(resolve, 5000));
    }

    // Финализация Phase 1
    deployments.phase = 'core-1-completed';
    deployments.timestamp = new Date().toISOString();
    fs.writeFileSync('deployments/all-contracts.json', JSON.stringify(deployments, null, 2));

    console.log('\n🎉 CORE Phase 1 Complete!');
    console.log('========================');
    console.log('📋 Deployed Math Libraries:');

    for (const lib of mathLibraries) {
        if (deployments.libraries[lib.name]) {
            console.log(`  ✅ ${lib.name}: ${deployments.libraries[lib.name]}`);
        }
    }

    console.log(`\n📊 Total: ${mathLibraries.filter(lib => deployments.libraries[lib.name]).length}/${mathLibraries.length} libraries`);
    console.log('🚀 Next: Run CORE Phase 2 (Infrastructure)');
}

// Запуск
deployCorePhase1().catch((error) => {
    console.error('\n❌ CORE Phase 1 deployment failed:');
    console.error(error);
    process.exit(1);
});
