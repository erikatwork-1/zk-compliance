// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AgeVerification
 * @notice Smart contract for verifying zero-knowledge proofs of age and citizenship
 * @dev This contract verifies zk-SNARK proofs that prove a user is 18+ and a US citizen
 *      without revealing their actual date of birth or other personal information
 */
interface IVerifier {
    function verifyProof(
        uint[2] memory a,
        uint[2][2] memory b,
        uint[2] memory c,
        uint[9] memory input
    ) external view returns (bool);
}

contract AgeVerification {
    // ============ State Variables ============
    
    /// @notice Reference to the zk-SNARK verifier contract
    IVerifier public verifier;
    
    /// @notice Owner of the contract (can add/remove trusted issuers)
    address public owner;
    
    /// @notice Registry of trusted Issuer A public keys (for DOB credentials)
    /// @dev Maps keccak256(issuerPubkeyX, issuerPubkeyY) => isTrusted
    mapping(bytes32 => bool) public trustedIssuerA;
    
    /// @notice Registry of trusted Issuer B public keys (for citizenship credentials)
    /// @dev Maps keccak256(issuerPubkeyX, issuerPubkeyY) => isTrusted
    mapping(bytes32 => bool) public trustedIssuerB;
    
    /// @notice Minimum age requirement (default: 18)
    uint256 public minAge;
    
    /// @notice Required citizenship (encoded as field element, default: "US")
    uint256 public requiredCitizenship;
    
    // ============ Events ============
    
    /// @notice Emitted when a trusted issuer is added
    event TrustedIssuerAdded(bytes32 indexed issuerKeyHash, bool isIssuerA);
    
    /// @notice Emitted when a trusted issuer is removed
    event TrustedIssuerRemoved(bytes32 indexed issuerKeyHash, bool isIssuerA);
    
    // ============ Modifiers ============
    
    modifier onlyOwner() {
        require(msg.sender == owner, "AgeVerification: caller is not the owner");
        _;
    }
    
    // ============ Constructor ============
    
    /**
     * @notice Deploys the AgeVerification contract
     * @param _verifier Address of the zk-SNARK verifier contract
     * @param _minAge Minimum age requirement (default: 18)
     * @param _requiredCitizenship Required citizenship encoded as field element
     */
    constructor(
        address _verifier,
        uint256 _minAge,
        uint256 _requiredCitizenship
    ) {
        require(_verifier != address(0), "AgeVerification: verifier cannot be zero address");
        verifier = IVerifier(_verifier);
        owner = msg.sender;
        minAge = _minAge;
        requiredCitizenship = _requiredCitizenship;
    }
    
    // ============ Public Functions ============
    
    /**
     * @notice Verifies a zero-knowledge proof and returns true/false
     * @dev The proof must verify:
     *      1. Valid signature from trusted Issuer A on DOB credential
     *      2. Valid signature from trusted Issuer B on citizenship credential
     *      3. Age >= minAge
     *      4. Citizenship == requiredCitizenship
     *      5. Both credentials belong to the same user
     * 
     * @param a Proof component a (G1 point)
     * @param b Proof component b (G2 point)
     * @param c Proof component c (G1 point)
     * @param input Public inputs to the circuit:
     *        [0] = current_date
     *        [1] = min_age
     *        [2] = required_citizenship
     *        [3] = issuer_a_pubkey_x
     *        [4] = issuer_a_pubkey_y
     *        [5] = issuer_b_pubkey_x
     *        [6] = issuer_b_pubkey_y
     *        [7] = user_pubkey
     *        [8] = subject_wallet (uint160)
     */
    function verifyProof(
        uint[2] memory a,
        uint[2][2] memory b,
        uint[2] memory c,
        uint[9] memory input
    ) external view returns (bool) {
        // Verify the zk-SNARK proof
        if (!verifier.verifyProof(a, b, c, input)) {
            return false;
        }
        
        // Extract public inputs
        uint256 currentDate = input[0];
        uint256 proofMinAge = input[1];
        uint256 proofCitizenship = input[2];
        uint256 issuerAPubkeyX = input[3];
        uint256 issuerAPubkeyY = input[4];
        uint256 issuerBPubkeyX = input[5];
        uint256 issuerBPubkeyY = input[6];
        uint256 userPubkey = input[7];
        uint256 subjectWallet = input[8];
        
        // Verify current date is reasonable (within last year and next year)
        // This prevents using old proofs
        uint256 currentTime = block.timestamp;
        if (currentDate < currentTime - 365 days || currentDate > currentTime + 365 days) {
            return false;
        }
        
        // Verify minimum age matches contract requirement
        if (proofMinAge != minAge) {
            return false;
        }
        
        // Verify citizenship matches contract requirement
        if (proofCitizenship != requiredCitizenship) {
            return false;
        }
        
        // Verify Issuer A is trusted
        bytes32 issuerAHash = keccak256(abi.encodePacked(issuerAPubkeyX, issuerAPubkeyY));
        if (!trustedIssuerA[issuerAHash]) {
            return false;
        }
        
        // Verify Issuer B is trusted
        bytes32 issuerBHash = keccak256(abi.encodePacked(issuerBPubkeyX, issuerBPubkeyY));
        if (!trustedIssuerB[issuerBHash]) {
            return false;
        }

        // Verify subject wallet matches the transaction sender
        if (subjectWallet != uint256(uint160(msg.sender))) {
            return false;
        }

        // Optional sanity check for circuit-consistent binding
        if (userPubkey != subjectWallet) {
            return false;
        }

        return true;
    }
    
    // ============ Owner Functions ============
    
    /**
     * @notice Add a trusted Issuer A (DOB issuer)
     * @param issuerPubkeyX X coordinate of issuer's public key
     * @param issuerPubkeyY Y coordinate of issuer's public key
     */
    function addTrustedIssuerA(
        uint256 issuerPubkeyX,
        uint256 issuerPubkeyY
    ) external onlyOwner {
        bytes32 issuerHash = keccak256(abi.encodePacked(issuerPubkeyX, issuerPubkeyY));
        trustedIssuerA[issuerHash] = true;
        emit TrustedIssuerAdded(issuerHash, true);
    }
    
    /**
     * @notice Add a trusted Issuer B (citizenship issuer)
     * @param issuerPubkeyX X coordinate of issuer's public key
     * @param issuerPubkeyY Y coordinate of issuer's public key
     */
    function addTrustedIssuerB(
        uint256 issuerPubkeyX,
        uint256 issuerPubkeyY
    ) external onlyOwner {
        bytes32 issuerHash = keccak256(abi.encodePacked(issuerPubkeyX, issuerPubkeyY));
        trustedIssuerB[issuerHash] = true;
        emit TrustedIssuerAdded(issuerHash, false);
    }
    
    /**
     * @notice Remove a trusted Issuer A
     * @param issuerPubkeyX X coordinate of issuer's public key
     * @param issuerPubkeyY Y coordinate of issuer's public key
     */
    function removeTrustedIssuerA(
        uint256 issuerPubkeyX,
        uint256 issuerPubkeyY
    ) external onlyOwner {
        bytes32 issuerHash = keccak256(abi.encodePacked(issuerPubkeyX, issuerPubkeyY));
        trustedIssuerA[issuerHash] = false;
        emit TrustedIssuerRemoved(issuerHash, true);
    }
    
    /**
     * @notice Remove a trusted Issuer B
     * @param issuerPubkeyX X coordinate of issuer's public key
     * @param issuerPubkeyY Y coordinate of issuer's public key
     */
    function removeTrustedIssuerB(
        uint256 issuerPubkeyX,
        uint256 issuerPubkeyY
    ) external onlyOwner {
        bytes32 issuerHash = keccak256(abi.encodePacked(issuerPubkeyX, issuerPubkeyY));
        trustedIssuerB[issuerHash] = false;
        emit TrustedIssuerRemoved(issuerHash, false);
    }
    
    
    /**
     * @notice Update minimum age requirement
     * @param _minAge New minimum age requirement
     */
    function setMinAge(uint256 _minAge) external onlyOwner {
        minAge = _minAge;
    }
    
    /**
     * @notice Update required citizenship
     * @param _requiredCitizenship New required citizenship (encoded as field element)
     */
    function setRequiredCitizenship(uint256 _requiredCitizenship) external onlyOwner {
        requiredCitizenship = _requiredCitizenship;
    }
    
    /**
     * @notice Transfer ownership of the contract
     * @param newOwner Address of the new owner
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "AgeVerification: new owner is zero address");
        owner = newOwner;
    }
}
