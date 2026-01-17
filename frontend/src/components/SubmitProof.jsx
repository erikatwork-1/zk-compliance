import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import './SubmitProof.css';

// Contract ABI (simplified - in production, import from artifacts)
const AGE_VERIFICATION_ABI = [
  "function verifyProof(uint[2] memory a, uint[2][2] memory b, uint[2] memory c, uint[9] memory input) external view returns (bool)",
  "function minAge() external view returns (uint256)",
  "function requiredCitizenship() external view returns (uint256)",
  "function trustedIssuerA(bytes32) external view returns (bool)",
  "function trustedIssuerB(bytes32) external view returns (bool)"
];

const GANACHE_PRIVATE_KEY =
  '0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d'; // Ganache account #3
const GANACHE_WRONG_WALLET_KEY =
  '0x646f1ce2fdad0e6deeeb5c7e8e5543bdde65e86029e2fd9fc169899c440a7913'; // Ganache account #4 (Bob's wallet)
const GANACHE_RPC_URL = 'http://127.0.0.1:8545';

function SubmitProof({
  proof,
  verificationStatus,
  setVerificationStatus,
  walletAddress,
  walletMode,
  contractAddress,
  setContractAddress,
  demoMode,
  onBack,
  onNext
}) {
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [showProofData, setShowProofData] = useState(true);
  const [diagnostics, setDiagnostics] = useState(null);
  const [useWrongWallet, setUseWrongWallet] = useState(false);

  useEffect(() => {
    if (walletMode === 'ganache') {
      const wallet = new ethers.Wallet(GANACHE_PRIVATE_KEY);
      setAccount(wallet.address);
      return;
    }
    if (window.ethereum) {
      checkConnection();
    } else {
      setStatus({
        type: 'error',
        message: 'MetaMask is not installed. Please install MetaMask to continue.'
      });
    }
  }, [walletMode]);

  const checkConnection = async () => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.listAccounts();
      if (accounts.length > 0) {
        setAccount(accounts[0].address);
      }
    } catch (error) {
      console.error('Error checking connection:', error);
    }
  };

  const connectWallet = async () => {
    try {
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.listAccounts();
      setAccount(accounts[0].address);
      setStatus({ type: 'success', message: 'Wallet connected!' });
    } catch (error) {
      setStatus({ type: 'error', message: `Error connecting wallet: ${error.message}` });
    }
  };

  const formatProofForContract = () => {
    if (!proof) return null;

    // Format proof components for Solidity
    const a = [proof.proof.pi_a[0], proof.proof.pi_a[1]];
    const b = [
      [proof.proof.pi_b[0][1], proof.proof.pi_b[0][0]],
      [proof.proof.pi_b[1][1], proof.proof.pi_b[1][0]]
    ];
    const c = [proof.proof.pi_c[0], proof.proof.pi_c[1]];
    const input = proof.publicSignals;

    return { a, b, c, input };
  };

  const handleSubmitProof = async () => {
    if (!proof) {
      setStatus({ type: 'error', message: 'Please generate a proof first' });
      return;
    }

    if (!account) {
      setStatus({ type: 'error', message: 'Please connect your wallet first' });
      return;
    }

    if (!contractAddress) {
      setStatus({ type: 'error', message: 'Please enter the contract address' });
      return;
    }

    setLoading(true);
    
    const attackMode = useWrongWallet ? ' (⚠️ USING WRONG WALLET - Attack Simulation)' : '';
    setStatus({ type: 'info', message: `Verifying proof${attackMode}...` });

    try {
      let signer;
      if (walletMode === 'ganache') {
        const provider = new ethers.JsonRpcProvider(GANACHE_RPC_URL);
        // Use wrong wallet if attack mode is enabled
        const privateKey = useWrongWallet ? GANACHE_WRONG_WALLET_KEY : GANACHE_PRIVATE_KEY;
        signer = new ethers.Wallet(privateKey, provider);
        
        if (useWrongWallet) {
          console.log('🚨 ATTACK SIMULATION: Submitting proof from Bob\'s wallet (not bound to proof)');
        }
      } else {
        const provider = new ethers.BrowserProvider(window.ethereum);
        signer = await provider.getSigner();
      }
      const signerAddress = await signer.getAddress();
      const contract = new ethers.Contract(contractAddress, AGE_VERIFICATION_ABI, signer);

      const formatted = formatProofForContract();

      // Skip this check in attack mode (we want to test wallet mismatch)
      if (!useWrongWallet && walletAddress && signerAddress && walletAddress.toLowerCase() !== signerAddress.toLowerCase()) {
        throw new Error('Connected wallet does not match the address used to generate the proof.');
      }

      const result = await contract.verifyProof(
        formatted.a,
        formatted.b,
        formatted.c,
        formatted.input.map(s => BigInt(s))
      );
      setVerificationStatus({ success: result });
      setStatus(
        result
          ? { type: 'success', message: 'Proof verified successfully!' }
          : { type: 'error', message: 'Proof verification failed.' }
      );
      if (!result) {
        setDiagnostics(null);
      }
    } catch (error) {
      setStatus({ type: 'error', message: `Error: ${error.message}` });
      setVerificationStatus({ success: false, error: error.message });
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

  const runDiagnostics = async () => {
    if (!proof || !contractAddress) {
      setStatus({ type: 'error', message: 'Provide proof and contract address first.' });
      return;
    }
    try {
      const provider =
        walletMode === 'ganache'
          ? new ethers.JsonRpcProvider(GANACHE_RPC_URL)
          : new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(contractAddress, AGE_VERIFICATION_ABI, provider);
      const signals = proof.publicSignals.map((signal) => BigInt(signal));
      
      // Format proof for contract call
      const formattedProof = formatProofForContract();
      
      // Call verifyProof to get the actual result
      let verifyResult = false;
      let verifyError = null;
      try {
        verifyResult = await contract.verifyProof(
          formattedProof.a,
          formattedProof.b,
          formattedProof.c,
          formattedProof.input.map(s => BigInt(s))
        );
      } catch (err) {
        verifyError = err.message;
      }
      
      const [minAge, requiredCitizenship] = await Promise.all([
        contract.minAge(),
        contract.requiredCitizenship()
      ]);
      const block = await provider.getBlock('latest');

      const issuerAHash = ethers.solidityPackedKeccak256(
        ['uint256', 'uint256'],
        [signals[3], signals[4]]
      );
      const issuerBHash = ethers.solidityPackedKeccak256(
        ['uint256', 'uint256'],
        [signals[5], signals[6]]
      );

      const [issuerAOk, issuerBOk] = await Promise.all([
        contract.trustedIssuerA(issuerAHash),
        contract.trustedIssuerB(issuerBHash)
      ]);

      const now = BigInt(block.timestamp);
      const oneYear = BigInt(365 * 24 * 60 * 60);

      // Get the actual wallet that will submit the transaction
      let actualSenderAddress;
      if (walletMode === 'ganache') {
        const privateKey = useWrongWallet ? GANACHE_WRONG_WALLET_KEY : GANACHE_PRIVATE_KEY;
        const wallet = new ethers.Wallet(privateKey);
        actualSenderAddress = wallet.address;
      } else {
        actualSenderAddress = account;
      }

      const walletBigInt = actualSenderAddress ? BigInt(actualSenderAddress) : null;
      const subjectWallet = signals[8];
      const userPubkey = signals[7];

      // Check each condition
      const dateOk = signals[0] >= now - oneYear && signals[0] <= now + oneYear;
      const minAgeOk = BigInt(signals[1]) === BigInt(minAge);
      const citizenshipOk = BigInt(signals[2]) === BigInt(requiredCitizenship);
      const walletBindingOk = userPubkey === subjectWallet;
      const msgSenderOk = walletBigInt ? subjectWallet === walletBigInt : false;

      // Determine likely cause of verification failure
      let failureReason = '';
      if (!verifyResult) {
        if (verifyError) {
          failureReason = `Error: ${verifyError}`;
        } else if (!issuerAOk) {
          failureReason = 'Issuer A not registered in contract';
        } else if (!issuerBOk) {
          failureReason = 'Issuer B not registered in contract';
        } else if (!minAgeOk) {
          failureReason = 'min_age mismatch with contract policy';
        } else if (!citizenshipOk) {
          failureReason = 'required_citizenship mismatch with contract policy';
        } else if (!dateOk) {
          failureReason = 'current_date outside allowed window';
        } else if (!walletBindingOk) {
          failureReason = 'user_pubkey != subject_wallet';
        } else if (!msgSenderOk) {
          failureReason = 'subject_wallet != msg.sender (wrong wallet submitting)';
        } else {
          failureReason = 'All public signals look correct. Groth16 pairing check failed - likely circuit constraints not satisfied (age < 18 or citizenship != US). Note: Groth16 cannot tell which specific constraint failed.';
        }
      }

      setDiagnostics([
        {
          label: '🔐 Groth16 Proof Verification',
          value: verifyResult ? 'PASS' : 'FAIL',
          ok: verifyResult,
          reason: failureReason,
          highlight: true
        },
        {
          label: 'current_date within allowed window',
          value: signals[0].toString(),
          ok: dateOk
        },
        {
          label: 'min_age matches contract',
          value: `${signals[1]} (contract ${minAge})`,
          ok: minAgeOk
        },
        {
          label: 'required_citizenship matches contract',
          value: `${signals[2]} (contract ${requiredCitizenship})`,
          ok: citizenshipOk
        },
        {
          label: 'issuer A registered',
          value: signals[3].toString(),
          ok: issuerAOk
        },
        {
          label: 'issuer B registered',
          value: signals[5].toString(),
          ok: issuerBOk
        },
        {
          label: 'user_pubkey == subject_wallet',
          value: `${userPubkey.toString()} == ${subjectWallet.toString()}`,
          ok: walletBindingOk
        },
        {
          label: `subject_wallet == msg.sender${useWrongWallet ? ' (⚠️ Using Bob\'s wallet)' : ' (✓ Using your wallet)'}`,
          value: walletBigInt ? `${subjectWallet.toString()} == ${walletBigInt.toString()}` : 'wallet not connected',
          ok: msgSenderOk
        }
      ]);
    } catch (error) {
      setStatus({ type: 'error', message: `Diagnostics error: ${error.message}` });
    }
  };

  const formatted = formatProofForContract();

  return (
    <div className="card">
      <h2>Step 3: Submit Proof to Smart Contract</h2>

      <div className="step-explanation">
        <h3>What happens in this step?</h3>
        <p>
          Your proof is submitted to the <strong>AgeVerification smart contract</strong> on Ethereum.
          The contract's <strong>Verifier</strong> checks the cryptographic proof and returns a
          yes/no result. No on-chain registry is stored. The proof is bound to your wallet address.
        </p>
        <div className="contract-flow">
          <div className="flow-step">
            <span className="flow-num">1</span>
            <span className="flow-text">Verify proof + public signals</span>
          </div>
          <div className="flow-step">
            <span className="flow-num">2</span>
            <span className="flow-text">Groth16 verification (on-chain)</span>
          </div>
          <div className="flow-step">
            <span className="flow-num">3</span>
            <span className="flow-text">Return yes/no result</span>
          </div>
        </div>
        <div className="process-steps">
          <div className="process-card">
            <h4>What is compared on-chain</h4>
            <div className="process-step">
              <span className="step-badge">1</span>
              <div>
                <div className="step-title">Issuer keys</div>
                <div className="step-desc">Proof issuer keys vs registered registry</div>
              </div>
            </div>
            <div className="process-step">
              <span className="step-badge">2</span>
              <div>
                <div className="step-title">Policy rules</div>
                <div className="step-desc">min_age and required_citizenship match contract</div>
              </div>
            </div>
            <div className="process-step">
              <span className="step-badge">3</span>
              <div>
                <div className="step-title">Wallet binding</div>
                <div className="step-desc">subject_wallet == msg.sender</div>
              </div>
            </div>
            <div className="process-step">
              <span className="step-badge">4</span>
              <div>
                <div className="step-title">Freshness check</div>
                <div className="step-desc">current_date within allowed range</div>
              </div>
            </div>
          </div>
          <div className="process-card">
            <h4>Proof data used</h4>
            <div className="process-step">
              <span className="step-badge">P</span>
              <div>
                <div className="step-title">Public signals</div>
                <div className="step-desc">
                  {proof?.publicSignals
                    ? `signals[3]=${formatValue(proof.publicSignals[3], 18)}, signals[5]=${formatValue(proof.publicSignals[5], 18)}`
                    : 'Not generated yet'}
                </div>
              </div>
            </div>
            <div className="process-step">
              <span className="step-badge">W</span>
              <div>
                <div className="step-title">Wallet</div>
                <div className="step-desc">{account || 'Not connected'}</div>
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

      {/* Wallet Connection */}
      <div className="section-card">
        <h3>Wallet Connection</h3>
        {account ? (
          <div className="wallet-info">
            <span className="wallet-label">Connected ({walletMode || 'metamask'}):</span>
            <span className="wallet-address">{account}</span>
          </div>
        ) : walletMode === 'ganache' ? (
          <div className="status info">
            Ganache wallet not available. Ensure Ganache is running at {GANACHE_RPC_URL}.
          </div>
        ) : (
          <button className="btn btn-primary" onClick={connectWallet}>
            Connect MetaMask
          </button>
        )}
      </div>

      {/* Contract Address */}
      <div className="section-card">
        <h3>Contract Address</h3>
        <div className="form-group">
          <input
            type="text"
            placeholder="0x..."
            value={contractAddress}
            onChange={(e) => setContractAddress(e.target.value)}
            className="contract-input"
            readOnly={demoMode}
          />
          <small>Enter the deployed AgeVerification contract address</small>
        </div>
        {demoMode && (
          <div className="status info">
            Demo mode uses the default contract address. Switch to Advanced Mode to edit.
          </div>
        )}
      </div>

      {/* Security Testing: Wrong Wallet Attack */}
      {proof && (
        <div className="selection-container security-test-section">
          <div className="selection-header">
            <h3>🔒 Security Testing: Wallet Selection</h3>
            <span className="selection-required">Required</span>
          </div>
          <p className="selection-description">
            Choose which wallet to submit the proof from. This demonstrates how wallet binding 
            prevents <strong>credential theft</strong> - Bob cannot steal and use your proof.
          </p>
          
          <div className="wallet-mode-selector">
            <label className={`wallet-option ${!useWrongWallet ? 'selected' : ''}`}>
              <input
                type="radio"
                name="walletMode"
                value="correct"
                checked={!useWrongWallet}
                onChange={() => setUseWrongWallet(false)}
              />
              <div className="wallet-content">
                <div className="wallet-header">
                  <strong>✓ Your Wallet (Normal Mode)</strong>
                  <span className="wallet-badge normal">Correct</span>
                </div>
                <p className="wallet-description">
                  Submit from your wallet (proof was generated for this wallet - will pass)
                </p>
              </div>
            </label>

            <label className={`wallet-option ${useWrongWallet ? 'selected' : ''}`}>
              <input
                type="radio"
                name="walletMode"
                value="wrong"
                checked={useWrongWallet}
                onChange={() => setUseWrongWallet(true)}
              />
              <div className="wallet-content">
                <div className="wallet-header">
                  <strong>⚠️ Bob's Wallet (Attack Simulation)</strong>
                  <span className="wallet-badge attack">Security Test</span>
                </div>
                <p className="wallet-description">
                  Submit from Bob's wallet (trying to use your proof - will fail)
                </p>
              </div>
            </label>
          </div>

          {useWrongWallet && (
            <div className="security-warning">
              <h4>⚠️ Attack Simulation Active</h4>
              <p>
                When enabled, the proof will be submitted from <strong>Bob's wallet (a different account)</strong> 
                instead of your wallet (which was used to generate the proof).
              </p>
              <p><strong>Expected Result:</strong></p>
              <ul>
                <li>✗ Verification will fail because <code>subject_wallet != msg.sender</code></li>
                <li>The contract enforces that only you can submit your own proof</li>
              </ul>
              
              <details className="security-details">
                <summary>🔐 Why wallet binding prevents credential theft</summary>
                <div className="security-explanation">
                  <p><strong>The Attack Scenario:</strong></p>
                  <p>
                    Imagine you prove you're 18+ and get a valid proof. Can an attacker (Bob) steal your 
                    proof and use it to pretend he's 18+?
                  </p>
                  
                  <p><strong>How Wallet Binding Prevents This:</strong></p>
                  <ol>
                    <li>
                      <strong>Proof Generation:</strong> When you generate your proof, your wallet 
                      address is included as a public input (<code>subject_wallet</code>) and the 
                      circuit enforces: <code>user_pubkey === subject_wallet</code>
                    </li>
                    <li>
                      <strong>On-Chain Verification:</strong> The smart contract checks: 
                      <code>publicSignals[8] == msg.sender</code>, meaning the proof's declared 
                      wallet must match the transaction sender.
                    </li>
                    <li>
                      <strong>Attack Fails:</strong> If Bob tries to submit your proof, 
                      <code>msg.sender</code> will be Bob's address, which doesn't match your 
                      address in <code>publicSignals[8]</code>, so verification fails.
                    </li>
                  </ol>
                  
                  <p className="security-conclusion">
                    <strong>Conclusion:</strong> Each proof is cryptographically bound to a specific 
                    wallet address. You cannot "transfer" or "steal" someone else's proof because 
                    the blockchain will reject it when you try to submit it from a different wallet.
                  </p>
                </div>
              </details>
            </div>
          )}
        </div>
      )}

      {proof && (
        <div className="section-card">
          <h3>Diagnostics</h3>
          <p className="data-description">
            Check public signals and contract conditions. Note: Groth16 verification is all-or-nothing - 
            diagnostics can only help narrow down possible causes, not identify which specific circuit constraint failed.
          </p>
          <div className="button-group">
            <button className="btn btn-secondary" onClick={runDiagnostics}>
              Run Diagnostics
            </button>
          </div>
          {diagnostics && (
            <div className="diagnostic-list">
              {diagnostics.map((item) => (
                <div className={`diagnostic-item ${item.ok ? 'ok' : 'fail'} ${item.highlight ? 'highlight' : ''}`} key={item.label}>
                  <span className="diagnostic-label">{item.label}</span>
                  <span className="diagnostic-value">{item.value}</span>
                  {!item.ok && item.reason && (
                    <div className="diagnostic-reason">
                      <strong>Why it failed:</strong> {item.reason}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Proof Data to Submit */}
      {proof && (
        <div className="section-card">
          <div className="section-header" onClick={() => setShowProofData(!showProofData)}>
            <h3>Data Being Submitted to Contract</h3>
            <span className="toggle-icon">{showProofData ? '−' : '+'}</span>
          </div>

          {showProofData && formatted && (
            <div className="proof-data-display">
              <p className="data-description">
                This is the exact data that will be sent to the <code>verifyProof()</code> function:
              </p>

              <div className="contract-call">
                <div className="call-header">
                  <code>verifyProof(a, b, c, input)</code>
                </div>

                <div className="call-params">
                  <div className="param-group">
                    <h4>a (uint[2]) - G1 Point</h4>
                    <div className="param-value">
                      <span className="param-index">[0]:</span>
                      <span className="param-data">{formatValue(formatted.a[0], 30)}</span>
                    </div>
                    <div className="param-value">
                      <span className="param-index">[1]:</span>
                      <span className="param-data">{formatValue(formatted.a[1], 30)}</span>
                    </div>
                  </div>

                  <div className="param-group">
                    <h4>b (uint[2][2]) - G2 Point</h4>
                    <div className="param-value">
                      <span className="param-index">[0][0]:</span>
                      <span className="param-data">{formatValue(formatted.b[0][0], 24)}</span>
                    </div>
                    <div className="param-value">
                      <span className="param-index">[0][1]:</span>
                      <span className="param-data">{formatValue(formatted.b[0][1], 24)}</span>
                    </div>
                    <div className="param-value">
                      <span className="param-index">[1][0]:</span>
                      <span className="param-data">{formatValue(formatted.b[1][0], 24)}</span>
                    </div>
                    <div className="param-value">
                      <span className="param-index">[1][1]:</span>
                      <span className="param-data">{formatValue(formatted.b[1][1], 24)}</span>
                    </div>
                  </div>

                  <div className="param-group">
                    <h4>c (uint[2]) - G1 Point</h4>
                    <div className="param-value">
                      <span className="param-index">[0]:</span>
                      <span className="param-data">{formatValue(formatted.c[0], 30)}</span>
                    </div>
                    <div className="param-value">
                      <span className="param-index">[1]:</span>
                      <span className="param-data">{formatValue(formatted.c[1], 30)}</span>
                    </div>
                  </div>

                  <div className="param-group">
                    <h4>input (uint[9]) - Public Signals</h4>
                    {formatted.input.map((val, idx) => (
                      <div className="param-value" key={idx}>
                        <span className="param-index">[{idx}]:</span>
                        <span className="param-data">{formatValue(val, 30)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="explanation-box">
                <strong>What the contract checks:</strong>
                <ul>
                  <li>Cryptographic pairing check on (a, b, c) proves the statement is true</li>
                  <li>Public signals must match expected values (current date, min age, issuer keys)</li>
                  <li>Issuer public keys must be in the trusted registry</li>
                  <li>If all checks pass, the call returns <code>true</code></li>
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Result Message */}
      {verificationStatus && (
        <div className={`success-card ${verificationStatus.success ? '' : 'status error'}`}>
          <h3>Verification Result</h3>
          <p>
            Result: <strong>{verificationStatus.success ? 'YES' : 'NO'}</strong>
          </p>
          {verificationStatus.success ? (
            <div className="success-points">
              <div className="success-point">
                <span className="check-icon">&#10003;</span>
                <span>Age verified (18+)</span>
              </div>
              <div className="success-point">
                <span className="check-icon">&#10003;</span>
                <span>Citizenship verified (US)</span>
              </div>
              <div className="success-point">
                <span className="check-icon">&#10003;</span>
                <span>Privacy preserved (no personal data on-chain)</span>
              </div>
            </div>
          ) : (
            <div className="failure-message">
              <p>❌ <strong>Groth16 verification failed</strong></p>
              <p className="failure-hint">
                Groth16 only returns true/false - it cannot tell which constraint failed.
              </p>
              <p className="failure-hint">
                Run "Diagnostics" above to check public signals and narrow down possible causes.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="button-group">
        <button className="btn btn-secondary" onClick={onBack}>
          Back
        </button>
        <button
          className="btn btn-primary"
          onClick={handleSubmitProof}
          disabled={!proof || !account || !contractAddress || loading}
        >
          {loading ? (
            <>
              <span className="loading"></span> Verifying...
            </>
          ) : (
            'Verify Proof'
          )}
        </button>
        {verificationStatus && (
          <button className="btn btn-secondary" onClick={onNext}>
            Next: Summary
          </button>
        )}
      </div>
    </div>
  );
}

export default SubmitProof;
