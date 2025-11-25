// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title SimplePriceOracle
 * @notice Mock price oracle for testnet deployment - ONE ASSET PER CONTRACT
 * @dev Mimics Chainlink Aggregator interface for Aave compatibility
 * @dev Each SimplePriceOracle instance represents ONE asset's price feed
 */
contract SimplePriceOracle {
    // Owner address
    address public owner;

    // Price in 8 decimals (like Chainlink)
    int256 public price;

    event PriceUpdated(int256 newPrice);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @notice Set price for this oracle
     * @param _price The price in 8 decimals (e.g., $1.00 = 100000000)
     */
    function setPrice(int256 _price) external onlyOwner {
        require(_price > 0, "Price must be positive");
        price = _price;
        emit PriceUpdated(_price);
    }

    /**
     * @notice Chainlink Aggregator interface - latestAnswer()
     * @dev AaveOracle calls this function to get price
     * @return The latest price (int256 format for Chainlink compatibility)
     */
    function latestAnswer() external view returns (int256) {
        require(price > 0, "Price not set");
        return price;
    }

    /**
     * @notice Get the price (alternative interface)
     * @return The price in 8 decimals as uint256
     */
    function getPrice() external view returns (uint256) {
        require(price > 0, "Price not set");
        return uint256(price);
    }

    /**
     * @notice Chainlink-compatible interface
     * @return roundId Round ID
     * @return answer Price answer
     * @return startedAt Start timestamp
     * @return updatedAt Update timestamp
     * @return answeredInRound Answered in round
     */
    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    ) {
        // Not implemented for this simple mock
        revert("Use getAssetPrice instead");
    }
}
