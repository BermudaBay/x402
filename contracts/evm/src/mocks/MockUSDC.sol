// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title MockUSDC
 * @notice ERC-20 mock with EIP-3009 transferWithAuthorization and permissionless mint.
 *
 *  - Mimics USDC: name="USD Coin", symbol="USDC", decimals=6
 *  - EIP-712 domain uses name="USD Coin", version="2" (matches real USDC on Base)
 *  - mint() is public — the demo faucet mints on demand, no pre-funding needed
 *  - Used exclusively on test networks; DO NOT deploy to mainnet
 */
contract MockUSDC is ERC20 {
    // ── EIP-712 ────────────────────────────────────────────────────────────────

    bytes32 public DOMAIN_SEPARATOR;

    bytes32 private constant TRANSFER_WITH_AUTHORIZATION_TYPEHASH = keccak256(
        "TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)"
    );

    // ── EIP-3009 nonce tracking ────────────────────────────────────────────────
    // authorizer => nonce => used
    mapping(address => mapping(bytes32 => bool)) private _authorizationStates;

    // ── Constructor ────────────────────────────────────────────────────────────

    constructor() ERC20("USD Coin", "USDC") {
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256(
                    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                ),
                keccak256(bytes("USD Coin")),
                keccak256(bytes("2")),
                block.chainid,
                address(this)
            )
        );
    }

    // ── ERC-20 metadata ────────────────────────────────────────────────────────

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    // ── Faucet ─────────────────────────────────────────────────────────────────

    /**
     * @notice Mint tokens freely — demo faucet only.
     * @dev No access control by design; this is a test token.
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    // ── EIP-3009 ───────────────────────────────────────────────────────────────

    /**
     * @notice Returns whether a nonce has been used by the given authorizer.
     */
    function authorizationState(address authorizer, bytes32 nonce) external view returns (bool) {
        return _authorizationStates[authorizer][nonce];
    }

    /**
     * @notice Execute a signed transferWithAuthorization (EIP-3009).
     *
     * @param from       Token sender (must have signed the authorization)
     * @param to         Token recipient
     * @param value      Amount to transfer (6 decimals)
     * @param validAfter  Unix timestamp — authorization is not valid before this
     * @param validBefore Unix timestamp — authorization expires at this time
     * @param nonce      Unique bytes32 nonce (random, per authorization)
     * @param v, r, s    ECDSA signature components
     */
    function transferWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        require(block.timestamp > validAfter, "Authorization not yet valid");
        require(block.timestamp < validBefore, "Authorization expired");
        require(!_authorizationStates[from][nonce], "Authorization nonce already used");

        bytes32 structHash = keccak256(
            abi.encode(
                TRANSFER_WITH_AUTHORIZATION_TYPEHASH,
                from,
                to,
                value,
                validAfter,
                validBefore,
                nonce
            )
        );

        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
        address signer = ECDSA.recover(digest, v, r, s);
        require(signer == from, "Invalid authorization signature");

        _authorizationStates[from][nonce] = true;
        _transfer(from, to, value);
    }
}
