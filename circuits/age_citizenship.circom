pragma circom 2.0.0;

// Main circuit for age and citizenship verification
// Verifies that a user is 18+ years old and a US citizen
// without revealing their actual date of birth or other personal information

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";
include "./utils/ecdsa_verify.circom";

template AgeAndCitizenshipVerifier() {
    // ========== PRIVATE INPUTS ==========
    // These values are hidden in the proof
    signal input date_of_birth;        // Date of birth (Unix timestamp)
    signal input citizenship;         // Citizenship string (encoded as field element)
    signal input signature_a_r;       // Issuer A signature r component
    signal input signature_a_s;       // Issuer A signature s component
    signal input signature_b_r;       // Issuer B signature r component
    signal input signature_b_s;       // Issuer B signature s component
    signal input nonce_a;             // Nonce for credential A
    signal input nonce_b;             // Nonce for credential B
    
    // ========== PUBLIC INPUTS ==========
    // These values are visible in the proof (declared as public in main component)
    signal input current_date;         // Current date (Unix timestamp)
    signal input min_age;              // Minimum required age (18)
    signal input required_citizenship; // Required citizenship (US, encoded)
    signal input issuer_a_pubkey_x;    // Issuer A public key x coordinate
    signal input issuer_a_pubkey_y;    // Issuer A public key y coordinate
    signal input issuer_b_pubkey_x;    // Issuer B public key x coordinate
    signal input issuer_b_pubkey_y;    // Issuer B public key y coordinate
    signal input user_pubkey;          // User's public key (for credential binding)
    signal input subject_wallet;       // Wallet address (uint160) bound to the proof
    
    // ========== INTERMEDIATE SIGNALS ==========
    signal age_in_seconds;
    signal age_in_years;
    
    // ========== VERIFY ISSUER A SIGNATURE (DOB Credential) ==========
    // Create credential message: Poseidon hash of (dob, user_pubkey, nonce_a)
    component poseidon_dob = Poseidon(3);
    poseidon_dob.inputs[0] <== date_of_birth;
    poseidon_dob.inputs[1] <== user_pubkey;
    poseidon_dob.inputs[2] <== nonce_a;
    
    // Verify Issuer A's signature
    component verify_a = ECDSAVerify();
    verify_a.message <== poseidon_dob.out;
    verify_a.pubkey[0] <== issuer_a_pubkey_x;
    verify_a.pubkey[1] <== issuer_a_pubkey_y;
    verify_a.signature_r <== signature_a_r;
    verify_a.signature_s <== signature_a_s;
    
    // ========== VERIFY ISSUER B SIGNATURE (Citizenship Credential) ==========
    // Create credential message: Poseidon hash of (citizenship, user_pubkey, nonce_b)
    component poseidon_citizenship = Poseidon(3);
    poseidon_citizenship.inputs[0] <== citizenship;
    poseidon_citizenship.inputs[1] <== user_pubkey;
    poseidon_citizenship.inputs[2] <== nonce_b;
    
    // Verify Issuer B's signature
    component verify_b = ECDSAVerify();
    verify_b.message <== poseidon_citizenship.out;
    verify_b.pubkey[0] <== issuer_b_pubkey_x;
    verify_b.pubkey[1] <== issuer_b_pubkey_y;
    verify_b.signature_r <== signature_b_r;
    verify_b.signature_s <== signature_b_s;
    
    // ========== VERIFY AGE >= 18 ==========
    // Calculate age in seconds
    age_in_seconds <== current_date - date_of_birth;
    
    // Convert to years (approximate: 365.25 days per year)
    // age_in_years = age_in_seconds / (365.25 * 24 * 60 * 60)
    // Using integer division: age_in_years = age_in_seconds / 31557600
    component age_div = DivMod(64);
    age_div.in[0] <== age_in_seconds;
    age_div.in[1] <== 31557600; // Seconds in a year (365.25 days)
    age_in_years <== age_div.out[0];
    
    // Check age >= min_age using LessThan comparator
    // LessThan(a, b) returns 1 if a < b, so we check if min_age < age_in_years + 1
    component age_check = LessThan(64);
    age_check.in[0] <== min_age;
    age_check.in[1] <== age_in_years + 1;
    // age_check.out should be 1 if min_age < age_in_years + 1, meaning age_in_years >= min_age
    
    // ========== VERIFY WALLET BINDING ==========
    // Ensure the proof is tied to the submitting wallet address
    user_pubkey === subject_wallet;

    // ========== VERIFY CITIZENSHIP == "US" ==========
    component citizenship_check = IsEqual();
    citizenship_check.in[0] <== citizenship;
    citizenship_check.in[1] <== required_citizenship;
    
    // ========== FINAL CONSTRAINTS ==========
    // All checks must pass:
    // 1. Issuer A signature is valid
    // 2. Issuer B signature is valid
    // 3. Age >= min_age
    // 4. Citizenship matches required value
    
    // Combine all checks (all must be 1)
    // Must split into quadratic constraints (max degree 2)
    signal sig_checks;
    signal age_cit_checks;
    signal all_checks_passed;

    sig_checks <== verify_a.valid * verify_b.valid;
    age_cit_checks <== age_check.out * citizenship_check.out;
    all_checks_passed <== sig_checks * age_cit_checks;
    
    // Constraint: all checks must pass
    all_checks_passed === 1;
}

// Helper template for division with remainder
template DivMod(n) {
    signal input in[2];
    signal output out[2];
    
    signal q;
    signal r;
    
    q <-- in[0] \ in[1];
    r <-- in[0] % in[1];
    
    out[0] <== q;
    out[1] <== r;
    
    // Verify: in[0] = q * in[1] + r
    in[0] === q * in[1] + r;
}

// Note: IsEqual and IsZero are provided by circomlib/circuits/comparators.circom

component main {public [current_date, min_age, required_citizenship, issuer_a_pubkey_x, issuer_a_pubkey_y, issuer_b_pubkey_x, issuer_b_pubkey_y, user_pubkey, subject_wallet]} = AgeAndCitizenshipVerifier();
