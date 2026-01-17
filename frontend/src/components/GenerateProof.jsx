import React, { useEffect, useState } from 'react';
import { generateProof } from '../utils/proof_utils';
import './GenerateProof.css';

function GenerateProof({ credentials, proof, setProof, walletAddress, demoMode, onBack, onNext }) {
  const [loading, setLoading] = useState(false);
  const [loadingArtifacts, setLoadingArtifacts] = useState(false);
  const [status, setStatus] = useState(null);
  const [proofTime, setProofTime] = useState(null);
  const [showInputs, setShowInputs] = useState(true);
  const [showOutputs, setShowOutputs] = useState(false);
  const [wasmFile, setWasmFile] = useState(null);
  const [zkeyFile, setZkeyFile] = useState(null);
  const [wasmBuffer, setWasmBuffer] = useState(null);
  const [zkeyBuffer, setZkeyBuffer] = useState(null);
  const [circuitMode, setCircuitMode] = useState('hard'); // 'hard' or 'soft'

  const currentDate = Math.floor(Date.now() / 1000);
  const minAge = 18;
  const requiredCitizenship = 0x5553; // "US" encoded
  const wasmLoaded = Boolean(wasmBuffer || wasmFile);
  const zkeyLoaded = Boolean(zkeyBuffer || zkeyFile);
  const artifactsLoaded = wasmLoaded && zkeyLoaded;

  const resolveArtifacts = async () => {
    if (wasmBuffer && zkeyBuffer) {
      return { wasm: wasmBuffer, zkey: zkeyBuffer };
    }
    if (wasmFile && zkeyFile) {
      const [resolvedWasm, resolvedZkey] = await Promise.all([
        wasmFile.arrayBuffer(),
        zkeyFile.arrayBuffer()
      ]);
      return { wasm: resolvedWasm, zkey: resolvedZkey };
    }
    throw new Error('Please select the circuit WASM and zkey files or use auto-load.');
  };

  const handleAutoLoadArtifacts = async () => {
    setLoadingArtifacts(true);
    const circuitName = circuitMode === 'soft' ? 'age_citizenship_soft' : 'age_citizenship';
    setStatus({
      type: 'info',
      message: `Loading ${circuitMode} constraint artifacts from /artifacts...`
    });
    try {
      const [wasmResponse, zkeyResponse] = await Promise.all([
        fetch(`/artifacts/${circuitName}_js/${circuitName}.wasm`),
        fetch(`/artifacts/${circuitName}_final.zkey`)
      ]);
      if (!wasmResponse.ok || !zkeyResponse.ok) {
        throw new Error(
          `${circuitMode === 'soft' ? 'Soft' : 'Hard'} constraint artifacts not found. ` +
          (circuitMode === 'soft' 
            ? 'You need to compile and setup the soft circuit first. See docs/SOFT_CONSTRAINTS.md'
            : 'Run "npm run copy:artifacts" or "npm run setup:demo"')
        );
      }
      const [resolvedWasm, resolvedZkey] = await Promise.all([
        wasmResponse.arrayBuffer(),
        zkeyResponse.arrayBuffer()
      ]);
      setWasmBuffer(resolvedWasm);
      setZkeyBuffer(resolvedZkey);
      setWasmFile(null);
      setZkeyFile(null);
      setStatus({
        type: 'success',
        message: `${circuitMode === 'soft' ? 'Soft' : 'Hard'} constraint artifacts loaded successfully.`
      });
    } catch (error) {
      setStatus({ type: 'error', message: `Error: ${error.message}` });
    } finally {
      setLoadingArtifacts(false);
    }
  };

  // Auto-load artifacts on mount and when circuit mode changes
  useEffect(() => {
    handleAutoLoadArtifacts();
  }, [circuitMode]);

  const handleGenerateProof = async () => {
    if (!credentials.dob || !credentials.citizenship) {
      setStatus({ type: 'error', message: 'Please request credentials first' });
      return;
    }

    if (!walletAddress) {
      setStatus({ type: 'error', message: 'Connect a wallet in Step 1 to bind the proof.' });
      return;
    }

    setLoading(true);
    setStatus({ type: 'info', message: 'Generating zero-knowledge proof... This may take a moment.' });

    const startTime = Date.now();

    try {
      const artifacts = await resolveArtifacts();

      const proofData = await generateProof(
        credentials.dob,
        credentials.citizenship,
        new Date(),
        18,
        artifacts,
        walletAddress
      );

      const endTime = Date.now();
      setProofTime(((endTime - startTime) / 1000).toFixed(2));

      setProof(proofData);
      setShowInputs(false);
      setShowOutputs(true);
      setStatus({
        type: 'success',
        message: `Proof generated successfully in ${((endTime - startTime) / 1000).toFixed(2)} seconds!`
      });
    } catch (error) {
      console.error('Proof generation error:', error);
      
      // Check if it's a circuit constraint failure
      if (error.message && error.message.includes('Assert Failed')) {
        // Calculate age to provide helpful feedback
        const dobTimestamp = credentials.dob.dateOfBirth;
        const dobDate = new Date(dobTimestamp * 1000);
        const currentDate = new Date();
        const age = Math.floor((currentDate - dobDate) / (365.25 * 24 * 60 * 60 * 1000));
        const citizenship = credentials.citizenship.citizenship;
        
        let reason = '';
        const issues = [];
        if (age < 18) {
          issues.push(`Age: ${age} years old (requirement: 18+)`);
        }
        if (citizenship !== 'US') {
          issues.push(`Citizenship: ${citizenship} (requirement: US)`);
        }
        
        reason = issues.length > 0 ? issues.join(' AND ') : 'Unknown constraint violation';
        
        setStatus({ 
          type: 'error', 
          message: (
            <div className="circuit-error-message">
              <div className="error-header">
                <strong>⚠️ Circuit Constraint Failure</strong>
              </div>
              <p>
                The circuit cannot generate a proof because your inputs don't meet the requirements:
              </p>
              <div className="error-reason">
                <strong>Reason:</strong> {reason}
              </div>
              <div className="error-explanation">
                <p>
                  <strong>Why this happens:</strong> The current circuit uses strict constraints (assertions) 
                  that block proof generation when requirements aren't met. This is a design limitation — 
                  ideally, the circuit should always generate a proof and let the verifier contract reject 
                  invalid ones.
                </p>
                <p>
                  <strong>To proceed:</strong> Go back to Step 1 and select inputs that meet the requirements 
                  (DOB: 18+ years old AND Citizenship: US) to see the complete verification flow.
                </p>
              </div>
            </div>
          )
        });
      } else {
        setStatus({ type: 'error', message: `Error: ${error.message}` });
      }
    } finally {
      setLoading(false);
    }
  };

  const formatValue = (value, maxLength = 16) => {
    if (value === undefined || value === null) return 'N/A';
    const str = String(value);
    if (str.length > maxLength) {
      return str.slice(0, maxLength) + '...';
    }
    return str;
  };

  return (
    <div className="card">
      <h2>Step 2: Generate Zero-Knowledge Proof</h2>

      <div className="step-explanation">
        <h3>What happens in this step?</h3>
        <p>
          The ZK circuit takes your credentials as <strong>private inputs</strong> and produces
          a <strong>proof</strong> along with <strong>public signals</strong>. The magic: anyone
          can verify the proof without seeing your private data!
        </p>
        <p>
          The proof is also bound to your wallet address:
          <strong> {walletAddress || 'not connected'}</strong>
        </p>
        
        <div className="selection-container circuit-mode-selector">
          <div className="selection-header">
            <h4>Circuit Mode Selection</h4>
            <span className="selection-required">Required</span>
          </div>
          <p className="selection-description">Choose which circuit version to use for proof generation:</p>
          
          <div className="mode-options">
            <label className={`mode-option ${circuitMode === 'hard' ? 'selected' : ''}`}>
              <input
                type="radio"
                name="circuitMode"
                value="hard"
                checked={circuitMode === 'hard'}
                onChange={(e) => setCircuitMode(e.target.value)}
              />
              <div className="mode-content">
                <div className="mode-header">
                  <strong>🔒 Hard Constraints (Default)</strong>
                  <span className="mode-badge recommended">Recommended for demos</span>
                </div>
                <ul className="mode-features">
                  <li>✓ Simpler circuit design</li>
                  <li>✓ Pre-compiled and ready to use</li>
                  <li>✗ Proof generation fails with invalid inputs (underage or non-US)</li>
                  <li>✗ Cannot test failure scenarios</li>
                </ul>
                <p className="mode-note">Best for: Demonstrating valid proof generation</p>
              </div>
            </label>

            <label className={`mode-option ${circuitMode === 'soft' ? 'selected' : ''}`}>
              <input
                type="radio"
                name="circuitMode"
                value="soft"
                checked={circuitMode === 'soft'}
                onChange={(e) => setCircuitMode(e.target.value)}
              />
              <div className="mode-content">
                <div className="mode-header">
                  <strong>🔓 Soft Constraints (Advanced)</strong>
                  <span className="mode-badge advanced">Requires setup</span>
                </div>
                <ul className="mode-features">
                  <li>✓ Proof generation always succeeds</li>
                  <li>✓ Can test all scenarios (underage, non-US, etc.)</li>
                  <li>✓ Same public signals as hard circuit (9 signals)</li>
                  <li>⚠ Invalid proofs fail Groth16 verification (Step 3)</li>
                </ul>
                <p className="mode-note">Best for: Testing failure scenarios and understanding how invalid proofs fail</p>
              </div>
            </label>
          </div>

          {circuitMode === 'soft' && (
            <div className="soft-setup-note">
              <strong>ℹ️ Note:</strong> If you ran <code>npm run setup:demo</code>, the soft constraint circuit 
              is already compiled and copied. If artifacts are missing, see{' '}
              <a href="https://github.com/yourusername/zk-identity-proof/blob/main/docs/SOFT_CONSTRAINTS.md" target="_blank" rel="noopener noreferrer">
                docs/SOFT_CONSTRAINTS.md
              </a> for manual setup instructions.
            </div>
          )}

          <details className="circuit-explainer">
            <summary>📚 Learn more about Hard vs Soft Constraints</summary>
            <div className="explainer-content">
              <div className="explainer-section">
                <h5>Hard Constraints (Current Default)</h5>
                <p>Uses circuit assertions (<code>===</code>) that enforce all requirements must be met:</p>
                <pre className="code-sample">all_checks_passed === 1;  // Assertion fails if not true</pre>
                <p>If age &lt; 18 or citizenship != US, witness generation fails with: <code>Assert Failed</code></p>
              </div>

              <div className="explainer-section">
                <h5>Soft Constraints (Advanced)</h5>
                <p>Removes the final assertion, allowing proof generation for any input:</p>
                <pre className="code-sample">{`// all_checks_passed === 1;  ← REMOVED
// Proof generates with all_checks_passed = 0 or 1`}</pre>
                <p>The proof always generates, but Groth16 verification mathematically fails when constraints aren't satisfied</p>
              </div>

              <div className="comparison-table">
                <h5>Comparison</h5>
                <table>
                  <thead>
                    <tr>
                      <th>Aspect</th>
                      <th>Hard Constraints</th>
                      <th>Soft Constraints</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Proof Generation</td>
                      <td>Fails with invalid inputs</td>
                      <td>Always succeeds</td>
                    </tr>
                    <tr>
                      <td>Public Signals</td>
                      <td>9 signals</td>
                      <td>9 signals (same!)</td>
                    </tr>
                    <tr>
                      <td>Final Assertion</td>
                      <td>all_checks_passed === 1</td>
                      <td>No assertion (removed)</td>
                    </tr>
                    <tr>
                      <td>Error Location</td>
                      <td>Circuit (witness generation)</td>
                      <td>Smart contract (Groth16 verification)</td>
                    </tr>
                    <tr>
                      <td>Testing</td>
                      <td>Can't test failure scenarios</td>
                      <td>Can test all scenarios</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </details>
        </div>

        {/* Malicious Circuit Warning */}
        <div className="malicious-circuit-warning">
          <h4>⚠️ Security Note: Circuit Integrity & Malicious Modifications</h4>
          <p>
            A critical security consideration in zero-knowledge systems: 
            <strong> What if someone modifies the circuit to bypass verification checks?</strong>
          </p>
          
          <details className="circuit-security-details">
            <summary>🔍 Understanding Malicious Circuit Attacks</summary>
            <div className="security-explanation">
              <div className="attack-scenario">
                <h5>Attack Scenario: Removing Constraints</h5>
                <p>Imagine a malicious developer modifies the circuit to remove the age check:</p>
                <pre className="code-sample bad">{`// Original (secure)
// signal age_check <== LessThan(121)([age_in_years, min_age]);
// age_check === 0;  // Enforces age >= min_age

// Malicious modification (insecure - ALWAYS PASSES)
signal age_check <-- 1;  // Just set to 1, no actual check!
age_check === 1;`}</pre>
                <p>This malicious circuit would generate valid-looking proofs even for 10-year-olds!</p>
              </div>

              <div className="defense-mechanism">
                <h5>🛡️ How the System Defends Against This</h5>
                <ol>
                  <li>
                    <strong>Trusted Setup Binds Circuit to Verifier:</strong> The verifier contract 
                    is generated from the specific circuit code. Any change to the circuit creates 
                    a <em>different</em> verifier with different verification keys.
                  </li>
                  <li>
                    <strong>Verifier is Deployed On-Chain:</strong> The legitimate verifier contract 
                    is deployed at a known address. Only proofs generated from the correct circuit 
                    will verify against this contract.
                  </li>
                  <li>
                    <strong>Proof from Malicious Circuit Fails:</strong> If an attacker generates 
                    a proof from their modified circuit, it will have different cryptographic 
                    properties and will fail when submitted to the legitimate verifier.
                  </li>
                  <li>
                    <strong>Cannot Replace Deployed Contract:</strong> The attacker cannot replace 
                    the deployed verifier contract (immutable on blockchain) or change its address.
                  </li>
                </ol>
              </div>

              <div className="technical-details">
                <h5>🔬 Technical Details</h5>
                <p>
                  The trusted setup ceremony generates proving keys (<code>.zkey</code>) and 
                  verification keys (<code>Verifier.sol</code>) that are mathematically bound 
                  to the circuit's constraint system:
                </p>
                <ul>
                  <li>Circuit code → R1CS constraints → Proving/Verifying keys</li>
                  <li>Different constraints = Different keys = Different verifier</li>
                  <li>Proof A (from Circuit A) cannot verify with Verifier B (from Circuit B)</li>
                </ul>
              </div>

              <div className="best-practices">
                <h5>✅ Best Practices for Production</h5>
                <ol>
                  <li><strong>Audit Circuit Code:</strong> Have the circuit reviewed by ZK experts</li>
                  <li><strong>Open Source:</strong> Publish circuit code for community review</li>
                  <li><strong>Trusted Setup Ceremony:</strong> Use multi-party computation (MPC) for trusted setup</li>
                  <li><strong>Verifier Contract Audits:</strong> Audit the deployed Solidity verifier</li>
                  <li><strong>Circuit Version Control:</strong> Track which circuit version generated which verifier</li>
                </ol>
              </div>

              <div className="demo-note">
                <p>
                  <strong>In this demo:</strong> We trust that the circuit code in 
                  <code>circuits/age_citizenship.circom</code> is correct and that the deployed 
                  verifier corresponds to it. In production, these trust assumptions must be 
                  eliminated through audits, open-source transparency, and secure setup ceremonies.
                </p>
              </div>
            </div>
          </details>
        </div>

        <div className="zk-flow">
          <div className="zk-flow-item private">
            <span className="zk-label">Private Inputs</span>
            <span className="zk-desc">Your secrets (hidden)</span>
          </div>
          <div className="zk-flow-arrow">Circuit</div>
          <div className="zk-flow-item public">
            <span className="zk-label">Proof + Public Signals</span>
            <span className="zk-desc">Verifiable output</span>
          </div>
        </div>
        <div className="process-steps">
          <div className="process-card">
            <h4>Proof pipeline</h4>
            <div className="process-step">
              <span className="step-badge">1</span>
              <div>
                <div className="step-title">Load credentials</div>
                <div className="step-desc">DOB + citizenship credentials (signed)</div>
              </div>
            </div>
            <div className="process-step">
              <span className="step-badge">2</span>
              <div>
                <div className="step-title">Re-hash & verify signatures</div>
                <div className="step-desc">Circuit recomputes Poseidon hashes and checks ECDSA</div>
              </div>
            </div>
            <div className="process-step">
              <span className="step-badge">3</span>
              <div>
                <div className="step-title">Apply rules</div>
                <div className="step-desc">Age ≥ 18 and citizenship == US</div>
              </div>
            </div>
            <div className="process-step">
              <span className="step-badge">4</span>
              <div>
                <div className="step-title">Bind to wallet</div>
                <div className="step-desc">subject_wallet == user_pubkey</div>
              </div>
            </div>
            <div className="process-step">
              <span className="step-badge">5</span>
              <div>
                <div className="step-title">Generate proof</div>
                <div className="step-desc">Outputs (a, b, c) + public signals</div>
              </div>
            </div>
          </div>
          <div className="process-card">
            <h4>Visibility (no encryption)</h4>
            <div className="process-step">
              <span className="step-badge">P</span>
              <div>
                <div className="step-title">Private inputs (hidden from verifier)</div>
                <div className="step-desc">DOB, citizenship, signatures, nonces</div>
                <div className="step-desc">Visible to you in the UI, NOT revealed on-chain</div>
              </div>
            </div>
            <div className="process-step">
              <span className="step-badge">U</span>
              <div>
                <div className="step-title">Public signals</div>
                <div className="step-desc">current_date, issuer keys, user_pubkey, subject_wallet</div>
              </div>
            </div>
            <div className="process-step">
              <span className="step-badge">N</span>
              <div>
                <div className="step-title">No encryption</div>
                <div className="step-desc">Proof hides data mathematically instead</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {status && (
        <div className={`status ${status.type}`}>
          {status.message}
        </div>
      )}

      {/* Circuit Inputs Section */}
      <div className="inputs-outputs-container">
        <div className="io-section">
          <div className="io-header public-header">
            <h3>Proof Artifacts (Required)</h3>
          </div>
          <div className="io-content">
            <p className="io-description">
              Artifacts are automatically loaded from <code>/artifacts</code> when you reach this step.
              If <code>npm run setup:demo</code> was successful, the files will be ready immediately.
            </p>
            <div className={`status ${artifactsLoaded ? 'success' : loadingArtifacts ? 'info' : 'error'}`}>
              {loadingArtifacts
                ? '⏳ Loading artifacts from /artifacts...'
                : artifactsLoaded
                ? '✓ Artifacts loaded and ready for proof generation'
                : '⚠ Artifacts not found. Run "npm run copy:artifacts" or "npm run setup:demo"'}
            </div>
            <details className="advanced-artifacts" style={{ marginTop: '15px' }}>
              <summary style={{ cursor: 'pointer', fontWeight: '600', color: '#334155', padding: '10px', background: '#f8fafc', borderRadius: '6px' }}>
                ⚙️ Advanced: Manual File Selection
              </summary>
              <div className="input-grid" style={{ marginTop: '15px' }}>
                <div className="input-card public-card">
                  <h4>Circuit WASM</h4>
                  <input
                    type="file"
                    accept=".wasm"
                    onChange={(e) => {
                      setWasmFile(e.target.files?.[0] || null);
                      setWasmBuffer(null);
                    }}
                  />
                  <p className="output-note">
                    {wasmBuffer ? 'Loaded from /artifacts' : (wasmFile ? wasmFile.name : 'No file selected')}
                  </p>
                  <p className={`output-note ${wasmLoaded ? 'status success' : 'status info'}`}>
                    {wasmLoaded ? 'WASM loaded' : 'WASM not loaded'}
                  </p>
                </div>
                <div className="input-card public-card">
                  <h4>Proving Key (zkey)</h4>
                  <input
                    type="file"
                    accept=".zkey"
                    onChange={(e) => {
                      setZkeyFile(e.target.files?.[0] || null);
                      setZkeyBuffer(null);
                    }}
                  />
                  <p className="output-note">
                    {zkeyBuffer ? 'Loaded from /artifacts' : (zkeyFile ? zkeyFile.name : 'No file selected')}
                  </p>
                  <p className={`output-note ${zkeyLoaded ? 'status success' : 'status info'}`}>
                    {zkeyLoaded ? 'Zkey loaded' : 'Zkey not loaded'}
                  </p>
                </div>
              </div>
            </details>
          </div>
        </div>

        {/* Private Inputs */}
        <div className="io-section">
          <div className="io-header private-header" onClick={() => setShowInputs(!showInputs)}>
            <h3>Private Inputs (Hidden in Proof)</h3>
            <span className="toggle-icon">{showInputs ? '−' : '+'}</span>
          </div>

          {showInputs && (
            <div className="io-content">
              <p className="io-description">
                These values are used to generate the proof but are <strong>never revealed</strong> to anyone.
                They remain on your device only.
              </p>

              <div className="input-grid">
                <div className="input-card private-card">
                  <h4>From DOB Credential</h4>
                  <div className="input-item">
                    <span className="input-label">date_of_birth:</span>
                    <span className="input-value">
                      {credentials.dob ? credentials.dob.dateOfBirth : '(not set)'}
                    </span>
                    <span className="input-human">
                      {credentials.dob ? new Date(credentials.dob.dateOfBirth * 1000).toLocaleDateString() : ''}
                    </span>
                  </div>
                  <div className="input-item">
                    <span className="input-label">signature_a_r:</span>
                    <span className="input-value">{formatValue(credentials.dob?.signature?.r)}</span>
                  </div>
                  <div className="input-item">
                    <span className="input-label">signature_a_s:</span>
                    <span className="input-value">{formatValue(credentials.dob?.signature?.s)}</span>
                  </div>
                  <div className="input-item">
                    <span className="input-label">nonce_a:</span>
                    <span className="input-value">{credentials.dob?.nonce || '(not set)'}</span>
                  </div>
                </div>

                <div className="input-card private-card">
                  <h4>From Citizenship Credential</h4>
                  <div className="input-item">
                    <span className="input-label">citizenship:</span>
                    <span className="input-value">
                      {credentials.citizenship?.citizenshipEncoded || '(not set)'}
                    </span>
                    <span className="input-human">
                      {credentials.citizenship?.citizenship || ''}
                    </span>
                  </div>
                  <div className="input-item">
                    <span className="input-label">signature_b_r:</span>
                    <span className="input-value">{formatValue(credentials.citizenship?.signature?.r)}</span>
                  </div>
                  <div className="input-item">
                    <span className="input-label">signature_b_s:</span>
                    <span className="input-value">{formatValue(credentials.citizenship?.signature?.s)}</span>
                  </div>
                  <div className="input-item">
                    <span className="input-label">nonce_b:</span>
                    <span className="input-value">{credentials.citizenship?.nonce || '(not set)'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Public Inputs */}
        <div className="io-section">
          <div className="io-header public-header">
            <h3>Public Inputs (Visible to Verifier)</h3>
          </div>

          <div className="io-content">
            <p className="io-description">
              These values are <strong>visible to everyone</strong> and will be included in the proof.
              They define what is being proven.
            </p>

            <div className="input-grid">
              <div className="input-card public-card">
                <h4>Verification Parameters</h4>
                <div className="input-item">
                  <span className="input-label">current_date:</span>
                  <span className="input-value">{currentDate}</span>
                  <span className="input-human">{new Date(currentDate * 1000).toLocaleDateString()}</span>
                </div>
                <div className="input-item">
                  <span className="input-label">min_age:</span>
                  <span className="input-value">{minAge}</span>
                  <span className="input-human">years</span>
                </div>
                <div className="input-item">
                  <span className="input-label">required_citizenship:</span>
                  <span className="input-value">{requiredCitizenship}</span>
                  <span className="input-human">"US"</span>
                </div>
              </div>

              <div className="input-card public-card">
                <h4>Issuer Public Keys</h4>
                <div className="input-item">
                  <span className="input-label">issuer_a_pubkey_x:</span>
                  <span className="input-value">{formatValue(credentials.dob?.issuerPubkey?.x)}</span>
                </div>
                <div className="input-item">
                  <span className="input-label">issuer_a_pubkey_y:</span>
                  <span className="input-value">{formatValue(credentials.dob?.issuerPubkey?.y)}</span>
                </div>
                <div className="input-item">
                  <span className="input-label">issuer_b_pubkey_x:</span>
                  <span className="input-value">{formatValue(credentials.citizenship?.issuerPubkey?.x)}</span>
                </div>
                <div className="input-item">
                  <span className="input-label">issuer_b_pubkey_y:</span>
                  <span className="input-value">{formatValue(credentials.citizenship?.issuerPubkey?.y)}</span>
                </div>
                <div className="input-item">
                  <span className="input-label">user_pubkey:</span>
                  <span className="input-value">{formatValue(credentials.dob?.userPubkey)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Generate Proof Button */}
      {!proof && (
        <div className="generate-section">
          <div className="what-proven">
            <h4>What the circuit will verify:</h4>
            <ul>
              <li>Credential A is signed by Issuer A (DMV)</li>
              <li>Credential B is signed by Issuer B (Immigration)</li>
              <li>Your age is at least {minAge} years</li>
              <li>Your citizenship matches "US"</li>
              <li>Both credentials belong to the same user</li>
            </ul>
          </div>

          <button
            className="btn btn-primary btn-large"
            onClick={handleGenerateProof}
            disabled={loading || !credentials.dob || !credentials.citizenship}
          >
            {loading ? (
              <>
                <span className="loading"></span> Generating Proof...
              </>
            ) : (
              'Generate Zero-Knowledge Proof'
            )}
          </button>
        </div>
      )}

      {/* Proof Output Section */}
      {proof && (
        <div className="io-section">
          <div className="io-header output-header" onClick={() => setShowOutputs(!showOutputs)}>
            <h3>Proof Output (What gets sent to blockchain)</h3>
            <span className="toggle-icon">{showOutputs ? '−' : '+'}</span>
          </div>

          {showOutputs && (
            <div className="io-content">
              <div className="proof-stats">
                <div className="stat-item">
                  <span className="stat-value">{proofTime}s</span>
                  <span className="stat-label">Generation Time</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">~200</span>
                  <span className="stat-label">Bytes (Proof)</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">{proof.publicSignals?.length || 0}</span>
                  <span className="stat-label">Public Signals</span>
                </div>
              </div>

              <div className="input-grid">
                <div className="input-card output-card">
                  <h4>Proof Components (Groth16)</h4>
                  <p className="output-note">These cryptographic values prove the statement without revealing private inputs.</p>
                  <div className="input-item">
                    <span className="input-label">pi_a (G1 point):</span>
                    <span className="input-value">[{formatValue(proof.proof?.pi_a?.[0])}, {formatValue(proof.proof?.pi_a?.[1])}]</span>
                  </div>
                  <div className="input-item">
                    <span className="input-label">pi_b (G2 point):</span>
                    <span className="input-value">[[...], [...]]</span>
                  </div>
                  <div className="input-item">
                    <span className="input-label">pi_c (G1 point):</span>
                    <span className="input-value">[{formatValue(proof.proof?.pi_c?.[0])}, {formatValue(proof.proof?.pi_c?.[1])}]</span>
                  </div>
                </div>

                <div className="input-card output-card">
                  <h4>Public Signals</h4>
                  <p className="output-note">These values are visible and verified on-chain.</p>
                  {proof.publicSignals?.map((signal, idx) => (
                    <div className="input-item" key={idx}>
                      <span className="input-label">signal[{idx}]:</span>
                      <span className="input-value">{formatValue(signal, 24)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="explanation-box success-box">
                <strong>Privacy preserved!</strong>
                <p>
                  Notice that your <strong>date of birth</strong> and <strong>citizenship</strong> are NOT
                  in the public signals. The verifier only sees that the proof is valid, not your private data.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="button-group">
        <button className="btn btn-secondary" onClick={onBack}>
          Back
        </button>
        <button
          className="btn btn-primary"
          onClick={onNext}
          disabled={!proof}
        >
          Next: Submit Proof
        </button>
      </div>
    </div>
  );
}

export default GenerateProof;
