// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title A7A5Token
 * @dev Rebaseable ERC20 token for Neovalend Protocol
 * @notice This token supports automatic rebase mechanism for yield distribution
 */
contract A7A5Token is ERC20, Ownable, ReentrancyGuard {
    using SafeMath for uint256;

    // Rebase variables
    uint256 private constant DECIMALS = 18;
    uint256 private constant MAX_UINT256 = type(uint256).max;
    uint256 private constant INITIAL_FRAGMENTS_SUPPLY = 1_000_000 * 10**DECIMALS; // 1M tokens
    uint256 private constant TOTAL_GONS = MAX_UINT256 - (MAX_UINT256 % INITIAL_FRAGMENTS_SUPPLY);

    uint256 private _totalSupply;
    uint256 private _gonsPerFragment;
    mapping(address => uint256) private _gonBalances;
    mapping(address => mapping(address => uint256)) private _allowedFragments;

    // Rebase control
    address public rebaseManager;
    bool public rebaseEnabled = true;
    uint256 public lastRebaseTime;
    uint256 public rebaseFrequency = 24 hours; // Daily rebase

    // Events
    event Rebase(uint256 epoch, uint256 totalSupply, uint256 supplyDelta);
    event RebaseManagerUpdated(address indexed oldManager, address indexed newManager);
    event RebaseStatusUpdated(bool enabled);

    modifier onlyRebaseManager() {
        require(msg.sender == rebaseManager, "Only rebase manager");
        _;
    }

    constructor(
        string memory name,
        string memory symbol,
        address _rebaseManager
    ) ERC20(name, symbol) {
        _totalSupply = INITIAL_FRAGMENTS_SUPPLY;
        _gonsPerFragment = TOTAL_GONS.div(_totalSupply);
        rebaseManager = _rebaseManager;
        lastRebaseTime = block.timestamp;

        // Mint initial supply to deployer
        _gonBalances[msg.sender] = TOTAL_GONS;
        emit Transfer(address(0), msg.sender, _totalSupply);
    }

    /**
     * @notice Returns the total number of tokens in existence
     */
    function totalSupply() public view override returns (uint256) {
        return _totalSupply;
    }

    /**
     * @notice Returns the balance of tokens for account
     * @param account The address to query balance for
     * @return Token balance
     */
    function balanceOf(address account) public view override returns (uint256) {
        return _gonBalances[account].div(_gonsPerFragment);
    }

    /**
     * @notice Transfer tokens to specified address
     * @param to Recipient address
     * @param value Amount to transfer
     * @return Success boolean
     */
    function transfer(address to, uint256 value) public override returns (bool) {
        uint256 gonValue = value.mul(_gonsPerFragment);
        _gonBalances[msg.sender] = _gonBalances[msg.sender].sub(gonValue);
        _gonBalances[to] = _gonBalances[to].add(gonValue);

        emit Transfer(msg.sender, to, value);
        return true;
    }

    /**
     * @notice Transfer tokens from one address to another
     * @param from Source address
     * @param to Destination address  
     * @param value Amount to transfer
     * @return Success boolean
     */
    function transferFrom(address from, address to, uint256 value) public override returns (bool) {
        _allowedFragments[from][msg.sender] = _allowedFragments[from][msg.sender].sub(value);

        uint256 gonValue = value.mul(_gonsPerFragment);
        _gonBalances[from] = _gonBalances[from].sub(gonValue);
        _gonBalances[to] = _gonBalances[to].add(gonValue);

        emit Transfer(from, to, value);
        return true;
    }

    /**
     * @notice Approve spender to spend tokens on behalf of owner
     * @param spender Address to approve
     * @param value Amount to approve
     * @return Success boolean
     */
    function approve(address spender, uint256 value) public override returns (bool) {
        _allowedFragments[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    /**
     * @notice Get allowance between owner and spender
     * @param owner Token owner
     * @param spender Approved spender
     * @return Remaining allowance
     */
    function allowance(address owner, address spender) public view override returns (uint256) {
        return _allowedFragments[owner][spender];
    }

    /**
     * @notice Performs rebase operation
     * @dev Only callable by rebase manager
     * @param epoch Current rebase epoch
     * @param supplyDelta Amount to change supply by
     * @return New total supply
     */
    function rebase(uint256 epoch, int256 supplyDelta) external onlyRebaseManager nonReentrant returns (uint256) {
        require(rebaseEnabled, "Rebase disabled");
        require(block.timestamp >= lastRebaseTime + rebaseFrequency, "Rebase too frequent");

        if (supplyDelta == 0) {
            emit Rebase(epoch, _totalSupply, 0);
            return _totalSupply;
        }

        uint256 newTotalSupply;
        if (supplyDelta < 0) {
            newTotalSupply = _totalSupply.sub(uint256(-supplyDelta));
        } else {
            newTotalSupply = _totalSupply.add(uint256(supplyDelta));
        }

        if (newTotalSupply > MAX_UINT256) {
            newTotalSupply = MAX_UINT256;
        }

        _totalSupply = newTotalSupply;
        _gonsPerFragment = TOTAL_GONS.div(_totalSupply);
        lastRebaseTime = block.timestamp;

        emit Rebase(epoch, _totalSupply, uint256(supplyDelta));
        return _totalSupply;
    }

    /**
     * @notice Set new rebase manager
     * @param _rebaseManager New rebase manager address
     */
    function setRebaseManager(address _rebaseManager) external onlyOwner {
        require(_rebaseManager != address(0), "Invalid address");
        address oldManager = rebaseManager;
        rebaseManager = _rebaseManager;
        emit RebaseManagerUpdated(oldManager, _rebaseManager);
    }

    /**
     * @notice Enable or disable rebase functionality
     * @param _enabled Rebase status
     */
    function setRebaseEnabled(bool _enabled) external onlyOwner {
        rebaseEnabled = _enabled;
        emit RebaseStatusUpdated(_enabled);
    }

    /**
     * @notice Set rebase frequency
     * @param _frequency New frequency in seconds
     */
    function setRebaseFrequency(uint256 _frequency) external onlyOwner {
        require(_frequency > 0, "Invalid frequency");
        rebaseFrequency = _frequency;
    }

    /**
     * @notice Check if rebase is due
     * @return Whether rebase can be called
     */
    function canRebase() external view returns (bool) {
        return rebaseEnabled && (block.timestamp >= lastRebaseTime + rebaseFrequency);
    }

    /**
     * @notice Get rebase multiplier since deployment
     * @return Current rebase multiplier (scaled by 1e18)
     */
    function getRebaseMultiplier() external view returns (uint256) {
        return _totalSupply.mul(1e18).div(INITIAL_FRAGMENTS_SUPPLY);
    }
}

// SafeMath library for arithmetic operations
library SafeMath {
    function add(uint256 a, uint256 b) internal pure returns (uint256) {
        uint256 c = a + b;
        require(c >= a, "SafeMath: addition overflow");
        return c;
    }

    function sub(uint256 a, uint256 b) internal pure returns (uint256) {
        require(b <= a, "SafeMath: subtraction overflow");
        return a - b;
    }

    function mul(uint256 a, uint256 b) internal pure returns (uint256) {
        if (a == 0) return 0;
        uint256 c = a * b;
        require(c / a == b, "SafeMath: multiplication overflow");
        return c;
    }

    function div(uint256 a, uint256 b) internal pure returns (uint256) {
        require(b > 0, "SafeMath: division by zero");
        return a / b;
    }
}