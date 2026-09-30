// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

import {Script, console2} from "forge-std/Script.sol";
import {CreditVault} from "../src/CreditVault.sol";
import {MockAUSD} from "../src/MockAUSD.sol";
import {IERC20} from "../src/IERC20.sol";
import {IX402BatchSettlement} from "../src/interfaces/IX402BatchSettlement.sol";

/// Deploys CreditVault against the canonical x402 batch settlement contract.
///
///   TOKEN=0x...   the stablecoin the vault lends (real AUSD or USDC on the target chain). If unset, a
///                 MockAUSD is deployed too, which is what a first testnet run should use.
///   PRIVATE_KEY   the deployer. Must be funded with MON on the target chain.
///
/// Dry run (no broadcast):  forge script contracts/script/Deploy.s.sol --fork-url https://testnet-rpc.monad.xyz
/// Broadcast to testnet:    forge script contracts/script/Deploy.s.sol --rpc-url https://testnet-rpc.monad.xyz --broadcast
contract Deploy is Script {
    address constant X402_BATCH_SETTLEMENT = 0x4020074e9dF2ce1deE5A9C1b5c3f541D02a10003;

    function run() external returns (address token, address vault) {
        require(block.chainid == 10143 || block.chainid == 143 || block.chainid == 31337, "unsupported chain");
        require(X402_BATCH_SETTLEMENT.code.length > 0, "x402 batch settlement not deployed on this chain");

        uint256 key = vm.envUint("PRIVATE_KEY");
        address configured = vm.envOr("TOKEN", address(0));

        vm.startBroadcast(key);
        token = configured == address(0) ? address(new MockAUSD()) : configured;
        vault = address(new CreditVault(IX402BatchSettlement(X402_BATCH_SETTLEMENT), IERC20(token)));
        vm.stopBroadcast();

        console2.log("chain id        :", block.chainid);
        console2.log("token           :", token, configured == address(0) ? "(MockAUSD, newly deployed)" : "(existing)");
        console2.log("CreditVault     :", vault);
        console2.log("x402 settlement :", X402_BATCH_SETTLEMENT);
    }
}
