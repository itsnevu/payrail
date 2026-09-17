// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title Payrail PaymentProcessor (v2)
/// @notice Accepts a USDC payment for a specific invoice, forwards the funds directly to the
///         merchant, and emits an event so the backend can match the payment to the invoice.
///         This contract never holds funds, has no owner, and has no upgrade path.
///
/// @dev    The payment key is derived on chain from the payment terms:
///             invoiceId = keccak256(abi.encode(salt, merchant, amount))
///         where `salt` is a backend-issued random 32-byte value (keccak256 of the invoice's
///         database id). Binding merchant and amount into the key means a call with the wrong
///         merchant or amount lands on a *different* key, so nobody can lock a real invoice by
///         paying a token amount to themselves (the griefing vector in v1).
contract PaymentProcessor is ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;

    /// @dev Ordered to pack into two storage slots: (payer, amount) and (merchant, paidAt).
    struct Payment {
        address payer;
        uint96 amount;
        address merchant;
        uint64 paidAt;
    }

    /// @dev invoiceId => payment data. amount > 0 means already paid.
    mapping(bytes32 => Payment) private _payments;

    event PaymentReceived(
        bytes32 indexed invoiceId,
        bytes32 indexed salt,
        address indexed merchant,
        address payer,
        uint256 amount,
        uint256 timestamp
    );

    error InvalidToken();
    error InvalidMerchant();
    error InvalidAmount();
    error InvoiceAlreadyPaid(bytes32 invoiceId);

    constructor(address usdc_) {
        if (usdc_ == address(0) || usdc_.code.length == 0) revert InvalidToken();
        usdc = IERC20(usdc_);
    }

    /// @notice Derive the payment key for a set of terms. Pure, so the backend and any
    ///         third party can compute it offchain and compare.
    function invoiceKey(bytes32 salt, address merchant, uint256 amount) public pure returns (bytes32) {
        return keccak256(abi.encode(salt, merchant, amount));
    }

    /// @notice Pay an invoice. The buyer must approve at least `amount` USDC to this contract first.
    /// @param salt     Backend-issued 32-byte value unique to the invoice.
    /// @param merchant Merchant wallet that receives the funds. Must match the invoice terms.
    /// @param amount   Exact USDC amount (6 decimals). Must match the invoice terms.
    function pay(bytes32 salt, address merchant, uint256 amount) external nonReentrant {
        if (merchant == address(0) || merchant == address(this)) revert InvalidMerchant();
        if (amount == 0 || amount > type(uint96).max) revert InvalidAmount();

        bytes32 invoiceId = invoiceKey(salt, merchant, amount);
        if (_payments[invoiceId].amount != 0) revert InvoiceAlreadyPaid(invoiceId);

        _payments[invoiceId] = Payment({
            payer: msg.sender,
            amount: uint96(amount),
            merchant: merchant,
            paidAt: uint64(block.timestamp)
        });

        // Funds go straight to the merchant; never held by the contract.
        usdc.safeTransferFrom(msg.sender, merchant, amount);

        emit PaymentReceived(invoiceId, salt, merchant, msg.sender, amount, block.timestamp);
    }

    function isPaid(bytes32 invoiceId) external view returns (bool) {
        return _payments[invoiceId].amount != 0;
    }

    function getPayment(bytes32 invoiceId) external view returns (Payment memory) {
        return _payments[invoiceId];
    }
}
