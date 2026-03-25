// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";

/**
 * @title DeployMockUSDC
 * @notice Deploy MockUSDC to any EVM network.
 *
 * Usage (Base Sepolia):
 *   forge script script/DeployMockUSDC.s.sol \
 *     --rpc-url $BASE_SEPOLIA_RPC_URL \
 *     --private-key $DEPLOYER_PK \
 *     --broadcast
 *
 * After deploying, set in .env.local:
 *   NEXT_PUBLIC_USDC_ADDRESS=<deployed address>
 *   NEXT_PUBLIC_USDC_NAME=USD Coin
 *   NEXT_PUBLIC_USDC_VERSION=2
 *
 * The deployer becomes the initial owner of no tokens — users call mint() freely.
 */
contract DeployMockUSDC is Script {
    function run() public {
        console2.log("Deploying MockUSDC to chain", block.chainid);

        vm.startBroadcast();
        MockUSDC token = new MockUSDC();
        vm.stopBroadcast();

        console2.log("MockUSDC deployed at:", address(token));
        console2.log("DOMAIN_SEPARATOR:", vm.toString(token.DOMAIN_SEPARATOR()));
        console2.log("");
        console2.log("Add to .env.local:");
        console2.log("  NEXT_PUBLIC_USDC_ADDRESS=", address(token));
        console2.log("  NEXT_PUBLIC_USDC_NAME=USD Coin");
        console2.log("  NEXT_PUBLIC_USDC_VERSION=2");
    }
}
