// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SimpleFaucet
 * @notice A simple faucet that distributes testnet tokens from its balance
 * @dev Owner funds the contract, users can claim tokens with cooldown
 */
contract SimpleFaucet is Ownable {
    using SafeERC20 for IERC20;

    // Claim amount per token (token => amount)
    mapping(address => uint256) public claimAmounts;

    // Last claim timestamp per user per token (user => token => timestamp)
    mapping(address => mapping(address => uint256)) public lastClaimed;

    // Cooldown period in seconds (default 24 hours)
    uint256 public cooldownPeriod = 24 hours;

    // Events
    event TokensClaimed(address indexed user, address indexed token, uint256 amount);
    event ClaimAmountSet(address indexed token, uint256 amount);
    event CooldownPeriodSet(uint256 newPeriod);
    event TokensWithdrawn(address indexed token, uint256 amount);

    constructor() Ownable(msg.sender) {}

    /**
     * @notice Claim tokens from the faucet
     * @param token The token address to claim
     */
    function claim(address token) external {
        require(claimAmounts[token] > 0, "Token not supported");
        require(
            block.timestamp >= lastClaimed[msg.sender][token] + cooldownPeriod,
            "Cooldown not expired"
        );

        uint256 amount = claimAmounts[token];
        uint256 balance = IERC20(token).balanceOf(address(this));
        require(balance >= amount, "Insufficient faucet balance");

        lastClaimed[msg.sender][token] = block.timestamp;
        IERC20(token).safeTransfer(msg.sender, amount);

        emit TokensClaimed(msg.sender, token, amount);
    }

    /**
     * @notice Claim multiple tokens at once
     * @param tokens Array of token addresses to claim
     */
    function claimMultiple(address[] calldata tokens) external {
        for (uint256 i = 0; i < tokens.length; i++) {
            address token = tokens[i];

            if (claimAmounts[token] == 0) continue;
            if (block.timestamp < lastClaimed[msg.sender][token] + cooldownPeriod) continue;

            uint256 amount = claimAmounts[token];
            uint256 balance = IERC20(token).balanceOf(address(this));
            if (balance < amount) continue;

            lastClaimed[msg.sender][token] = block.timestamp;
            IERC20(token).safeTransfer(msg.sender, amount);

            emit TokensClaimed(msg.sender, token, amount);
        }
    }

    /**
     * @notice Check if user can claim a token
     * @param user The user address
     * @param token The token address
     * @return canClaim Whether the user can claim
     * @return timeUntilClaim Seconds until user can claim (0 if can claim now)
     */
    function canClaim(address user, address token) external view returns (bool canClaim, uint256 timeUntilClaim) {
        if (claimAmounts[token] == 0) {
            return (false, 0);
        }

        uint256 nextClaimTime = lastClaimed[user][token] + cooldownPeriod;
        if (block.timestamp >= nextClaimTime) {
            uint256 balance = IERC20(token).balanceOf(address(this));
            return (balance >= claimAmounts[token], 0);
        }

        return (false, nextClaimTime - block.timestamp);
    }

    /**
     * @notice Get faucet balance for a token
     * @param token The token address
     * @return The faucet's token balance
     */
    function getBalance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }

    // ============ Owner Functions ============

    /**
     * @notice Set the claim amount for a token
     * @param token The token address
     * @param amount The amount users can claim (in token decimals)
     */
    function setClaimAmount(address token, uint256 amount) external onlyOwner {
        claimAmounts[token] = amount;
        emit ClaimAmountSet(token, amount);
    }

    /**
     * @notice Set claim amounts for multiple tokens
     * @param tokens Array of token addresses
     * @param amounts Array of amounts (in token decimals)
     */
    function setClaimAmounts(address[] calldata tokens, uint256[] calldata amounts) external onlyOwner {
        require(tokens.length == amounts.length, "Length mismatch");
        for (uint256 i = 0; i < tokens.length; i++) {
            claimAmounts[tokens[i]] = amounts[i];
            emit ClaimAmountSet(tokens[i], amounts[i]);
        }
    }

    /**
     * @notice Set the cooldown period
     * @param newPeriod The new cooldown period in seconds
     */
    function setCooldownPeriod(uint256 newPeriod) external onlyOwner {
        cooldownPeriod = newPeriod;
        emit CooldownPeriodSet(newPeriod);
    }

    /**
     * @notice Withdraw tokens from the faucet
     * @param token The token address
     * @param amount The amount to withdraw
     */
    function withdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(msg.sender, amount);
        emit TokensWithdrawn(token, amount);
    }

    /**
     * @notice Withdraw all of a token from the faucet
     * @param token The token address
     */
    function withdrawAll(address token) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance > 0) {
            IERC20(token).safeTransfer(msg.sender, balance);
            emit TokensWithdrawn(token, balance);
        }
    }
}
