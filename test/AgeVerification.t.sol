// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {AgeVerification} from "../src/AgeVerification.sol";
import {Groth16Verifier} from "../src/Verifier.sol";

/**
 * @title AgeVerificationTest
 * @notice Foundry tests for the AgeVerification contract
 */
contract AgeVerificationTest is Test {
    AgeVerification public ageVerification;
    Groth16Verifier public verifier;
    
    address public owner;
    address public user;
    
    uint256 public constant MIN_AGE = 18;
    uint256 public constant REQUIRED_CITIZENSHIP = 0x5553; // "US" encoded
    
    // Test issuer public keys (will be set in setUp)
    uint256 public issuerAPubkeyX;
    uint256 public issuerAPubkeyY;
    uint256 public issuerBPubkeyX;
    uint256 public issuerBPubkeyY;
    
    event TrustedIssuerAdded(bytes32 indexed issuerKeyHash, bool isIssuerA);
    
    function setUp() public {
        owner = address(this);
        user = address(0x1234);
        
        // Deploy real verifier
        verifier = new Groth16Verifier();
        
        // Deploy AgeVerification contract
        ageVerification = new AgeVerification(
            address(verifier),
            MIN_AGE,
            REQUIRED_CITIZENSHIP
        );
        
        // Set test issuer public keys (example values)
        issuerAPubkeyX = 0x1234567890123456789012345678901234567890123456789012345678901234;
        issuerAPubkeyY = 0x5678901234567890123456789012345678901234567890123456789012345678;
        issuerBPubkeyX = 0x9876543210987654321098765432109876543210987654321098765432109876;
        issuerBPubkeyY = 0x4321098765432109876543210987654321098765432109876543210987654321;
    }
    
    function test_Deployment() public {
        assertEq(address(ageVerification.verifier()), address(verifier));
        assertEq(ageVerification.owner(), owner);
        assertEq(ageVerification.minAge(), MIN_AGE);
        assertEq(ageVerification.requiredCitizenship(), REQUIRED_CITIZENSHIP);
    }
    
    function test_AddTrustedIssuerA() public {
        bytes32 issuerHash = keccak256(abi.encodePacked(issuerAPubkeyX, issuerAPubkeyY));
        
        vm.expectEmit(true, false, false, true);
        emit TrustedIssuerAdded(issuerHash, true);
        
        ageVerification.addTrustedIssuerA(issuerAPubkeyX, issuerAPubkeyY);
        
        assertTrue(ageVerification.trustedIssuerA(issuerHash));
    }
    
    function test_AddTrustedIssuerB() public {
        bytes32 issuerHash = keccak256(abi.encodePacked(issuerBPubkeyX, issuerBPubkeyY));
        
        vm.expectEmit(true, false, false, true);
        emit TrustedIssuerAdded(issuerHash, false);
        
        ageVerification.addTrustedIssuerB(issuerBPubkeyX, issuerBPubkeyY);
        
        assertTrue(ageVerification.trustedIssuerB(issuerHash));
    }
    
    function test_OnlyOwnerCanAddIssuer() public {
        vm.prank(user);
        vm.expectRevert("AgeVerification: caller is not the owner");
        ageVerification.addTrustedIssuerA(issuerAPubkeyX, issuerAPubkeyY);
    }
    
    function test_RemoveTrustedIssuerA() public {
        ageVerification.addTrustedIssuerA(issuerAPubkeyX, issuerAPubkeyY);
        bytes32 issuerHash = keccak256(abi.encodePacked(issuerAPubkeyX, issuerAPubkeyY));
        assertTrue(ageVerification.trustedIssuerA(issuerHash));
        
        ageVerification.removeTrustedIssuerA(issuerAPubkeyX, issuerAPubkeyY);
        assertFalse(ageVerification.trustedIssuerA(issuerHash));
    }
    
    
    function test_SetMinAge() public {
        uint256 newMinAge = 21;
        ageVerification.setMinAge(newMinAge);
        assertEq(ageVerification.minAge(), newMinAge);
    }
    
    function test_SetRequiredCitizenship() public {
        uint256 newCitizenship = 0x4341; // "CA" encoded
        ageVerification.setRequiredCitizenship(newCitizenship);
        assertEq(ageVerification.requiredCitizenship(), newCitizenship);
    }
    
    function test_VerifyProofWithRealProof() public {
        uint[2] memory a = [
            uint256(0x28a22385462c6ea33fdb1daac3322ccc2244f414a6819eb0c7ac97c72f93f78d),
            uint256(0x04314dc2522dd47322e40a81864ab0861c35e7e949e3f4a93731ace4174c800e)
        ];
        uint[2][2] memory b = [
            [
                uint256(0x03f7a3c664cee25f49a321ab9d6fa53ac371d3fa5c2b17611307ff8f03548992),
                uint256(0x05a444ccabd6b90ccd5d958a73d3707720f07e70ef3297c44d2a2de0076eb999)
            ],
            [
                uint256(0x15710f3a46fd70a023a3d60ff13240dbb37c2f3da78b3b090758d212b465d7e2),
                uint256(0x1ad98608406231a2e3625e27bbaae86a882d32d7eb952d46f9dc1d26b196d7cf)
            ]
        ];
        uint[2] memory c = [
            uint256(0x0205872169f466cfc81446d9632fca66171b10a48e1b2de94d9705d6c5559fef),
            uint256(0x1e158f6b6317b3735a1bbfbee99c40a641be86da9dffd57b4f299bcfe4e3eb2f)
        ];
        uint[9] memory input = [
            uint256(0x0000000000000000000000000000000000000000000000000000000069693a5b),
            uint256(0x0000000000000000000000000000000000000000000000000000000000000012),
            uint256(0x0000000000000000000000000000000000000000000000000000000000005553),
            uint256(0x03a6282221c139b2528838cfabc85e7445c0a9b2d42a9046239ae465e41b9d24),
            uint256(0x02606690bab866e37a28465678c8ecabef4fa7dad355f9da295e3e0f63b221d6),
            uint256(0x267ce160b14743131a8ee4f3894bff3a21e8fd1b0468c0fef9dec9b1beffb9a2),
            uint256(0x2410c94922451e7706a2311fea92c3ced4dc36fc967e183764a191265e369527),
            uint256(0x00000000000000000000000090f8bf6a479f320ead074411a4b0e7944ea8c9c1),
            uint256(0x00000000000000000000000090f8bf6a479f320ead074411a4b0e7944ea8c9c1)
        ];

        // Register issuers from proof inputs
        ageVerification.addTrustedIssuerA(input[3], input[4]);
        ageVerification.addTrustedIssuerB(input[5], input[6]);

        // Align block timestamp with proof current_date
        vm.warp(input[0]);

        address proofWallet = address(uint160(input[8]));
        vm.prank(proofWallet);
        bool ok = ageVerification.verifyProof(a, b, c, input);
        assertTrue(ok);
    }

    function test_TransferOwnership() public {
        address newOwner = address(0x5678);
        ageVerification.transferOwnership(newOwner);
        assertEq(ageVerification.owner(), newOwner);
    }
    
    function test_TransferOwnershipToZeroAddress() public {
        vm.expectRevert("AgeVerification: new owner is zero address");
        ageVerification.transferOwnership(address(0));
    }
    
    // Note: Testing verifyProof with actual zk-proofs requires:
    // 1. Compiled circuit
    // 2. Trusted setup
    // 3. Generated proof
    // These integration tests would be in a separate test file
    // that runs after circuit compilation and proof generation
}
