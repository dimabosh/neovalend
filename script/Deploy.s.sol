// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../contracts/SimpleTest.sol";

contract DeployScript {
    function run() external returns (address) {
        // Deploy SimpleTest contract
        SimpleTest simpleTest = new SimpleTest(42);
        
        return address(simpleTest);
    }
}