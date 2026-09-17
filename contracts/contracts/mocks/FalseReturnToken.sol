// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Test-only ERC-20 whose transferFrom returns false instead of reverting.
///         Used to prove that SafeERC20 turns that into a revert. Never deploy.
contract FalseReturnToken {
    function transferFrom(address, address, uint256) external pure returns (bool) {
        return false;
    }
}
