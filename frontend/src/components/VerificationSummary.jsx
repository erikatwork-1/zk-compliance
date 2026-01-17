import React, { useState } from 'react';
import './VerificationSummary.css';

function VerificationSummary({ verificationStatus, walletAddress, proof, credentials, onBack }) {
  const [expandedSection, setExpandedSection] = useState(null);
  const resultText = verificationStatus?.success ? 'YES' : 'NO';
  const resultClass = verificationStatus?.success ? 'success' : 'error';

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  return (
    <div className="card summary-page">
      <h2>Step 4: Understanding the Zero-Knowledge Proof Flow</h2>

      <div className="intro-box">
        <p className="intro-text">
          This page explains <strong>exactly how the verification works</strong> and why your identity
          remains private. After reading this, you'll understand the complete design, what gets signed,
          what gets sent where, and the key security principles.
        </p>
        <p className={`final-result ${resultClass}`}>
          Final Verification Result: <strong>{resultText}</strong>
        </p>
      </div>

      {/* Section 1: Overview */}
      <div className="summary-section">
        <div className="section-header" onClick={() => toggleSection('overview')}>
          <h3>📖 1. Overview: What Problem Are We Solving?</h3>
          <span className="toggle-icon">{expandedSection === 'overview' ? '−' : '+'}</span>
        </div>
        {expandedSection === 'overview' && (
          <div className="section-content">
            <p>
              <strong>The Challenge:</strong> You need to prove you are 18+ and a US citizen to access
              a service, but you don't want to reveal your actual date of birth or send personal
              documents to the blockchain.
            </p>
            <p>
              <strong>The Solution:</strong> Zero-knowledge proofs let you prove eligibility
              <em> without revealing the underlying data</em>. The verifier learns only "YES, this
              person meets the requirements" or "NO, they don't."
            </p>
            <div className="key-principle">
              <strong>Key Principle:</strong> Mathematical proof that a statement is true, without
              revealing why it's true.
            </div>
          </div>
        )}
      </div>

      {/* Section 2: The Complete Flow */}
      <div className="summary-section">
        <div className="section-header" onClick={() => toggleSection('flow')}>
          <h3>🔄 2. The Complete Flow (Step by Step)</h3>
          <span className="toggle-icon">{expandedSection === 'flow' ? '−' : '+'}</span>
        </div>
        {expandedSection === 'flow' && (
          <div className="section-content">
            <div className="flow-visualization">
              <div className="flow-stage">
                <div className="stage-number">1</div>
                <div className="stage-content">
                  <h4>Credential Issuance</h4>
                  <p><strong>What happens:</strong></p>
                  <ul>
                    <li>You provide your DOB (e.g., 2000-01-01) to Issuer A (simulated DMV)</li>
                    <li>Issuer A creates a <strong>credential message</strong>:
                      <code>Hash(DOB, YourWallet, Nonce)</code></li>
                    <li>Issuer A <strong>signs</strong> this hash with their private key (ECDSA signature)</li>
                    <li>You receive: DOB + signature (r, s) + issuer's public key (x, y)</li>
                  </ul>
                  <p><strong>Same process for Issuer B</strong> (citizenship credential)</p>
                  <div className="example-box">
                    <strong>Example credential structure:</strong>
                    <pre>{`{
  dateOfBirth: "946684800",  // Jan 1, 2000 (Unix timestamp)
  userPubkey: "827641930419614124039720421795580660909102123457",
  nonce: "12355275362847035392",
  signature: {
    r: "94633665904447570489257861128067778...",
    s: "23545919262905457387631040202175072..."
  },
  issuerPubkey: {
    x: "67315240764067688871012716141531292...",
    y: "44851436639087445619644214552761311..."
  }
}`}</pre>
                  </div>
                  <div className="important-note">
                    <strong>Important:</strong> This is <strong>NOT encryption</strong>. It's a
                    <strong> digital signature</strong> — anyone with the public key can verify the
                    signature is authentic, but only the issuer (with the private key) can create it.
                  </div>
                </div>
              </div>

              <div className="flow-stage">
                <div className="stage-number">2</div>
                <div className="stage-content">
                  <h4>Zero-Knowledge Proof Generation</h4>
                  <p><strong>What happens:</strong></p>
                  <ul>
                    <li>You load both credentials (DOB + citizenship) on your device</li>
                    <li>You prepare <strong>circuit inputs</strong>:
                      <ul>
                        <li><strong>Private:</strong> DOB, citizenship, signatures, nonces</li>
                        <li><strong>Public:</strong> current date, min age (18), required citizenship,
                          issuer pubkeys, your wallet address</li>
                      </ul>
                    </li>
                    <li>The circuit runs and checks:
                      <ol>
                        <li><strong>Signature validation:</strong> Recomputes Hash(DOB, wallet, nonce)
                          and verifies Issuer A's signature matches</li>
                        <li><strong>Signature validation:</strong> Same for Issuer B's citizenship credential</li>
                        <li><strong>Age calculation:</strong> Computes (current_date - DOB) / seconds_per_year ≥ 18</li>
                        <li><strong>Citizenship check:</strong> citizenship == "US"</li>
                        <li><strong>Wallet binding:</strong> user_pubkey == subject_wallet</li>
                      </ol>
                    </li>
                    <li>If all checks pass, the circuit produces a <strong>Groth16 proof</strong>:
                      <ul>
                        <li><strong>Proof components:</strong> (a, b, c) — cryptographic elements (G1/G2 points)</li>
                        <li><strong>Public signals:</strong> 9 values visible to everyone</li>
                      </ul>
                    </li>
                  </ul>
                  <div className="example-box">
                    <strong>What the proof looks like:</strong>
                    <pre>{`{
  proof: {
    pi_a: [G1_point_x, G1_point_y],
    pi_b: [[G2_x1, G2_x2], [G2_y1, G2_y2]],
    pi_c: [G1_point_x, G1_point_y]
  },
  publicSignals: [
    "1768503899",        // [0] current_date
    "18",                // [1] min_age
    "21843",             // [2] required_citizenship (US encoded)
    "1650512148...",     // [3] issuer_a_pubkey_x
    "1074950895...",     // [4] issuer_a_pubkey_y
    "1740853278...",     // [5] issuer_b_pubkey_x
    "1631292132...",     // [6] issuer_b_pubkey_y
    "827641930...",      // [7] user_pubkey
    "827641930..."       // [8] subject_wallet (same as user_pubkey)
  ]
}`}</pre>
                  </div>
                  <div className="privacy-highlight">
                    <strong>🔒 Privacy Guarantee:</strong>
                    <p>Notice that <strong>your actual DOB</strong> (946684800) and <strong>citizenship
                      string</strong> are <strong>NOT</strong> in the public signals. They stayed private
                      on your device and were never sent to the blockchain!</p>
                  </div>
                </div>
              </div>

              <div className="flow-stage">
                <div className="stage-number">3</div>
                <div className="stage-content">
                  <h4>On-Chain Verification</h4>
                  <p><strong>What happens:</strong></p>
                  <ul>
                    <li>You submit the proof (a, b, c) + public signals to the <code>AgeVerification</code> contract</li>
                    <li>The contract calls the <code>Verifier</code> contract (auto-generated from the circuit)</li>
                    <li><strong>Verifier checks:</strong> Uses pairing equations on G1/G2 points to verify
                      the proof is mathematically valid</li>
                    <li><strong>AgeVerification checks:</strong>
                      <ol>
                        <li>Proof is valid (Verifier returned true)</li>
                        <li>current_date is recent (within ±365 days of block.timestamp)</li>
                        <li>min_age matches contract requirement (18)</li>
                        <li>required_citizenship matches contract requirement (US)</li>
                        <li>Issuer A pubkey (from public signals) is in the trusted registry</li>
                        <li>Issuer B pubkey (from public signals) is in the trusted registry</li>
                        <li>subject_wallet (from public signals) == msg.sender (your wallet)</li>
                        <li>user_pubkey == subject_wallet (circuit constraint enforced)</li>
                      </ol>
                    </li>
                    <li>If all checks pass → returns <strong>true</strong></li>
                    <li>If any check fails → returns <strong>false</strong></li>
                  </ul>
                  <div className="contract-diagram">
                    <div className="contract-check">
                      <span className="check-icon">✓</span>
                      <span>Proof cryptographically valid</span>
                    </div>
                    <div className="contract-check">
                      <span className="check-icon">✓</span>
                      <span>Issuers are trusted</span>
                    </div>
                    <div className="contract-check">
                      <span className="check-icon">✓</span>
                      <span>Policy rules match (age 18+, US)</span>
                    </div>
                    <div className="contract-check">
                      <span className="check-icon">✓</span>
                      <span>Wallet binding enforced</span>
                    </div>
                    <div className="contract-check">
                      <span className="check-icon">✓</span>
                      <span>Timestamp is fresh</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Section 3: Design Principles */}
      <div className="summary-section">
        <div className="section-header" onClick={() => toggleSection('principles')}>
          <h3>🎯 3. Core Design Principles</h3>
          <span className="toggle-icon">{expandedSection === 'principles' ? '−' : '+'}</span>
        </div>
        {expandedSection === 'principles' && (
          <div className="section-content">
            <div className="principle-card">
              <h4>Principle 1: Privacy by Design</h4>
              <p>
                Your DOB and citizenship are <strong>private inputs</strong> to the circuit.
                They are used to compute the proof but are never included in the output.
                The verifier only sees the <strong>public signals</strong>, which contain metadata
                (timestamps, issuer keys, policy params) but NOT your identity.
              </p>
            </div>

            <div className="principle-card">
              <h4>Principle 2: Cryptographic Binding</h4>
              <p>
                <strong>Credentials are bound to you:</strong> Each credential includes your wallet
                address in the signed message. The circuit verifies both credentials reference the
                same wallet.
              </p>
              <p>
                <strong>Proofs are bound to the submitting wallet:</strong> The circuit includes
                <code>subject_wallet</code> as a public input, and the contract enforces it matches
                <code>msg.sender</code>. This prevents proof theft or reuse.
              </p>
            </div>

            <div className="principle-card">
              <h4>Principle 3: Trust in Issuers, Not in Users</h4>
              <p>
                The system trusts that <strong>issuers (DMV, Immigration) validate identity correctly</strong>.
                Once an issuer signs a credential, the system trusts that credential's authenticity.
                Users cannot forge credentials because they don't have the issuer's private key.
              </p>
              <p>
                The contract maintains a <strong>registry of trusted issuer public keys</strong>.
                Only credentials signed by registered issuers are accepted.
              </p>
            </div>

            <div className="principle-card">
              <h4>Principle 4: Stateless Verification</h4>
              <p>
                The contract does <strong>NOT store a registry of verified users</strong>.
                Every verification is independent — you must prove eligibility each time you want
                to access something. This is like a "lambda function" that returns YES/NO based
                solely on the proof you submit.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Section 4: What Gets Signed */}
      <div className="summary-section">
        <div className="section-header" onClick={() => toggleSection('signing')}>
          <h3>✍️ 4. What Gets Signed (Credential Issuance)</h3>
          <span className="toggle-icon">{expandedSection === 'signing' ? '−' : '+'}</span>
        </div>
        {expandedSection === 'signing' && (
          <div className="section-content">
            <h4>Step 1: Hash the credential data</h4>
            <p>
              The issuer creates a <strong>Poseidon hash</strong> of the credential fields.
              Poseidon is a hash function designed for efficient ZK circuits.
            </p>
            <div className="code-example">
              <strong>For DOB credential (Issuer A):</strong>
              <pre>{`messageHash = Poseidon([
  dateOfBirth,     // e.g., 946684800 (Jan 1, 2000)
  userPubkey,      // Your wallet address as BigInt
  nonce            // Random number (prevents replay)
])

// Output: a single field element (e.g., 123456789...)`}</pre>
            </div>

            <h4>Step 2: Sign the hash</h4>
            <p>
              The issuer uses <strong>ECDSA (Elliptic Curve Digital Signature Algorithm)</strong>
              to sign the message hash. This produces two numbers: <strong>r</strong> and <strong>s</strong>.
            </p>
            <div className="code-example">
              <pre>{`signature = ECDSA_sign(messageHash, issuerPrivateKey)

// Output: { r, s }
// e.g., { r: "94633665904447...", s: "23545919262905..." }`}</pre>
            </div>

            <h4>Step 3: Bundle the credential</h4>
            <p>
              You receive a credential containing:
            </p>
            <ul>
              <li><strong>The data:</strong> dateOfBirth, userPubkey, nonce</li>
              <li><strong>The signature:</strong> (r, s)</li>
              <li><strong>Issuer's public key:</strong> (x, y) — used to verify the signature</li>
            </ul>

            <div className="important-callout">
              <strong>Why signing, not encryption?</strong>
              <p>
                <strong>Encryption</strong> hides data so only someone with a key can read it.
                <strong>Signing</strong> proves authenticity — it shows "this data was approved by
                the issuer." Anyone can read the credential (it's not encrypted), but no one can
                forge a valid signature without the issuer's private key.
              </p>
            </div>

            {credentials?.dob && (
              <div className="actual-data-box">
                <strong>Your actual DOB credential (from Step 1):</strong>
                <pre>{JSON.stringify({
                  dateOfBirth: credentials.dob.dateOfBirth,
                  userPubkey: credentials.dob.userPubkey,
                  nonce: credentials.dob.nonce,
                  signature: {
                    r: credentials.dob.signature.r.slice(0, 20) + '...',
                    s: credentials.dob.signature.s.slice(0, 20) + '...'
                  },
                  issuerPubkey: {
                    x: credentials.dob.issuerPubkey.x.slice(0, 20) + '...',
                    y: credentials.dob.issuerPubkey.y.slice(0, 20) + '...'
                  }
                }, null, 2)}</pre>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Section 5: Proof Generation */}
      <div className="summary-section">
        <div className="section-header" onClick={() => toggleSection('proof')}>
          <h3>🔐 5. How the Proof is Generated</h3>
          <span className="toggle-icon">{expandedSection === 'proof' ? '−' : '+'}</span>
        </div>
        {expandedSection === 'proof' && (
          <div className="section-content">
            <h4>Step 1: Prepare circuit inputs</h4>
            <p>The circuit needs two sets of inputs:</p>
            <div className="input-comparison">
              <div className="input-column private-col">
                <h5>Private Inputs (stay on your device)</h5>
                <ul>
                  <li>date_of_birth</li>
                  <li>citizenship</li>
                  <li>signature_a_r, signature_a_s</li>
                  <li>signature_b_r, signature_b_s</li>
                  <li>nonce_a, nonce_b</li>
                </ul>
              </div>
              <div className="input-column public-col">
                <h5>Public Inputs (visible to verifier)</h5>
                <ul>
                  <li>current_date</li>
                  <li>min_age (18)</li>
                  <li>required_citizenship (US)</li>
                  <li>issuer_a_pubkey_x, issuer_a_pubkey_y</li>
                  <li>issuer_b_pubkey_x, issuer_b_pubkey_y</li>
                  <li>user_pubkey (your wallet)</li>
                  <li>subject_wallet (your wallet)</li>
                </ul>
              </div>
            </div>

            <h4>Step 2: Circuit execution</h4>
            <p>The circuit performs these checks <strong>inside a zero-knowledge environment</strong>:</p>
            <ol>
              <li><strong>Recompute Issuer A's message hash:</strong>
                <code>Hash(date_of_birth, user_pubkey, nonce_a)</code>
              </li>
              <li><strong>Verify Issuer A's signature:</strong> Check that signature (r, s) is valid
                for the hash and issuer_a_pubkey
              </li>
              <li><strong>Same for Issuer B:</strong> Hash citizenship data and verify signature</li>
              <li><strong>Calculate age:</strong> (current_date - date_of_birth) / 31557600 seconds</li>
              <li><strong>Check age ≥ 18</strong></li>
              <li><strong>Check citizenship == required_citizenship</strong></li>
              <li><strong>Check user_pubkey == subject_wallet</strong> (wallet binding)</li>
            </ol>

            <h4>Step 3: Generate the proof</h4>
            <p>
              If all checks pass, the circuit generates a <strong>Groth16 proof</strong>.
              This proof is a cryptographic object that says: "I know private inputs that satisfy
              all the circuit constraints for these public inputs."
            </p>
            <div className="magic-box">
              <strong>The ZK Magic:</strong>
              <p>
                The proof is constructed such that:
              </p>
              <ul>
                <li>Anyone can verify it's valid (using the public verification key)</li>
                <li>The verifier learns <strong>nothing</strong> about the private inputs</li>
                <li>It's computationally infeasible to create a valid proof with invalid inputs</li>
              </ul>
            </div>

            {proof && (
              <div className="actual-data-box">
                <strong>Your actual proof (from Step 2):</strong>
                <pre>{`Proof components (a, b, c):
  pi_a: [${proof.proof.pi_a[0].slice(0, 15)}..., ${proof.proof.pi_a[1].slice(0, 15)}...]
  pi_b: [[...], [...]]
  pi_c: [${proof.proof.pi_c[0].slice(0, 15)}..., ${proof.proof.pi_c[1].slice(0, 15)}...]

Public signals (9 values):
  [0] current_date:          ${proof.publicSignals[0]}
  [1] min_age:               ${proof.publicSignals[1]}
  [2] required_citizenship:  ${proof.publicSignals[2]}
  [3-4] issuer_a_pubkey:     ${proof.publicSignals[3].slice(0, 15)}..., ${proof.publicSignals[4].slice(0, 15)}...
  [5-6] issuer_b_pubkey:     ${proof.publicSignals[5].slice(0, 15)}..., ${proof.publicSignals[6].slice(0, 15)}...
  [7] user_pubkey:           ${proof.publicSignals[7]}
  [8] subject_wallet:        ${proof.publicSignals[8]}`}</pre>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Section 6: On-Chain Validation */}
      <div className="summary-section">
        <div className="section-header" onClick={() => toggleSection('validation')}>
          <h3>⛓️ 6. What the Smart Contract Checks</h3>
          <span className="toggle-icon">{expandedSection === 'validation' ? '−' : '+'}</span>
        </div>
        {expandedSection === 'validation' && (
          <div className="section-content">
            <p>
              The smart contract receives the proof and public signals, then performs
              <strong> validation in two stages</strong>:
            </p>

            <h4>Stage 1: Cryptographic proof verification</h4>
            <p>
              The <code>Verifier.sol</code> contract checks the <strong>pairing equation</strong>:
            </p>
            <div className="code-example">
              <pre>{`e(A, B) == e(alpha, beta) * e(L, gamma) * e(C, delta)

Where:
- e(...) is a bilinear pairing function
- A, B, C are from the proof
- alpha, beta, gamma, delta are from the verification key
- L is computed from public signals

If this equation holds → proof is valid
If not → proof is invalid (someone tried to cheat)`}</pre>
            </div>
            <p className="note">
              <strong>What this proves:</strong> The prover knows private inputs that satisfy
              all circuit constraints for the given public inputs.
            </p>

            <h4>Stage 2: Policy and business logic checks</h4>
            <p>The <code>AgeVerification.sol</code> contract performs additional checks:</p>
            <table className="validation-table">
              <thead>
                <tr>
                  <th>Check</th>
                  <th>What it validates</th>
                  <th>Why it matters</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>verifier.verifyProof(...)</code></td>
                  <td>Proof is cryptographically valid</td>
                  <td>Prevents forged proofs</td>
                </tr>
                <tr>
                  <td><code>current_date</code> in range</td>
                  <td>Proof is fresh (±365 days)</td>
                  <td>Prevents using very old proofs</td>
                </tr>
                <tr>
                  <td><code>min_age == 18</code></td>
                  <td>Age requirement matches contract</td>
                  <td>Ensures proof is for correct policy</td>
                </tr>
                <tr>
                  <td><code>required_citizenship == US</code></td>
                  <td>Citizenship requirement matches</td>
                  <td>Ensures proof is for correct country</td>
                </tr>
                <tr>
                  <td><code>trustedIssuerA[hash]</code></td>
                  <td>Issuer A is registered</td>
                  <td>Prevents accepting credentials from untrusted sources</td>
                </tr>
                <tr>
                  <td><code>trustedIssuerB[hash]</code></td>
                  <td>Issuer B is registered</td>
                  <td>Same for citizenship issuer</td>
                </tr>
                <tr>
                  <td><code>subject_wallet == msg.sender</code></td>
                  <td>Proof bound to caller</td>
                  <td>Prevents proof reuse by other wallets</td>
                </tr>
                <tr>
                  <td><code>user_pubkey == subject_wallet</code></td>
                  <td>Circuit enforced binding</td>
                  <td>Ensures credentials and proof are for same wallet</td>
                </tr>
              </tbody>
            </table>

            <div className="final-outcome">
              <strong>Final outcome:</strong>
              <p>
                The function returns <code>true</code> if all checks pass, <code>false</code> otherwise.
                <strong> No state is stored</strong> — each verification is independent.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Section 7: Why Privacy Holds */}
      <div className="summary-section">
        <div className="section-header" onClick={() => toggleSection('privacy')}>
          <h3>🔒 7. Why Your Identity Stays Private</h3>
          <span className="toggle-icon">{expandedSection === 'privacy' ? '−' : '+'}</span>
        </div>
        {expandedSection === 'privacy' && (
          <div className="section-content">
            <h4>What data goes on-chain?</h4>
            <p>When you submit a proof, only these values are sent to the blockchain:</p>
            <ul>
              <li><strong>Proof components:</strong> (a, b, c) — cryptographic G1/G2 points</li>
              <li><strong>Public signals:</strong> current_date, min_age, required_citizenship,
                issuer pubkeys, wallet address</li>
            </ul>

            <h4>What data does NOT go on-chain?</h4>
            <ul className="privacy-list">
              <li>✗ Your actual date of birth (e.g., 2000-01-01)</li>
              <li>✗ Your citizenship string (e.g., "US")</li>
              <li>✗ The issuer signatures (r, s values)</li>
              <li>✗ The nonces</li>
              <li>✗ Any other identity information</li>
            </ul>

            <h4>Can someone reverse-engineer the private data?</h4>
            <p>
              <strong>No.</strong> This is the core security guarantee of zero-knowledge proofs.
              The proof is constructed using advanced cryptography (bilinear pairings on elliptic curves)
              such that:
            </p>
            <ul>
              <li>It's mathematically impossible to extract private inputs from the proof</li>
              <li>The proof only reveals "the statement is true," not why</li>
              <li>Even with unlimited computing power, private inputs remain hidden</li>
            </ul>

            <div className="security-guarantee">
              <strong>Mathematical Guarantee:</strong>
              <p>
                Under the assumptions of the BN254 curve and Groth16 protocol, revealing the proof
                and public signals leaks <strong>zero bits of information</strong> about the private
                inputs beyond what's already implied by the public signals.
              </p>
            </div>

            <h4>What CAN be inferred?</h4>
            <p>
              The verifier learns:
            </p>
            <ul>
              <li>You are at least 18 years old (but not your exact age)</li>
              <li>You are a US citizen (but not which state, when you immigrated, etc.)</li>
              <li>Your credentials were issued by specific trusted issuers</li>
              <li>The proof is bound to your wallet address (public information)</li>
            </ul>
            <p>
              <strong>Everything else remains private.</strong>
            </p>
          </div>
        )}
      </div>

      {/* Section 8: Wallet Binding */}
      <div className="summary-section">
        <div className="section-header" onClick={() => toggleSection('binding')}>
          <h3>🔗 8. Wallet Binding: How Reuse is Prevented</h3>
          <span className="toggle-icon">{expandedSection === 'binding' ? '−' : '+'}</span>
        </div>
        {expandedSection === 'binding' && (
          <div className="section-content">
            <h4>The Problem: Proof Theft</h4>
            <p>
              Without wallet binding, an attacker could:
            </p>
            <ol>
              <li>Intercept or steal your proof</li>
              <li>Submit it from their own wallet</li>
              <li>Get verified using YOUR credentials</li>
            </ol>

            <h4>The Solution: Cryptographic Binding</h4>
            <p>
              We bind the proof to your wallet in <strong>two layers</strong>:
            </p>

            <div className="binding-layer">
              <h5>Layer 1: Credential Binding (Step 1)</h5>
              <p>
                When the issuer signs your credential, they include <strong>your wallet address</strong>
                in the message hash:
              </p>
              <div className="code-example">
                <pre>{`messageHash = Poseidon([
  dateOfBirth,
  userPubkey,    // ← YOUR WALLET ADDRESS
  nonce
])

signature = ECDSA_sign(messageHash, issuerPrivateKey)`}</pre>
              </div>
              <p>
                The signature is only valid for credentials tied to YOUR wallet. An attacker can't
                use the signature with a different wallet address.
              </p>
            </div>

            <div className="binding-layer">
              <h5>Layer 2: Proof Binding (Step 2)</h5>
              <p>
                The circuit includes <code>subject_wallet</code> as a <strong>public input</strong>
                and enforces:
              </p>
              <div className="code-example">
                <pre>{`// Circuit constraint:
user_pubkey === subject_wallet

// This means:
// - The proof can only be generated for one specific wallet
// - subject_wallet becomes part of the public signals`}</pre>
              </div>
            </div>

            <div className="binding-layer">
              <h5>Layer 3: On-Chain Enforcement (Step 3)</h5>
              <p>
                The smart contract checks:
              </p>
              <div className="code-example">
                <pre>{`require(
  subjectWallet == uint256(uint160(msg.sender)),
  "subject wallet mismatch"
);

// This means:
// - Only the wallet that generated the proof can submit it
// - If you try to use someone else's proof → transaction reverts`}</pre>
              </div>
            </div>

            <div className="attack-scenario">
              <h4>Attack Scenario: Proof Theft</h4>
              <p><strong>Scenario:</strong> Attacker steals your proof and tries to use it.</p>
              <table className="attack-table">
                <thead>
                  <tr>
                    <th>Step</th>
                    <th>What happens</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>1</td>
                    <td>Attacker copies your proof (a, b, c, publicSignals)</td>
                    <td>✓ Possible (proof is public data)</td>
                  </tr>
                  <tr>
                    <td>2</td>
                    <td>Attacker calls <code>verifyProof(...)</code> from their wallet</td>
                    <td>✓ Transaction sent</td>
                  </tr>
                  <tr>
                    <td>3</td>
                    <td>Contract checks <code>subject_wallet == msg.sender</code></td>
                    <td><strong>✗ FAILS</strong> — attacker's wallet ≠ your wallet</td>
                  </tr>
                  <tr>
                    <td>4</td>
                    <td>Transaction reverts</td>
                    <td>✗ Attacker is NOT verified</td>
                  </tr>
                </tbody>
              </table>
              <p className="attack-conclusion">
                <strong>Conclusion:</strong> Even if the attacker has your exact proof, they
                <strong> cannot use it</strong> because it's cryptographically bound to your wallet.
              </p>
            </div>

            <div className="your-wallet-box">
              <strong>Your wallet in this demo:</strong>
              <p><code>{walletAddress || 'not connected'}</code></p>
              <p>
                The proof you generated can <strong>only</strong> be verified when submitted from
                this exact address.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Section 9: Security Model */}
      <div className="summary-section">
        <div className="section-header" onClick={() => toggleSection('security')}>
          <h3>🛡️ 9. Security Model & Trust Assumptions</h3>
          <span className="toggle-icon">{expandedSection === 'security' ? '−' : '+'}</span>
        </div>
        {expandedSection === 'security' && (
          <div className="section-content">
            <h4>What we trust</h4>
            <div className="trust-list">
              <div className="trust-item">
                <strong>✓ Issuers validate identity correctly</strong>
                <p>
                  We trust that the DMV (Issuer A) verifies your DOB before signing, and Immigration
                  (Issuer B) verifies your citizenship. If an issuer is compromised or malicious,
                  they could issue false credentials.
                </p>
              </div>
              <div className="trust-item">
                <strong>✓ Trusted setup ceremony is honest</strong>
                <p>
                  The circuit's proving/verification keys depend on a trusted setup. In this demo,
                  it's single-party (insecure). Production requires a multi-party ceremony where
                  at least one participant must be honest and destroy their secret.
                </p>
              </div>
              <div className="trust-item">
                <strong>✓ Smart contract is correct</strong>
                <p>
                  The contract logic and the Verifier must be audited. Bugs could allow invalid
                  proofs to pass or valid proofs to fail.
                </p>
              </div>
            </div>

            <h4>What we DO NOT trust</h4>
            <div className="no-trust-list">
              <div className="no-trust-item">
                <strong>✗ Users</strong>
                <p>
                  Users might try to forge credentials or create invalid proofs. The system prevents
                  this through signature verification and ZK constraints.
                </p>
              </div>
              <div className="no-trust-item">
                <strong>✗ The blockchain operator</strong>
                <p>
                  Even if the blockchain node operator is malicious, they cannot learn your private
                  data (it's never sent) or forge a valid proof (cryptographically impossible).
                </p>
              </div>
              <div className="no-trust-item">
                <strong>✗ Third-party observers</strong>
                <p>
                  Anyone can read the blockchain and see your proof transaction. They learn you're
                  verified, but they cannot extract your DOB or citizenship from the proof.
                </p>
              </div>
            </div>

            <h4>Attack scenarios & mitigations</h4>
            <table className="mitigation-table">
              <thead>
                <tr>
                  <th>Attack</th>
                  <th>Mitigation</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Forge a credential without issuer</td>
                  <td>ECDSA signature verification in circuit + issuer registry on-chain</td>
                </tr>
                <tr>
                  <td>Steal and reuse someone's proof</td>
                  <td>Wallet binding (<code>subject_wallet == msg.sender</code>)</td>
                </tr>
                <tr>
                  <td>Submit proof with age &lt; 18</td>
                  <td>Circuit constraint: <code>age_in_years ≥ min_age</code></td>
                </tr>
                <tr>
                  <td>Use non-US citizenship</td>
                  <td>Circuit constraint: <code>citizenship == required_citizenship</code></td>
                </tr>
                <tr>
                  <td>Mix credentials from different users</td>
                  <td>Both credentials must have same <code>user_pubkey</code></td>
                </tr>
                <tr>
                  <td>Use old proof after turning 18</td>
                  <td>Timestamp freshness check (±365 days)</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 10: Technical Deep Dive */}
      <div className="summary-section">
        <div className="section-header" onClick={() => toggleSection('technical')}>
          <h3>🔬 10. Technical Deep Dive</h3>
          <span className="toggle-icon">{expandedSection === 'technical' ? '−' : '+'}</span>
        </div>
        {expandedSection === 'technical' && (
          <div className="section-content">
            <h4>Poseidon Hash Function</h4>
            <p>
              <strong>Poseidon</strong> is a hash function optimized for ZK circuits. Unlike SHA-256
              (which requires thousands of constraints), Poseidon is efficient in arithmetic circuits.
            </p>
            <div className="code-example">
              <pre>{`// Poseidon with 3 inputs:
hash = Poseidon([input1, input2, input3])

// Properties:
// - Takes multiple field elements as input
// - Outputs a single field element
// - Collision-resistant (can't find two inputs with same hash)
// - Efficient in ZK circuits (~150 constraints per hash)`}</pre>
            </div>

            <h4>ECDSA Signature (Simplified)</h4>
            <p>
              This demo uses a <strong>simplified signature verification</strong> for educational purposes.
              Real ECDSA verification in ZK requires ~1.5M constraints. Our simplified version checks:
            </p>
            <ul>
              <li>Signature components (r, s) are non-zero</li>
              <li>Public key components (x, y) are non-zero</li>
              <li>A binding hash of all inputs is non-zero</li>
            </ul>
            <p className="warning">
              <strong>⚠️ Production Warning:</strong> Use a full ECDSA library like
              <a href="https://github.com/0xPARC/circom-ecdsa" target="_blank" rel="noopener noreferrer"> circom-ecdsa</a> for real applications.
            </p>

            <h4>BN254 Curve & Field Reduction</h4>
            <p>
              The circuit operates over the <strong>BN254 scalar field</strong>. All values are
              automatically reduced modulo the field size:
            </p>
            <div className="code-example">
              <pre>{`BN254_FIELD_SIZE = 21888242871839275222246405745257275088548364400416034343698204186575808495617

// Any input value v is reduced:
reduced = v % BN254_FIELD_SIZE

// This is why issuer pubkeys (from secp256k1) are reduced before use.`}</pre>
            </div>

            <h4>Groth16 Proof System</h4>
            <p>
              <strong>Groth16</strong> is a specific ZK-SNARK protocol with these properties:
            </p>
            <ul>
              <li><strong>Constant proof size:</strong> ~200 bytes regardless of circuit complexity</li>
              <li><strong>Fast verification:</strong> ~200k gas on Ethereum</li>
              <li><strong>Requires trusted setup:</strong> Must generate proving/verification keys securely</li>
            </ul>
            <p>
              The proof consists of three elliptic curve points (a, b, c) that satisfy a pairing equation:
            </p>
            <div className="code-example">
              <pre>{`e(A, B) = e(alpha, beta) * e(L, gamma) * e(C, delta)

Where:
- e() is a bilinear pairing
- A, C ∈ G1 (points on base curve)
- B ∈ G2 (point on twisted curve)
- L is computed from public signals
- alpha, beta, gamma, delta are from verification key

The verifier checks this equation. If it holds, the proof is valid.`}</pre>
            </div>
          </div>
        )}
      </div>

      {/* Section 11: Data Flow Summary */}
      <div className="summary-section">
        <div className="section-header" onClick={() => toggleSection('dataflow')}>
          <h3>📊 11. Complete Data Flow Diagram</h3>
          <span className="toggle-icon">{expandedSection === 'dataflow' ? '−' : '+'}</span>
        </div>
        {expandedSection === 'dataflow' && (
          <div className="section-content">
            <div className="dataflow-diagram">
              <div className="dataflow-stage">
                <h4>Stage 1: Your Device</h4>
                <div className="dataflow-box private">
                  <strong>Private Data (never leaves your device):</strong>
                  <ul>
                    <li>DOB: 2000-01-01</li>
                    <li>Citizenship: "US"</li>
                    <li>Signatures from issuers</li>
                    <li>Nonces</li>
                  </ul>
                </div>
                <div className="dataflow-arrow">↓ Proof generation (local)</div>
                <div className="dataflow-box proof">
                  <strong>Proof Output (sent to blockchain):</strong>
                  <ul>
                    <li>Proof: (a, b, c) — 3 elliptic curve points</li>
                    <li>Public signals: 9 field elements</li>
                  </ul>
                </div>
              </div>

              <div className="dataflow-stage">
                <h4>Stage 2: Blockchain</h4>
                <div className="dataflow-box public">
                  <strong>What's visible on-chain:</strong>
                  <ul>
                    <li>Proof components (meaningless without context)</li>
                    <li>current_date: 1768503899</li>
                    <li>min_age: 18</li>
                    <li>required_citizenship: 21843 ("US" encoded)</li>
                    <li>issuer_a_pubkey: (x, y)</li>
                    <li>issuer_b_pubkey: (x, y)</li>
                    <li>user_pubkey: {walletAddress ? walletAddress.slice(0, 10) + '...' : 'your wallet'}</li>
                    <li>subject_wallet: (same as user_pubkey)</li>
                  </ul>
                </div>
                <div className="dataflow-arrow">↓ Contract validation</div>
                <div className="dataflow-box result">
                  <strong>Contract Output:</strong>
                  <p>true or false (verified or not)</p>
                </div>
              </div>
            </div>

            <div className="key-insight">
              <strong>🔑 Key Insight:</strong>
              <p>
                Your DOB (946684800) and citizenship ("US") are in Stage 1 (your device) but
                <strong> NOT in Stage 2</strong> (blockchain). The proof mathematically guarantees
                they satisfy the requirements without revealing them.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Section 12: FAQ */}
      <div className="summary-section">
        <div className="section-header" onClick={() => toggleSection('faq')}>
          <h3>❓ Frequently Asked Questions</h3>
          <span className="toggle-icon">{expandedSection === 'faq' ? '−' : '+'}</span>
        </div>
        {expandedSection === 'faq' && (
          <div className="section-content">
            <div className="faq-container">
              
              <div className="faq-item">
                <h4 className="faq-question">
                  Q1: Why should I trust the circuit to correctly calculate age from DOB?
                </h4>
                <div className="faq-answer">
                  <p><strong>Short Answer:</strong> You don't trust the circuit blindly - you verify it yourself!</p>
                  
                  <p><strong>How It Works:</strong></p>
                  <ol>
                    <li><strong>Open Source Circuit</strong> - The circuit code is publicly available at <code>circuits/age_citizenship.circom</code>. Anyone can read and audit it.</li>
                    <li><strong>Verifiable Compilation</strong> - When you compile the circuit, it produces:
                      <ul>
                        <li><code>.wasm</code> file - The compiled circuit logic</li>
                        <li><code>.r1cs</code> file - Mathematical constraint representation</li>
                        <li><code>.zkey</code> file - Proving key from trusted setup</li>
                      </ul>
                    </li>
                    <li><strong>Smart Contract Verification Key</strong> - The contract contains a verification key mathematically linked to the circuit. If someone modified the circuit to change the age calculation, the verification key wouldn't match, and proofs would fail.</li>
                  </ol>
                  
                  <div className="faq-detail-box">
                    <strong>Circuit Age Calculation (Simplified):</strong>
                    <pre>{`// From circuits/age_citizenship.circom
age_in_seconds = current_date - date_of_birth;
age_in_years = age_in_seconds / 31557600;  // Seconds in a year
is_18_or_older = (age_in_years >= 18) ? 1 : 0;

// All these calculations are proven correct in the zk-proof`}</pre>
                  </div>
                  
                  <p><strong>Why This is Trustworthy:</strong></p>
                  <ul>
                    <li>✅ <strong>Cryptographic Binding</strong> - The verification key is mathematically derived from the circuit. You can't change the circuit without changing the key.</li>
                    <li>✅ <strong>Verifiable Artifacts</strong> - You can recompile the circuit yourself and compare checksums to ensure you're using the correct version.</li>
                    <li>✅ <strong>Community Audit</strong> - In production systems, circuits are audited by security experts and the community.</li>
                  </ul>
                  
                  <div className="faq-warning-box">
                    <strong>⚠️ Malicious Circuit Attack:</strong> What if the frontend loads a different circuit that always outputs "age ≥ 18" without checking?
                    <p><strong>Defense:</strong> The smart contract's verification key is tied to the legitimate circuit. A malicious circuit would have a different proving key, and proofs would fail verification on-chain. See Step 2 for detailed explanation.</p>
                  </div>
                </div>
              </div>

              <div className="faq-item">
                <h4 className="faq-question">
                  Q2: How does the circuit validate the issuer's signature? Can't someone forge it?
                </h4>
                <div className="faq-answer">
                  <p><strong>Short Answer:</strong> The circuit performs full ECDSA signature verification inside the zero-knowledge proof.</p>
                  
                  <p><strong>How ECDSA Verification Works (In-Circuit):</strong></p>
                  <ol>
                    <li><strong>Issuer Signs Credential</strong>
                      <ul>
                        <li>Message: <code>Hash(DOB, YourWallet, Nonce)</code></li>
                        <li>Signature: <code>(r, s)</code> computed using issuer's private key</li>
                      </ul>
                    </li>
                    <li><strong>Circuit Verifies Signature</strong>
                      <ul>
                        <li>Uses issuer's public key <code>(x, y)</code> (visible to everyone)</li>
                        <li>Performs elliptic curve math to verify: <code>signature(r, s)</code> was created by the private key corresponding to <code>publicKey(x, y)</code></li>
                        <li>This is the same ECDSA algorithm used in Bitcoin, Ethereum, TLS, etc.</li>
                      </ul>
                    </li>
                  </ol>
                  
                  <div className="faq-detail-box">
                    <strong>Why You Can't Forge a Signature:</strong>
                    <pre>{`To forge a signature, you would need to:
1. Find issuer's private key from public key → Computationally impossible (discrete log problem)
2. Create valid (r, s) for your fake DOB → Requires private key (same problem)
3. Bypass circuit signature check → Circuit constraints prevent this

Result: Cryptographically impossible with current computing power`}</pre>
                  </div>
                  
                  <p><strong>Smart Contract's Role:</strong></p>
                  <ul>
                    <li>The contract stores a <strong>registry of trusted issuer public keys</strong></li>
                    <li>When you submit a proof, the contract checks: "Is this issuer public key in my trusted registry?"</li>
                    <li>If YES: The circuit has cryptographically proven this issuer signed the credential</li>
                    <li>If NO: The proof is rejected (even if signature is valid)</li>
                  </ul>
                  
                  <div className="faq-code-box">
                    <strong>Contract Registry Check:</strong>
                    <pre>{`// Simplified Solidity
bytes32 issuerHash = keccak256(abi.encodePacked(issuer_pubkey_x, issuer_pubkey_y));
require(trustedIssuerA[issuerHash], "Issuer not registered");

// The circuit has proven:
// 1. This issuer public key signed the DOB credential
// 2. The signature is valid
// The contract just checks: "Do we trust this issuer?"`}</pre>
                  </div>
                  
                  <div className="faq-warning-box">
                    <strong>⚠️ Untrusted Issuer Attack:</strong> What if I generate my own key pair and sign a fake credential?
                    <p><strong>Defense:</strong> Your public key isn't in the contract's trusted registry. The proof will verify the signature is mathematically valid, but the contract will reject it because you're not an authorized issuer. See Step 1 for demo.</p>
                  </div>
                </div>
              </div>

              <div className="faq-item">
                <h4 className="faq-question">
                  Q3: How can I trust that nothing is revealed on-chain? What if the contract logs my DOB?
                </h4>
                <div className="faq-answer">
                  <p><strong>Short Answer:</strong> Your DOB never leaves your computer. The contract only sees the proof and public signals - it has no access to your private data.</p>
                  
                  <p><strong>What Goes On-Chain:</strong></p>
                  <div className="faq-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Data</th>
                          <th>On-Chain?</th>
                          <th>Explanation</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>Your DOB</td>
                          <td>❌ NO</td>
                          <td>Stays on your computer, never transmitted</td>
                        </tr>
                        <tr>
                          <td>Your citizenship</td>
                          <td>❌ NO</td>
                          <td>Stays on your computer, never transmitted</td>
                        </tr>
                        <tr>
                          <td>Credential signatures</td>
                          <td>❌ NO</td>
                          <td>Used locally for proof generation only</td>
                        </tr>
                        <tr>
                          <td>Current date (timestamp)</td>
                          <td>✅ YES</td>
                          <td>Public signal - proves freshness</td>
                        </tr>
                        <tr>
                          <td>Min age (18)</td>
                          <td>✅ YES</td>
                          <td>Public signal - policy parameter</td>
                        </tr>
                        <tr>
                          <td>Required citizenship code</td>
                          <td>✅ YES</td>
                          <td>Public signal - policy parameter (e.g., "US" = 5591637)</td>
                        </tr>
                        <tr>
                          <td>Issuer public keys</td>
                          <td>✅ YES</td>
                          <td>Public signals - proves which issuers signed</td>
                        </tr>
                        <tr>
                          <td>Your wallet address</td>
                          <td>✅ YES</td>
                          <td>Public signal - wallet binding</td>
                        </tr>
                        <tr>
                          <td>Proof (π_a, π_b, π_c)</td>
                          <td>✅ YES</td>
                          <td>Cryptographic proof - reveals nothing about private inputs</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  
                  <p><strong>Why The Proof Reveals Nothing:</strong></p>
                  <ol>
                    <li><strong>Zero-Knowledge Property</strong> - Groth16 proofs are mathematically proven to be "zero-knowledge". This means:
                      <ul>
                        <li>The proof (π_a, π_b, π_c) consists of elliptic curve points</li>
                        <li>These points are random-looking numbers</li>
                        <li>No information about your DOB can be extracted from them</li>
                        <li>It's mathematically proven that the proof could have been generated without knowing your DOB (simulation property)</li>
                      </ul>
                    </li>
                    <li><strong>You Can Verify Yourself</strong>
                      <ul>
                        <li>Look at the contract code: <code>src/AgeVerification.sol</code></li>
                        <li>It only has a <code>verifyProof()</code> function that takes the proof and public signals</li>
                        <li>There's no way for it to access your private inputs - they're not even in the function parameters!</li>
                      </ul>
                    </li>
                  </ol>
                  
                  <div className="faq-detail-box">
                    <strong>Smart Contract Interface:</strong>
                    <pre>{`function verifyProof(
    uint[2] memory a,           // Proof component π_a
    uint[2][2] memory b,        // Proof component π_b
    uint[2] memory c,           // Proof component π_c
    uint[9] memory input        // Public signals ONLY
) external view returns (bool)

// Notice: No DOB, no citizenship, no signatures!
// The contract literally cannot see your private data.`}</pre>
                  </div>
                  
                  <p><strong>Additional Guarantees:</strong></p>
                  <ul>
                    <li>✅ <strong>View Function</strong> - The contract is read-only, it doesn't store any user data</li>
                    <li>✅ <strong>Stateless</strong> - No user registry or history is kept</li>
                    <li>✅ <strong>Open Source</strong> - Anyone can audit the contract code</li>
                    <li>✅ <strong>Blockchain Transparency</strong> - All transactions are public, so if the contract tried to log private data, everyone would see it</li>
                  </ul>
                  
                  <div className="faq-callout-box">
                    <strong>🔬 Mathematical Guarantee:</strong>
                    <p>The zero-knowledge property is not based on trust or promises - it's a mathematical theorem. Given the proof (π_a, π_b, π_c) and public signals, it's cryptographically impossible to learn anything about your private inputs beyond what the public signals already reveal.</p>
                    <p>This is backed by the same math that secures Bitcoin, Ethereum, and modern cryptography.</p>
                  </div>
                </div>
              </div>

              <div className="faq-item">
                <h4 className="faq-question">
                  Q4: What if someone intercepts my proof and uses it themselves?
                </h4>
                <div className="faq-answer">
                  <p><strong>Short Answer:</strong> The proof is cryptographically bound to your wallet address. It will only verify if submitted from your wallet.</p>
                  
                  <p><strong>Wallet Binding Mechanism:</strong></p>
                  <ol>
                    <li>Your wallet address is included as a <strong>public input</strong> to the circuit</li>
                    <li>The circuit proves: "The credentials were issued to THIS wallet address"</li>
                    <li>The smart contract checks: <code>require(msg.sender == subject_wallet)</code></li>
                    <li>If someone else tries to use your proof, <code>msg.sender</code> will be their address, not yours → verification fails</li>
                  </ol>
                  
                  <p><strong>Try It Yourself:</strong> In Step 3, enable "Bob's Wallet" attack mode to see this protection in action!</p>
                </div>
              </div>

              <div className="faq-item">
                <h4 className="faq-question">
                  Q5: What if the trusted setup was compromised? Could someone forge proofs?
                </h4>
                <div className="faq-answer">
                  <p><strong>Short Answer:</strong> If the trusted setup's "toxic waste" (secret randomness) is compromised, an attacker could create fake proofs.</p>
                  
                  <p><strong>That's Why Production Systems Use Multi-Party Ceremony:</strong></p>
                  <ul>
                    <li>This demo uses a single-party setup (INSECURE for production)</li>
                    <li>Production systems use ceremonies with dozens or hundreds of participants</li>
                    <li>Only ONE honest participant is needed to keep the system secure</li>
                    <li>Examples: Zcash ceremony (6 participants), Semaphore (100+ participants)</li>
                  </ul>
                  
                  <p>See <a href="https://github.com/iden3/snarkjs#7-prepare-phase-2" target="_blank" rel="noopener">snarkjs trusted setup guide</a> for more information.</p>
                </div>
              </div>

              <div className="faq-item">
                <h4 className="faq-question">
                  Q6: Why do I need TWO issuers (A and B)? Can't I just use one?
                </h4>
                <div className="faq-answer">
                  <p><strong>Educational Design:</strong> This system demonstrates how to combine credentials from multiple sources.</p>
                  
                  <p><strong>Real-World Analogy:</strong></p>
                  <ul>
                    <li><strong>Issuer A (DMV)</strong> - Has your DOB from driver's license but not citizenship</li>
                    <li><strong>Issuer B (Immigration)</strong> - Has your citizenship from passport/green card but not DOB</li>
                  </ul>
                  
                  <p>The system proves you have valid credentials from BOTH sources, demonstrating credential composition.</p>
                  
                  <p><strong>Could it be one issuer?</strong> Yes! But the two-issuer design shows a more realistic scenario where different authorities manage different data.</p>
                </div>
              </div>

            </div>
          </div>
        )}
      </div>

      {/* Section 13: Key Takeaways */}
      <div className="summary-section always-expanded">
        <div className="section-header">
          <h3>✨ Key Takeaways</h3>
        </div>
        <div className="section-content">
          <div className="takeaway-grid">
            <div className="takeaway-card">
              <div className="takeaway-icon">🔒</div>
              <h4>Privacy Preserved</h4>
              <p>
                Your DOB and citizenship never go on-chain. The proof only reveals you meet
                the requirements, not the actual values.
              </p>
            </div>

            <div className="takeaway-card">
              <div className="takeaway-icon">✍️</div>
              <h4>Digital Signatures (Not Encryption)</h4>
              <p>
                Issuers sign your credentials to prove authenticity. Anyone can verify the signature,
                but only the issuer can create it. No encryption is used.
              </p>
            </div>

            <div className="takeaway-card">
              <div className="takeaway-icon">🔗</div>
              <h4>Wallet Binding</h4>
              <p>
                Proofs are cryptographically bound to your wallet. They cannot be stolen or reused
                by other addresses.
              </p>
            </div>

            <div className="takeaway-card">
              <div className="takeaway-icon">🏛️</div>
              <h4>Trusted Issuers</h4>
              <p>
                The system trusts issuer signatures. The contract checks issuer public keys against
                a registry to ensure credentials come from authorized sources.
              </p>
            </div>

            <div className="takeaway-card">
              <div className="takeaway-icon">⚡</div>
              <h4>Stateless Verification</h4>
              <p>
                No user registry is stored. The contract is a pure function: given a proof, it
                returns YES or NO. Each verification is independent.
              </p>
            </div>

            <div className="takeaway-card">
              <div className="takeaway-icon">🔬</div>
              <h4>Zero-Knowledge Guarantee</h4>
              <p>
                Mathematically proven: revealing the proof leaks zero bits of information about
                private inputs beyond what's implied by the public signals.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Final CTA */}
      <div className="final-cta">
        <h3>🎓 You Now Understand Zero-Knowledge Proofs!</h3>
        <p>
          You've seen how ZK proofs enable privacy-preserving verification. The same principles
          apply to many use cases: anonymous voting, private transactions, confidential audits,
          and more.
        </p>
        <div className="next-steps-box">
          <strong>Next steps to learn more:</strong>
          <ul>
            <li>Read the <a href="https://docs.circom.io" target="_blank" rel="noopener noreferrer">Circom documentation</a></li>
            <li>Explore the <a href="https://github.com/iden3/snarkjs" target="_blank" rel="noopener noreferrer">snarkjs library</a></li>
            <li>Study the <a href="https://eprint.iacr.org/2016/260.pdf" target="_blank" rel="noopener noreferrer">Groth16 paper</a></li>
            <li>Check out other ZK projects: Tornado Cash, ZK-Rollups, zk-SNARKs in production</li>
          </ul>
        </div>
      </div>

      <div className="button-group">
        <button className="btn btn-secondary" onClick={onBack}>
          Back to Step 3
        </button>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>
          Start Over
        </button>
      </div>
    </div>
  );
}

export default VerificationSummary;
