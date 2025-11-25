// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";

interface IPoolConfigurator {
    struct InitReserveInput {
        address aTokenImpl;
        address stableDebtTokenImpl; 
        address variableDebtTokenImpl;
        uint8 underlyingAssetDecimals;
        address interestRateStrategyAddress;
        address underlyingAsset;
        address treasury;
        address incentivesController;
        string aTokenName;
        string aTokenSymbol;
        string variableDebtTokenName;
        string variableDebtTokenSymbol;
        string stableDebtTokenName;
        string stableDebtTokenSymbol;
    }
    
    function initReserves(InitReserveInput[] calldata input) external;
    function configureReserveAsCollateral(
        address asset,
        uint256 ltv,
        uint256 liquidationThreshold,
        uint256 liquidationBonus
    ) external;
    function setReserveBorrowing(address asset, bool enabled) external;
}

interface IPool {
    function getReservesList() external view returns (address[] memory);
}

contract InitReserves is Script {
    address constant POOL_CONFIGURATOR = 0x44c567B1470f2C42EFf8fC8F353beF65073598ba;
    address constant POOL = 0x0cde208D79D723B51aFaff0683d6dE2878304Ba5;
    address constant USDT = 0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0;
    address constant A7A5 = 0x752EbE7b0dD6C6B7a2C0914E99DE9c892655897c;
    address constant ATOKEN_IMPL = 0x944b9C9faFCA2B615cE0381FE3362cC5d5436A09;
    address constant VARIABLE_DEBT_IMPL = 0xA18710e26fA7C87B6adf39ef5283Fc3c2c2e17eE;
    address constant INTEREST_RATE_STRATEGY = 0xd5e38be84DA323C3Cbf06CaD22204234dE7DC40c;
    address constant DEPLOYER = 0x241098de29B853c994C87ec3abcBf494ac02B35f;

    function run() external {
        vm.startBroadcast();
        
        IPoolConfigurator configurator = IPoolConfigurator(POOL_CONFIGURATOR);
        
        console.log("🚀 Initializing Neovalend Protocol reserves...");
        
        // Check current reserves
        address[] memory currentReserves = IPool(POOL).getReservesList();
        console.log("📋 Current reserves count:", currentReserves.length);
        
        if (currentReserves.length == 0) {
            console.log("🔧 Initializing USDT reserve...");
            
            IPoolConfigurator.InitReserveInput[] memory reserves = new IPoolConfigurator.InitReserveInput[](1);
            
            // USDT Reserve
            reserves[0] = IPoolConfigurator.InitReserveInput({
                aTokenImpl: ATOKEN_IMPL,
                stableDebtTokenImpl: address(0),
                variableDebtTokenImpl: VARIABLE_DEBT_IMPL,
                underlyingAssetDecimals: 6,
                interestRateStrategyAddress: INTEREST_RATE_STRATEGY,
                underlyingAsset: USDT,
                treasury: DEPLOYER,
                incentivesController: address(0),
                aTokenName: "Neovalend USDT",
                aTokenSymbol: "rUSDT",
                variableDebtTokenName: "Neovalend Variable Debt USDT",
                variableDebtTokenSymbol: "variableDebtUSDT", 
                stableDebtTokenName: "Neovalend Stable Debt USDT",
                stableDebtTokenSymbol: "stableDebtUSDT"
            });
            
            configurator.initReserves(reserves);
            console.log("✅ USDT reserve initialized");
            
            // Configure USDT collateral
            console.log("🔧 Configuring USDT as collateral...");
            configurator.configureReserveAsCollateral(
                USDT,
                8000, // 80% LTV
                8250, // 82.5% liquidation threshold  
                10500 // 105% liquidation bonus
            );
            
            // Enable borrowing
            configurator.setReserveBorrowing(USDT, true);
            console.log("✅ USDT borrowing enabled");
            
        } else {
            console.log("ℹ️ Reserves already initialized");
        }
        
        // Verify
        address[] memory finalReserves = IPool(POOL).getReservesList();
        console.log("🎉 Final reserves count:", finalReserves.length);
        for (uint i = 0; i < finalReserves.length; i++) {
            console.log("   Reserve", i, ":", finalReserves[i]);
        }
        
        vm.stopBroadcast();
    }
}