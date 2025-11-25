// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title Faucet
 * @notice Testnet faucet for distributing USDT, wA7A5, and WBTC tokens
 */
contract Faucet is Ownable, ReentrancyGuard {
    // Token addresses
    IERC20 public usdtToken;
    IERC20 public wa7a5Token;
    IERC20 public wbtcToken;

    // Faucet amounts
    uint256 public usdtAmount = 1000 * 10**6;      // 1,000 USDT (6 decimals)
    uint256 public wa7a5Amount = 100000 * 10**18;  // 100,000 wA7A5 (18 decimals)
    uint256 public wbtcAmount = 10**7;             // 0.1 WBTC (8 decimals)

    // Cooldown period (24 hours)
    uint256 public cooldownPeriod = 24 hours;

    // Track last request time per address per token
    mapping(address => mapping(address => uint256)) public lastRequestTime;

    // Events
    event TokensRequested(address indexed user, address indexed token, uint256 amount);
    event FaucetRefilled(address indexed token, uint256 amount);
    event AmountsUpdated(uint256 usdtAmount, uint256 wa7a5Amount, uint256 wbtcAmount);
    event CooldownUpdated(uint256 newCooldown);

    constructor(address _usdtToken, address _wa7a5Token, address _wbtcToken) Ownable(msg.sender) {
        require(_usdtToken != address(0), "Invalid USDT address");
        require(_wa7a5Token != address(0), "Invalid wA7A5 address");
        require(_wbtcToken != address(0), "Invalid WBTC address");

        usdtToken = IERC20(_usdtToken);
        wa7a5Token = IERC20(_wa7a5Token);
        wbtcToken = IERC20(_wbtcToken);
    }

    /**
     * @notice Request USDT tokens from faucet
     */
    function requestUSDT() external nonReentrant {
        require(canRequest(msg.sender, address(usdtToken)), "Cooldown period not elapsed");
        require(usdtToken.balanceOf(address(this)) >= usdtAmount, "Insufficient USDT in faucet");

        lastRequestTime[msg.sender][address(usdtToken)] = block.timestamp;

        require(usdtToken.transfer(msg.sender, usdtAmount), "USDT transfer failed");

        emit TokensRequested(msg.sender, address(usdtToken), usdtAmount);
    }

    /**
     * @notice Request wA7A5 tokens from faucet
     */
    function requestWA7A5() external nonReentrant {
        require(canRequest(msg.sender, address(wa7a5Token)), "Cooldown period not elapsed");
        require(wa7a5Token.balanceOf(address(this)) >= wa7a5Amount, "Insufficient wA7A5 in faucet");

        lastRequestTime[msg.sender][address(wa7a5Token)] = block.timestamp;

        require(wa7a5Token.transfer(msg.sender, wa7a5Amount), "wA7A5 transfer failed");

        emit TokensRequested(msg.sender, address(wa7a5Token), wa7a5Amount);
    }

    /**
     * @notice Request WBTC tokens from faucet
     */
    function requestWBTC() external nonReentrant {
        require(canRequest(msg.sender, address(wbtcToken)), "Cooldown period not elapsed");
        require(wbtcToken.balanceOf(address(this)) >= wbtcAmount, "Insufficient WBTC in faucet");

        lastRequestTime[msg.sender][address(wbtcToken)] = block.timestamp;

        require(wbtcToken.transfer(msg.sender, wbtcAmount), "WBTC transfer failed");

        emit TokensRequested(msg.sender, address(wbtcToken), wbtcAmount);
    }

    /**
     * @notice Check if user can request tokens for specific token
     */
    function canRequest(address user, address token) public view returns (bool) {
        return block.timestamp >= lastRequestTime[user][token] + cooldownPeriod;
    }

    /**
     * @notice Get time remaining until next request for specific token
     */
    function timeUntilNextRequest(address user, address token) public view returns (uint256) {
        if (canRequest(user, token)) {
            return 0;
        }
        return (lastRequestTime[user][token] + cooldownPeriod) - block.timestamp;
    }

    /**
     * @notice Update faucet amounts (owner only)
     */
    function updateAmounts(uint256 _usdtAmount, uint256 _wa7a5Amount, uint256 _wbtcAmount) external onlyOwner {
        usdtAmount = _usdtAmount;
        wa7a5Amount = _wa7a5Amount;
        wbtcAmount = _wbtcAmount;
        emit AmountsUpdated(_usdtAmount, _wa7a5Amount, _wbtcAmount);
    }

    /**
     * @notice Update cooldown period (owner only)
     */
    function updateCooldown(uint256 _cooldownPeriod) external onlyOwner {
        cooldownPeriod = _cooldownPeriod;
        emit CooldownUpdated(_cooldownPeriod);
    }

    /**
     * @notice Withdraw tokens from faucet (owner only)
     */
    function withdrawTokens(address token, uint256 amount) external onlyOwner {
        require(IERC20(token).transfer(msg.sender, amount), "Transfer failed");
    }

    /**
     * @notice Withdraw all tokens from faucet (owner only)
     */
    function withdrawAll() external onlyOwner {
        uint256 usdtBalance = usdtToken.balanceOf(address(this));
        uint256 wa7a5Balance = wa7a5Token.balanceOf(address(this));
        uint256 wbtcBalance = wbtcToken.balanceOf(address(this));

        if (usdtBalance > 0) {
            require(usdtToken.transfer(msg.sender, usdtBalance), "USDT transfer failed");
        }
        if (wa7a5Balance > 0) {
            require(wa7a5Token.transfer(msg.sender, wa7a5Balance), "wA7A5 transfer failed");
        }
        if (wbtcBalance > 0) {
            require(wbtcToken.transfer(msg.sender, wbtcBalance), "WBTC transfer failed");
        }
    }

    /**
     * @notice Get faucet balances
     */
    function getFaucetBalances() external view returns (uint256 usdtBalance, uint256 wa7a5Balance, uint256 wbtcBalance) {
        usdtBalance = usdtToken.balanceOf(address(this));
        wa7a5Balance = wa7a5Token.balanceOf(address(this));
        wbtcBalance = wbtcToken.balanceOf(address(this));
    }
}
