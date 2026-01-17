import React, { useState } from 'react';
import { ethers } from 'ethers';
import { getPublicKey } from '@noble/secp256k1';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import './Prerequisites.css';

const GANACHE_RPC_URL = 'http://127.0.0.1:8545';
const AGE_VERIFICATION_ABI = [
  "function addTrustedIssuerA(uint256,uint256) external",
  "function addTrustedIssuerB(uint256,uint256) external"
];
const BN254_SCALAR_FIELD =
  BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');

function Prerequisites({
  issuerPrivateKeys,
  setIssuerPrivateKeys,
  contractAddress,
  setContractAddress,
  deployerPrivateKey,
  setDeployerPrivateKey,
  demoMode,
  setDemoMode,
  onNext
}) {
  const [status, setStatus] = useState(null);
  const [registering, setRegistering] = useState(false);
  const handleIssuerChange = (key) => (event) => {
    setIssuerPrivateKeys((prev) => ({
      ...prev,
      [key]: event.target.value
    }));
  };

  const deriveIssuerPubkey = (privateKeyHex) => {
    const privBytes = hexToBytes(privateKeyHex.replace(/^0x/, ''));
    const pubkey = getPublicKey(privBytes, false);
    const rawX = BigInt(`0x${bytesToHex(pubkey.slice(1, 33))}`);
    const rawY = BigInt(`0x${bytesToHex(pubkey.slice(33, 65))}`);
    const reducedX = (rawX % BN254_SCALAR_FIELD).toString();
    const reducedY = (rawY % BN254_SCALAR_FIELD).toString();
    return {
      rawX: rawX.toString(),
      rawY: rawY.toString(),
      reducedX,
      reducedY
    };
  };

  const handleRegisterIssuers = async () => {
    setRegistering(true);
    setStatus({ type: 'info', message: 'Registering issuers on-chain...' });
    try {
      if (!contractAddress) {
        throw new Error('Enter the AgeVerification contract address.');
      }
      if (!deployerPrivateKey) {
        throw new Error('Enter the deployer private key.');
      }
      if (!issuerPrivateKeys?.a || !issuerPrivateKeys?.b) {
        throw new Error('Enter Issuer A and Issuer B private keys.');
      }

      const issuerA = deriveIssuerPubkey(issuerPrivateKeys.a);
      const issuerB = deriveIssuerPubkey(issuerPrivateKeys.b);

      const provider = new ethers.JsonRpcProvider(GANACHE_RPC_URL);
      const signer = new ethers.Wallet(deployerPrivateKey, provider);
      const contract = new ethers.Contract(contractAddress, AGE_VERIFICATION_ABI, signer);

      const baseNonce = await provider.getTransactionCount(signer.address, 'pending');
      const txA = await contract.addTrustedIssuerA(issuerA.reducedX, issuerA.reducedY, { nonce: baseNonce });
      await txA.wait();

      const txB = await contract.addTrustedIssuerB(issuerB.reducedX, issuerB.reducedY, { nonce: baseNonce + 1 });
      await txB.wait();

      setStatus({ type: 'success', message: 'Issuers registered on-chain.' });
    } catch (error) {
      setStatus({ type: 'error', message: `Error: ${error.message}` });
    } finally {
      setRegistering(false);
    }
  };

  return (
    <div className="card">
      <h2>Step 0: Setup (For Non-Technical Users)</h2>
      <p>
        This demo requires just <strong>2 simple commands</strong> to get started. 
        Run these in your terminal before using the frontend.
      </p>
      
      <div className="setup-instructions">
        <div className="setup-step">
          <div className="step-number">1</div>
          <div className="step-content">
            <h3>Start Ganache (Local Blockchain)</h3>
            <p>Open a terminal and run:</p>
            <div className="code-block">
              <code>ganache -d -g 1</code>
            </div>
            <p className="step-note">
              Keep this terminal running. The <code>-d</code> flag uses fixed accounts for demo mode.
            </p>
          </div>
        </div>

        <div className="setup-step">
          <div className="step-number">2</div>
          <div className="step-content">
            <h3>Run Automated Setup</h3>
            <p>Open another terminal and run:</p>
            <div className="code-block">
              <code>npm run setup:demo</code>
            </div>
            <p className="step-note">
              This automatically handles: circuit compilation, trusted setup, contract deployment, 
              issuer registration, credential issuance, and artifact copying. Takes about 2-3 minutes.
            </p>
          </div>
        </div>
      </div>

      <div className="what-it-does">
        <h3>What <code>npm run setup:demo</code> does:</h3>
        <ol>
          <li>Compiles the ZK circuit</li>
          <li>Runs the trusted setup ceremony</li>
          <li>Deploys smart contracts to Ganache</li>
          <li>Registers Issuer A/B public keys on-chain</li>
          <li>Issues demo credentials (DOB + citizenship)</li>
          <li>Copies artifacts to <code>frontend/public/artifacts</code> for auto-load</li>
        </ol>
        <p className="tip">
          <strong>💡 Tip:</strong> If you make changes to the circuit or contracts, just re-run 
          <code>npm run setup:demo</code> to rebuild everything.
        </p>
      </div>
      <div className="advanced-section">
        <details>
          <summary><strong>⚙️ Advanced: Manual Configuration</strong></summary>
          <div className="advanced-content">
            <p>
              For advanced users who want to customize issuer keys or contract addresses, 
              use the options below.
            </p>
            
            <div className="form-group">
              <label>Demo Mode</label>
              <div className="button-group">
                <button
                  className={`btn ${demoMode ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setDemoMode(true)}
                >
                  Demo Mode On
                </button>
                <button
                  className={`btn ${!demoMode ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setDemoMode(false)}
                >
                  Advanced Mode
                </button>
              </div>
              {demoMode && (
                <div className="status info">
                  Using Ganache defaults (fixed private keys + contract address). No manual input required.
                </div>
              )}
            </div>

            <div className="form-group">
              <label>Issuer A Private Key</label>
              <input
                type="text"
                placeholder="0x..."
                value={issuerPrivateKeys.a}
                onChange={handleIssuerChange('a')}
                readOnly={demoMode}
              />
            </div>
            <div className="form-group">
              <label>Issuer B Private Key</label>
              <input
                type="text"
                placeholder="0x..."
                value={issuerPrivateKeys.b}
                onChange={handleIssuerChange('b')}
                readOnly={demoMode}
              />
            </div>
            <div className="form-group">
              <label>AgeVerification Contract Address</label>
              <input
                type="text"
                placeholder="0x..."
                value={contractAddress}
                onChange={(e) => setContractAddress(e.target.value)}
                readOnly={demoMode}
              />
            </div>
            <div className="form-group">
              <label>Deployer Private Key (Ganache)</label>
              <input
                type="text"
                placeholder="0x..."
                value={deployerPrivateKey}
                onChange={(e) => setDeployerPrivateKey(e.target.value)}
                readOnly={demoMode}
              />
            </div>
            
            <h4>Manual Issuer Registration</h4>
            <p>
              If you didn't run <code>npm run setup:demo</code> or want to re-register issuers, 
              use this button:
            </p>
            <div className="button-group">
              <button className="btn btn-secondary" onClick={handleRegisterIssuers} disabled={registering}>
                {registering ? 'Registering...' : 'Register Issuers On-Chain'}
              </button>
            </div>
            
            {issuerPrivateKeys?.a && issuerPrivateKeys?.b && (
              <div className="status info">
                <div><strong>Issuer A pubkey (raw):</strong> X={deriveIssuerPubkey(issuerPrivateKeys.a).rawX.slice(0, 20)}...</div>
                <div><strong>Issuer A pubkey (reduced):</strong> X={deriveIssuerPubkey(issuerPrivateKeys.a).reducedX.slice(0, 20)}...</div>
                <div><strong>Issuer B pubkey (raw):</strong> X={deriveIssuerPubkey(issuerPrivateKeys.b).rawX.slice(0, 20)}...</div>
                <div><strong>Issuer B pubkey (reduced):</strong> X={deriveIssuerPubkey(issuerPrivateKeys.b).reducedX.slice(0, 20)}...</div>
                <div>On-chain registration uses the <strong>reduced</strong> values.</div>
              </div>
            )}
            {status && (
              <div className={`status ${status.type}`}>
                {status.message}
              </div>
            )}
          </div>
        </details>
      </div>
      <div className="button-group">
        <button className="btn btn-primary" onClick={onNext}>
          Continue to Step 1
        </button>
      </div>
    </div>
  );
}

export default Prerequisites;
