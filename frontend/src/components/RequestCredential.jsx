import React, { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { issueDOBCredential, issueCitizenshipCredential } from '../utils/proof_utils';
import * as secp256k1 from '@noble/secp256k1';
import './RequestCredential.css';

const GANACHE_PRIVATE_KEY =
  '0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d';
const BN254_SCALAR_FIELD =
  BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');

function RequestCredential({
  credentials,
  setCredentials,
  walletAddress,
  setWalletAddress,
  walletMode,
  setWalletMode,
  issuerPrivateKeys,
  demoMode,
  onNext
}) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [expandedCredential, setExpandedCredential] = useState(null);
  const [dobInput, setDobInput] = useState('2000-01-01');
  const [citizenshipInput, setCitizenshipInput] = useState('US');
  const [useUntrustedIssuer, setUseUntrustedIssuer] = useState(false);

  // Auto-connect to Ganache on mount
  useEffect(() => {
    if (!walletAddress) {
      const wallet = new ethers.Wallet(GANACHE_PRIVATE_KEY);
      setWalletAddress(wallet.address);
      setWalletMode('ganache');
    }
  }, [walletAddress, setWalletAddress, setWalletMode]);

  const getUserPubkey = () => {
    if (!walletAddress) {
      throw new Error('Wallet not initialized. Please wait a moment and try again.');
    }
    return BigInt(walletAddress).toString();
  };

  const reduceModR = (value) => {
    return (BigInt(value) % BN254_SCALAR_FIELD).toString();
  };

  const handleRequestDOB = async () => {
    setLoading(true);
    
    const issuerType = useUntrustedIssuer ? '⚠️ UNTRUSTED (unregistered)' : 'Issuer A (DMV)';
    setStatus({ type: 'info', message: `Requesting DOB credential from ${issuerType}...` });

    try {
      if (!dobInput) {
        throw new Error('Please choose a date of birth.');
      }
      const dobDate = new Date(`${dobInput}T00:00:00Z`);
      if (Number.isNaN(dobDate.getTime())) {
        throw new Error('Invalid date of birth.');
      }
      const dob = Math.floor(dobDate.getTime() / 1000);
      const userPubkey = getUserPubkey();
      const nonce = Math.floor(Math.random() * 2**32);

      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Use untrusted issuer or trusted issuer
      let issuerKey = issuerPrivateKeys?.a;
      if (useUntrustedIssuer) {
        // Generate a random unregistered issuer key
        const randomKey = secp256k1.utils.randomPrivateKey();
        const hexKey = Array.from(randomKey).map(b => b.toString(16).padStart(2, '0')).join('');
        issuerKey = '0x' + hexKey;
        console.log('🚨 Using UNTRUSTED issuer key (not registered on-chain)');
      }

      const credential = await issueDOBCredential(dob, userPubkey, nonce, issuerKey);

      setCredentials(prev => ({ ...prev, dob: credential }));
      
      if (useUntrustedIssuer) {
        setStatus({ 
          type: 'warning', 
          message: '⚠️ Credential received from UNTRUSTED issuer! This will fail verification.' 
        });
      } else {
        setStatus({ type: 'success', message: 'DOB credential received from Issuer A!' });
      }
      setExpandedCredential('dob');
    } catch (error) {
      setStatus({ type: 'error', message: `Error: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  const handleRequestCitizenship = async () => {
    setLoading(true);
    setStatus({ type: 'info', message: 'Requesting citizenship credential from Issuer B (Immigration)...' });

    try {
      const citizenship = citizenshipInput.trim().toUpperCase();
      if (!citizenship) {
        throw new Error('Please enter a citizenship code (e.g., US).');
      }
      const userPubkey = getUserPubkey();
      const nonce = Math.floor(Math.random() * 2**32);

      await new Promise(resolve => setTimeout(resolve, 1500));

      const credential = await issueCitizenshipCredential(citizenship, userPubkey, nonce, issuerPrivateKeys?.b);

      setCredentials(prev => ({ ...prev, citizenship: credential }));
      setStatus({ type: 'success', message: 'Citizenship credential received from Issuer B!' });
      setExpandedCredential('citizenship');
    } catch (error) {
      setStatus({ type: 'error', message: `Error: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  const formatValue = (value, maxLength = 20) => {
    if (value === undefined || value === null) return 'N/A';
    const str = String(value);
    if (str.length > maxLength) {
      return str.slice(0, maxLength) + '...';
    }
    return str;
  };

  const canProceed = credentials.dob && credentials.citizenship;

  return (
    <div className="card">
      <h2>Step 1: Request Credentials</h2>

      <div className="step-explanation">
        <h3>What happens in this step?</h3>
        <p>
          You request <strong>signed credentials</strong> from trusted issuers using your Ganache wallet.
          Each issuer digitally signs your information along with your wallet address, creating
          a verifiable credential that can later be used in a zero-knowledge proof.
        </p>
        <div className="flow-diagram">
          <div className="flow-item">
            <span className="flow-icon">You</span>
            <span className="flow-arrow">Request DOB</span>
            <span className="flow-icon">Issuer A (DMV)</span>
          </div>
          <div className="flow-item">
            <span className="flow-icon">You</span>
            <span className="flow-arrow">Request Citizenship</span>
            <span className="flow-icon">Issuer B (Immigration)</span>
          </div>
        </div>
        <div className="process-steps">
          <div className="process-card">
            <h4>DOB credential pipeline</h4>
            <div className="process-step">
              <span className="step-badge">1</span>
              <div>
                <div className="step-title">Inputs (not encrypted)</div>
                <div className="step-desc">DOB, wallet pubkey, nonce</div>
                <div className="step-data">DOB: {dobInput || '—'} · Wallet: {walletAddress || 'loading...'}</div>
              </div>
            </div>
            <div className="process-step">
              <span className="step-badge">2</span>
              <div>
                <div className="step-title">Hash</div>
                <div className="step-desc">Poseidon(DOB, userPubkey, nonce)</div>
              </div>
            </div>
            <div className="process-step">
              <span className="step-badge">3</span>
              <div>
                <div className="step-title">Sign</div>
                <div className="step-desc">Issuer A signs the hash (ECDSA)</div>
              </div>
            </div>
            <div className="process-step">
              <span className="step-badge">4</span>
              <div>
                <div className="step-title">Credential output</div>
                <div className="step-desc">Signature + issuer pubkey stored in the credential</div>
              </div>
            </div>
          </div>

          <div className="process-card">
            <h4>Citizenship credential pipeline</h4>
            <div className="process-step">
              <span className="step-badge">1</span>
              <div>
                <div className="step-title">Inputs (not encrypted)</div>
                <div className="step-desc">Citizenship, wallet pubkey, nonce</div>
                <div className="step-data">Citizenship: {citizenshipInput || '—'} · Wallet: {walletAddress || 'loading...'}</div>
              </div>
            </div>
            <div className="process-step">
              <span className="step-badge">2</span>
              <div>
                <div className="step-title">Hash</div>
                <div className="step-desc">Poseidon(citizenship, userPubkey, nonce)</div>
              </div>
            </div>
            <div className="process-step">
              <span className="step-badge">3</span>
              <div>
                <div className="step-title">Sign</div>
                <div className="step-desc">Issuer B signs the hash (ECDSA)</div>
              </div>
            </div>
            <div className="process-step">
              <span className="step-badge">4</span>
              <div>
                <div className="step-title">Credential output</div>
                <div className="step-desc">Signature + issuer pubkey stored in the credential</div>
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

      <div className="step-explanation">
        <h3>Wallet Binding</h3>
        <p>
          Credentials are automatically bound to your Ganache wallet address. This ensures
          only this wallet can use the proof on-chain, preventing proof theft or reuse.
        </p>
        <div className="status success">
          <strong>Connected Wallet (Ganache Account #0):</strong>
          <div style={{ fontFamily: 'monospace', marginTop: '8px' }}>{walletAddress || 'Loading...'}</div>
        </div>
      </div>

      <div className="step-explanation">
        <h3>Configure Identity Inputs</h3>
        <p>
          Adjust these values to test different scenarios. The default values (18+ and US citizen) 
          will pass verification. Try selecting a recent birth date or different citizenship to 
          see verification failures.
        </p>
        
        <div className="input-grid">
          <div className="form-group">
            <label htmlFor="dob-input">
              Date of Birth
              <span className="input-hint">Must be 18+ years old to pass verification</span>
            </label>
            <input
              id="dob-input"
              type="date"
              value={dobInput}
              onChange={(e) => setDobInput(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className="date-input"
            />
            <div className="input-helper">
              <strong>Quick select:</strong>
              <div className="quick-select-buttons">
                <button 
                  type="button"
                  className="btn-quick-select success"
                  onClick={() => setDobInput('2000-01-01')}
                >
                  ✓ Pass (2000-01-01, 25 years old)
                </button>
                <button 
                  type="button"
                  className="btn-quick-select fail"
                  onClick={() => setDobInput('2010-01-01')}
                >
                  ✗ Fail (2010-01-01, 15 years old)
                </button>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="citizenship-input">
              Citizenship
              <span className="input-hint">Must be "US" to pass verification</span>
            </label>
            <select
              id="citizenship-input"
              value={citizenshipInput}
              onChange={(e) => setCitizenshipInput(e.target.value)}
              className="citizenship-select"
            >
              <option value="US">🇺🇸 United States (US) - Will Pass</option>
              <option value="CA">🇨🇦 Canada (CA) - Will Fail</option>
              <option value="GB">🇬🇧 United Kingdom (GB) - Will Fail</option>
              <option value="AU">🇦🇺 Australia (AU) - Will Fail</option>
              <option value="DE">🇩🇪 Germany (DE) - Will Fail</option>
              <option value="FR">🇫🇷 France (FR) - Will Fail</option>
              <option value="JP">🇯🇵 Japan (JP) - Will Fail</option>
              <option value="CN">🇨🇳 China (CN) - Will Fail</option>
              <option value="IN">🇮🇳 India (IN) - Will Fail</option>
              <option value="MX">🇲🇽 Mexico (MX) - Will Fail</option>
            </select>
          </div>
        </div>

        {demoMode && (
          <div className="status info">
            <strong>Demo Mode:</strong> Default values are pre-filled (DOB: 2000-01-01, Citizenship: US), 
            but you can change them to test different scenarios like underage or non-US citizenship.
          </div>
        )}

        <div className="test-scenarios">
          <h4>Test Scenarios:</h4>
          <div className="scenarios-grid">
            <div className="scenario-card success">
              <div className="scenario-icon">✓</div>
              <div className="scenario-content">
                <strong>Pass Verification</strong>
                <p>DOB: 2000-01-01 (25 years old)<br/>Citizenship: US</p>
              </div>
            </div>
            <div className="scenario-card fail">
              <div className="scenario-icon">✗</div>
              <div className="scenario-content">
                <strong>Fail: Underage</strong>
                <p>DOB: 2010-01-01 (15 years old)<br/>Citizenship: US</p>
              </div>
            </div>
            <div className="scenario-card fail">
              <div className="scenario-icon">✗</div>
              <div className="scenario-content">
                <strong>Fail: Wrong Country</strong>
                <p>DOB: 2000-01-01 (25 years old)<br/>Citizenship: CA (Canada)</p>
              </div>
            </div>
            <div className="scenario-card fail">
              <div className="scenario-icon">✗</div>
              <div className="scenario-content">
                <strong>Fail: Both Invalid</strong>
                <p>DOB: 2010-01-01 (15 years old)<br/>Citizenship: CA (Canada)</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Security Testing: Untrusted Issuer */}
      <div className="selection-container security-test-section">
        <div className="selection-header">
          <h3>🔒 Security Testing: Issuer Selection</h3>
          <span className="selection-required">Required</span>
        </div>
        <p className="selection-description">
          Choose which type of issuer to use for signing credentials. This demonstrates why 
          only <strong>registered issuers</strong> in the contract's trusted list can create valid credentials.
        </p>
        
        <div className="issuer-mode-selector">
          <label className={`issuer-option ${!useUntrustedIssuer ? 'selected' : ''}`}>
            <input
              type="radio"
              name="issuerMode"
              value="trusted"
              checked={!useUntrustedIssuer}
              onChange={() => setUseUntrustedIssuer(false)}
            />
            <div className="issuer-content">
              <div className="issuer-header">
                <strong>✓ Trusted Issuers (Normal Mode)</strong>
                <span className="issuer-badge normal">Default</span>
              </div>
              <p className="issuer-description">
                Credentials signed by registered issuers (Ganache accounts #1 and #2)
              </p>
            </div>
          </label>

          <label className={`issuer-option ${useUntrustedIssuer ? 'selected' : ''}`}>
            <input
              type="radio"
              name="issuerMode"
              value="untrusted"
              checked={useUntrustedIssuer}
              onChange={() => setUseUntrustedIssuer(true)}
            />
            <div className="issuer-content">
              <div className="issuer-header">
                <strong>⚠️ Untrusted Issuer (Attack Simulation)</strong>
                <span className="issuer-badge attack">Security Test</span>
              </div>
              <p className="issuer-description">
                Credentials signed by a random unregistered issuer (will fail verification)
              </p>
            </div>
          </label>
        </div>

        {useUntrustedIssuer && (
          <div className="security-warning">
            <h4>⚠️ Attack Simulation Active</h4>
            <p>
              When enabled, credentials will be signed by a <strong>random, unregistered issuer</strong>. 
              This simulates a malicious actor trying to forge credentials.
            </p>
            <p><strong>Expected Result:</strong></p>
            <ul>
              <li>✓ Proof generation will succeed (with soft constraints)</li>
              <li>✗ Verification will fail because issuer is not in the contract's registry</li>
            </ul>
            
            <details className="security-details">
              <summary>🔐 Can a hacker reverse engineer the contract to forge credentials?</summary>
              <div className="security-explanation">
                <p><strong>Short answer: NO.</strong></p>
                
                <p><strong>Why this attack fails:</strong></p>
                <ol>
                  <li>
                    <strong>Public vs Private Keys:</strong> When an issuer is registered on-chain 
                    (via <code>addTrustedIssuerA</code>), only the <em>public key</em> (X, Y coordinates) 
                    is stored. The private key is never revealed.
                  </li>
                  <li>
                    <strong>Asymmetric Cryptography:</strong> It's computationally infeasible to derive 
                    a private key from its public key. This is the foundation of ECDSA security.
                  </li>
                  <li>
                    <strong>Signature Verification:</strong> The ZK circuit verifies that credentials 
                    were signed by someone who knows the private key corresponding to a registered 
                    public key. Without the private key, you cannot create valid signatures.
                  </li>
                  <li>
                    <strong>Registry Check:</strong> The smart contract checks that the issuer's 
                    public key (from the proof) matches a key in the trusted issuer registry. 
                    Random keys will fail this check.
                  </li>
                </ol>
                
                <p className="security-conclusion">
                  <strong>Conclusion:</strong> An attacker can observe on-chain transactions and see 
                  which public keys are trusted, but they cannot forge valid credentials without 
                  the corresponding private keys, which are kept secret by the legitimate issuers.
                </p>
              </div>
            </details>
          </div>
        )}
      </div>

      <div className="credential-requests">
        {/* DOB Credential Card */}
        <div className={`credential-card ${credentials.dob ? 'has-credential' : ''}`}>
          <h3>Issuer A (DMV)</h3>
          <p className="credential-type">Date of Birth Credential</p>

          {credentials.dob ? (
            <>
              <div className="credential-status success">
                Credential Received
              </div>

              <button
                className="btn btn-small"
                onClick={() => setExpandedCredential(expandedCredential === 'dob' ? null : 'dob')}
              >
                {expandedCredential === 'dob' ? 'Hide Details' : 'Show Details'}
              </button>

              {expandedCredential === 'dob' && (
                <div className="credential-details">
                  <h4>Credential Structure (Output)</h4>
                  <div className="data-display">
                    <div className="data-section">
                      <h5>User Data</h5>
                      <div className="data-row">
                        <span className="data-label">Date of Birth:</span>
                        <span className="data-value">{new Date(credentials.dob.dateOfBirth * 1000).toLocaleDateString()}</span>
                      </div>
                      <div className="data-row">
                        <span className="data-label">DOB (Unix):</span>
                        <span className="data-value">{credentials.dob.dateOfBirth}</span>
                      </div>
                      <div className="data-row">
                        <span className="data-label">User Pubkey:</span>
                        <span className="data-value" title={credentials.dob.userPubkey}>
                          {formatValue(credentials.dob.userPubkey)}
                        </span>
                      </div>
                      <div className="data-row">
                        <span className="data-label">Nonce:</span>
                        <span className="data-value">{credentials.dob.nonce}</span>
                      </div>
                    </div>

                    <div className="data-section">
                      <h5>Issuer Signature</h5>
                      <div className="data-row">
                        <span className="data-label">Signature R:</span>
                        <span className="data-value" title={credentials.dob.signature?.r}>
                          {formatValue(credentials.dob.signature?.r)}
                        </span>
                      </div>
                      <div className="data-row">
                        <span className="data-label">Signature S:</span>
                        <span className="data-value" title={credentials.dob.signature?.s}>
                          {formatValue(credentials.dob.signature?.s)}
                        </span>
                      </div>
                    </div>

                    <div className="data-section">
                      <h5>Issuer Info</h5>
                      <div className="data-row">
                        <span className="data-label">Pubkey X:</span>
                        <span className="data-value" title={credentials.dob.issuerPubkey?.x}>
                          {formatValue(credentials.dob.issuerPubkey?.x)}
                        </span>
                      </div>
                      <div className="data-row">
                        <span className="data-label">Pubkey X (reduced):</span>
                        <span className="data-value">
                          {credentials.dob?.issuerPubkey?.x ? formatValue(reduceModR(credentials.dob.issuerPubkey.x)) : 'N/A'}
                        </span>
                      </div>
                      <div className="data-row">
                        <span className="data-label">Pubkey Y:</span>
                        <span className="data-value" title={credentials.dob.issuerPubkey?.y}>
                          {formatValue(credentials.dob.issuerPubkey?.y)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="explanation-box">
                    <strong>Why these fields matter:</strong>
                    <ul>
                      <li><strong>Signature (r, s):</strong> Proves this credential was signed by Issuer A</li>
                      <li><strong>Nonce:</strong> Prevents replay attacks and links credential to this session</li>
                      <li><strong>User Pubkey:</strong> Binds this credential to your identity</li>
                    </ul>
                  </div>
                </div>
              )}
            </>
          ) : (
            <button
              className="btn btn-primary"
              onClick={handleRequestDOB}
              disabled={loading}
            >
              {loading ? <span className="loading"></span> : 'Request DOB Credential'}
            </button>
          )}
        </div>

        {/* Citizenship Credential Card */}
        <div className={`credential-card ${credentials.citizenship ? 'has-credential' : ''}`}>
          <h3>Issuer B (Immigration)</h3>
          <p className="credential-type">Citizenship Credential</p>

          {credentials.citizenship ? (
            <>
              <div className="credential-status success">
                Credential Received
              </div>

              <button
                className="btn btn-small"
                onClick={() => setExpandedCredential(expandedCredential === 'citizenship' ? null : 'citizenship')}
              >
                {expandedCredential === 'citizenship' ? 'Hide Details' : 'Show Details'}
              </button>

              {expandedCredential === 'citizenship' && (
                <div className="credential-details">
                  <h4>Credential Structure (Output)</h4>
                  <div className="data-display">
                    <div className="data-section">
                      <h5>User Data</h5>
                      <div className="data-row">
                        <span className="data-label">Citizenship:</span>
                        <span className="data-value">{credentials.citizenship.citizenship}</span>
                      </div>
                      <div className="data-row">
                        <span className="data-label">Encoded Value:</span>
                        <span className="data-value">{credentials.citizenship.citizenshipEncoded}</span>
                      </div>
                      <div className="data-row">
                        <span className="data-label">User Pubkey:</span>
                        <span className="data-value" title={credentials.citizenship.userPubkey}>
                          {formatValue(credentials.citizenship.userPubkey)}
                        </span>
                      </div>
                      <div className="data-row">
                        <span className="data-label">Nonce:</span>
                        <span className="data-value">{credentials.citizenship.nonce}</span>
                      </div>
                    </div>

                    <div className="data-section">
                      <h5>Issuer Signature</h5>
                      <div className="data-row">
                        <span className="data-label">Signature R:</span>
                        <span className="data-value" title={credentials.citizenship.signature?.r}>
                          {formatValue(credentials.citizenship.signature?.r)}
                        </span>
                      </div>
                      <div className="data-row">
                        <span className="data-label">Signature S:</span>
                        <span className="data-value" title={credentials.citizenship.signature?.s}>
                          {formatValue(credentials.citizenship.signature?.s)}
                        </span>
                      </div>
                    </div>

                    <div className="data-section">
                      <h5>Issuer Info</h5>
                      <div className="data-row">
                        <span className="data-label">Pubkey X:</span>
                        <span className="data-value" title={credentials.citizenship.issuerPubkey?.x}>
                          {formatValue(credentials.citizenship.issuerPubkey?.x)}
                        </span>
                      </div>
                      <div className="data-row">
                        <span className="data-label">Pubkey X (reduced):</span>
                        <span className="data-value">
                          {credentials.citizenship?.issuerPubkey?.x
                            ? formatValue(reduceModR(credentials.citizenship.issuerPubkey.x))
                            : 'N/A'}
                        </span>
                      </div>
                      <div className="data-row">
                        <span className="data-label">Pubkey Y:</span>
                        <span className="data-value" title={credentials.citizenship.issuerPubkey?.y}>
                          {formatValue(credentials.citizenship.issuerPubkey?.y)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="explanation-box">
                    <strong>Why these fields matter:</strong>
                    <ul>
                      <li><strong>Encoded Value:</strong> "US" encoded as a field element for the circuit</li>
                      <li><strong>Same User Pubkey:</strong> Links both credentials to the same person</li>
                      <li><strong>Different Issuer:</strong> Proves citizenship from a separate authority</li>
                    </ul>
                  </div>
                </div>
              )}
            </>
          ) : (
            <button
              className="btn btn-primary"
              onClick={handleRequestCitizenship}
              disabled={loading}
            >
              {loading ? <span className="loading"></span> : 'Request Citizenship Credential'}
            </button>
          )}
        </div>
      </div>

      {canProceed && (
        <div className="step-summary">
          <h4>Step 1 Complete</h4>
          <p>You now have two signed credentials. In the next step, you'll generate a
          zero-knowledge proof using these credentials as <strong>private inputs</strong>.</p>
        </div>
      )}

      <div className="button-group">
        <button
          className="btn btn-primary"
          onClick={onNext}
          disabled={!canProceed}
        >
          Next: Generate Proof
        </button>
      </div>
    </div>
  );
}

export default RequestCredential;
