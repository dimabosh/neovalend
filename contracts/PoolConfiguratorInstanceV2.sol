// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {PoolConfigurator, IPoolAddressesProvider, IPool, VersionedInitializable} from './aave-v3-origin/src/contracts/protocol/pool/PoolConfigurator.sol';

/**
 * @title Aave PoolConfigurator Instance V2
 * @notice Version 2 with reinitialize function to fix broken proxy
 */
contract PoolConfiguratorInstanceV2 is PoolConfigurator {
  uint256 public constant CONFIGURATOR_REVISION = 7; // Increment revision

  /// @inheritdoc VersionedInitializable
  function getRevision() internal pure virtual override returns (uint256) {
    return CONFIGURATOR_REVISION;
  }

  /**
   * @notice Initialize PoolConfigurator V2 (with higher revision for reinitialization)
   * @dev Overrides parent initialize() with revision 7 to allow reinitialization
   * @param provider The PoolAddressesProvider address
   */
  function initialize(IPoolAddressesProvider provider) public virtual override initializer {
    _addressesProvider = provider;
    _pool = IPool(_addressesProvider.getPool());
  }
}
