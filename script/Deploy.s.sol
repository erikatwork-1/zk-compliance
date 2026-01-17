// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {AgeVerification} from "../src/AgeVerification.sol";
import {Groth16Verifier} from "../src/Verifier.sol";

/**
 * @title Deploy
 * @notice Foundry deployment script for AgeVerification contracts
 */
contract Deploy is Script {
    uint256 public constant MIN_AGE = 18;
    uint256 public constant REQUIRED_CITIZENSHIP = 0x5553; // "US" encoded
    
    function run() external {
        // For local deployment, use startBroadcast() without a key (uses --private-key from CLI)
        // For testnet, read from PRIVATE_KEY env var
        uint256 deployerPrivateKey = vm.envOr("PRIVATE_KEY", uint256(0));
        if (deployerPrivateKey != 0) {
            vm.startBroadcast(deployerPrivateKey);
        } else {
            vm.startBroadcast();
        }
        
        console.log(" Deploying Contracts");
        console.log("======================\n");
        
        // Deploy Verifier contract
        console.log(" Deploying Verifier...");
        Groth16Verifier verifier = new Groth16Verifier();
        console.log(" Verifier deployed at:", address(verifier));
        
        // Deploy AgeVerification contract
        console.log("\n Deploying AgeVerification...");
        AgeVerification ageVerification = new AgeVerification(
            address(verifier),
            MIN_AGE,
            REQUIRED_CITIZENSHIP
        );
        console.log(" AgeVerification deployed at:", address(ageVerification));
        
        // Note: In a real deployment, you would register issuer keys here
        // For example:
        // ageVerification.addTrustedIssuerA(issuerAPubkeyX, issuerAPubkeyY);
        // ageVerification.addTrustedIssuerB(issuerBPubkeyX, issuerBPubkeyY);
        
        console.log("\n Setup complete!");
        console.log("   Verifier:", address(verifier));
        console.log("   AgeVerification:", address(ageVerification));
        console.log("\n  Remember to register issuer public keys!");
        
        vm.stopBroadcast();
    }
}
