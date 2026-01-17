# Feature: On-Chain Verification Recording & Audit Trail

**Status**: 📋 Planned  
**Priority**: Medium  
**Estimated Effort**: 6-8 hours  
**Target Version**: v2.1

---

## Overview

Add comprehensive audit trail capabilities to the ZK identity verification system by introducing an on-chain recording mechanism that captures verification attempts with full proof data and issuer information.

### Problem Statement

Currently, the `verifyProof()` function is a `view` function that:
- ✅ Provides free, gas-less verification
- ❌ Doesn't create any on-chain record
- ❌ Cannot be audited after the fact
- ❌ No way to trace which issuers were involved in historical verifications

For compliance, auditing, and issuer accountability, we need a way to permanently record verification attempts on-chain.

### Proposed Solution

Introduce a dual-mode verification system:
1. **View Mode** (`verifyProof()`) - Existing free verification (no changes)
2. **Record Mode** (`verifyAndRecord()`) - New function that emits comprehensive audit events

Users can choose which mode to use based on their needs (cost vs. auditability).

---

## Technical Specification

### 1. Smart Contract Changes

**File**: `src/AgeVerification.sol`

#### New Event

```solidity
/// @notice Emitted when a proof verification is recorded on-chain
/// @dev Contains complete proof data for full audit trail
event ProofVerificationRecorded(
    address indexed user,              // Wallet that submitted the proof
    bool indexed result,               // Verification result (true/false)
    uint256 timestamp,                 // Block timestamp
    // Public Signals (9 elements)
    uint256 currentDate,               // Proof generation timestamp
    uint256 minAge,                    // Minimum age requirement
    uint256 requiredCitizenship,       // Required citizenship code
    uint256 issuerAPubkeyX,           // Issuer A public key X coordinate
    uint256 issuerAPubkeyY,           // Issuer A public key Y coordinate
    uint256 issuerBPubkeyX,           // Issuer B public key X coordinate
    uint256 issuerBPubkeyY,           // Issuer B public key Y coordinate
    uint256 userPubkey,               // User's public key (wallet binding)
    uint256 subjectWallet,            // Subject wallet address
    // Proof Components (for full reproducibility)
    uint256[2] proofA,                // Proof component π_A (G1 point)
    uint256[2][2] proofB,             // Proof component π_B (G2 point)
    uint256[2] proofC                 // Proof component π_C (G1 point)
);
```

#### New Function

```solidity
/**
 * @notice Verifies a zero-knowledge proof AND records it on-chain
 * @dev Same verification logic as verifyProof() but emits event for audit trail
 * @dev This is a state-changing function and costs gas
 * 
 * @param a Proof component a (G1 point)
 * @param b Proof component b (G2 point)
 * @param c Proof component c (G1 point)
 * @param input Public inputs to the circuit (9 elements)
 * @return bool True if verification passes, false otherwise
 * 
 * Gas Cost: ~350,000 - 400,000 gas
 * - Verification: ~280,000 gas
 * - Event emission: ~50,000 gas
 * - Other operations: ~20,000-70,000 gas
 */
function verifyAndRecord(
    uint[2] memory a,
    uint[2][2] memory b,
    uint[2] memory c,
    uint[9] memory input
) external returns (bool) {
    // Perform verification using existing logic
    bool result = this.verifyProof(a, b, c, input);
    
    // Emit comprehensive event regardless of verification result
    // This ensures failed attempts are also recorded for audit purposes
    emit ProofVerificationRecorded(
        msg.sender,
        result,
        block.timestamp,
        // Public signals
        input[0],  // current_date
        input[1],  // min_age
        input[2],  // required_citizenship
        input[3],  // issuer_a_pubkey_x
        input[4],  // issuer_a_pubkey_y
        input[5],  // issuer_b_pubkey_x
        input[6],  // issuer_b_pubkey_y
        input[7],  // user_pubkey
        input[8],  // subject_wallet
        // Proof components
        a,
        b,
        c
    );
    
    return result;
}
```

**Design Decisions**:
- ✅ Records both success AND failure (important for security audits)
- ✅ Includes full proof data (enables independent verification)
- ✅ Includes issuer public keys (enables issuer tracking)
- ✅ Indexed fields (user, result) for efficient filtering
- ✅ Calls existing `verifyProof()` to avoid code duplication

---

### 2. Frontend: Step 3 Updates

**File**: `frontend/src/components/SubmitProof.jsx`

#### New State

```javascript
const [recordOnChain, setRecordOnChain] = useState(false);
```

#### New UI Component

Add verification mode selector (similar to existing issuer/wallet/circuit selectors):

```jsx
{/* Verification Mode Selection */}
<div className="selection-container">
  <div className="selection-header">
    <h3>🔍 Verification Mode</h3>
    <span className="selection-required">Choose one</span>
  </div>
  <div className="selection-description">
    Choose whether to record this verification on-chain for audit purposes.
  </div>
  
  <div className="verification-mode-selector">
    {/* View Only Mode */}
    <label className={`mode-option ${!recordOnChain ? 'selected' : ''}`}>
      <input
        type="radio"
        name="verificationMode"
        checked={!recordOnChain}
        onChange={() => setRecordOnChain(false)}
      />
      <div className="mode-content">
        <div className="mode-header">
          <span className="mode-title">View Only</span>
          <span className="mode-badge normal">FREE</span>
        </div>
        <p className="mode-description">
          Check eligibility without recording on-chain. Zero gas cost. 
          Best for testing or when audit trail is not needed.
        </p>
        <ul className="mode-features">
          <li>✓ Zero gas cost (view function)</li>
          <li>✓ Instant result</li>
          <li>✗ No on-chain record</li>
          <li>✗ Cannot be audited later</li>
        </ul>
      </div>
    </label>
    
    {/* Record On-Chain Mode */}
    <label className={`mode-option ${recordOnChain ? 'selected' : ''}`}>
      <input
        type="radio"
        name="verificationMode"
        checked={recordOnChain}
        onChange={() => setRecordOnChain(true)}
      />
      <div className="mode-content">
        <div className="mode-header">
          <span className="mode-title">Record On-Chain</span>
          <span className="mode-badge record">AUDIT</span>
        </div>
        <p className="mode-description">
          Record verification for permanent audit trail. Costs gas but creates 
          immutable record with full proof data and issuer information.
        </p>
        <ul className="mode-features">
          <li>✓ Permanent on-chain record</li>
          <li>✓ Full audit trail</li>
          <li>✓ Issuer tracking</li>
          <li>⚠ Costs gas (~$0.05 on Polygon, ~$20-30 on mainnet)</li>
        </ul>
      </div>
    </label>
  </div>
  
  {recordOnChain && (
    <div className="record-info-box">
      <strong>📋 What Gets Recorded:</strong>
      <ul>
        <li>Your wallet address</li>
        <li>Verification result (YES/NO)</li>
        <li>Timestamp</li>
        <li>Issuer public key hashes (which issuers signed your credentials)</li>
        <li>Full proof data (π_a, π_b, π_c)</li>
        <li>All public signals (age requirement, citizenship requirement, etc.)</li>
      </ul>
      <p><strong>Privacy Note:</strong> Your actual DOB and citizenship remain private - only public signals are recorded.</p>
    </div>
  )}
</div>
```

#### Updated Submit Logic

```javascript
const handleSubmitProof = async () => {
  if (!proof) {
    setStatus({ type: 'error', message: 'Please generate a proof first' });
    return;
  }

  setLoading(true);
  setStatus(null);

  try {
    const provider = walletMode === 'ganache'
      ? new ethers.JsonRpcProvider(GANACHE_RPC_URL)
      : new ethers.BrowserProvider(window.ethereum);

    const signer = walletMode === 'ganache'
      ? new ethers.Wallet(
          useWrongWallet ? GANACHE_WRONG_WALLET_KEY : GANACHE_PRIVATE_KEY,
          provider
        )
      : await provider.getSigner();

    const contract = new ethers.Contract(contractAddress, AGE_VERIFICATION_ABI, provider);
    const contractWithSigner = contract.connect(signer);
    const formatted = formatProofForContract();

    let result;
    let transactionHash = null;
    
    if (recordOnChain) {
      // Use verifyAndRecord() - Transaction (costs gas)
      setStatus({ type: 'info', message: 'Submitting proof with on-chain recording...' });
      
      const tx = await contractWithSigner.verifyAndRecord(
        formatted.a,
        formatted.b,
        formatted.c,
        formatted.input.map(s => BigInt(s))
      );
      
      setStatus({ type: 'info', message: 'Waiting for transaction confirmation...' });
      const receipt = await tx.wait();
      transactionHash = receipt.hash;
      
      // Parse ProofVerificationRecorded event to get actual result
      const eventInterface = new ethers.Interface([
        'event ProofVerificationRecorded(address indexed user, bool indexed result, uint256 timestamp, uint256 currentDate, uint256 minAge, uint256 requiredCitizenship, uint256 issuerAPubkeyX, uint256 issuerAPubkeyY, uint256 issuerBPubkeyX, uint256 issuerBPubkeyY, uint256 userPubkey, uint256 subjectWallet, uint256[2] proofA, uint256[2][2] proofB, uint256[2] proofC)'
      ]);
      
      const event = receipt.logs.find(log => {
        try {
          const parsed = eventInterface.parseLog(log);
          return parsed.name === 'ProofVerificationRecorded';
        } catch {
          return false;
        }
      });
      
      if (event) {
        const parsed = eventInterface.parseLog(event);
        result = parsed.args.result;
      } else {
        // Fallback: transaction success means verification passed
        result = receipt.status === 1;
      }
      
    } else {
      // Use verifyProof() - View function (free)
      setStatus({ type: 'info', message: 'Verifying proof (view only)...' });
      
      result = await contract.verifyProof(
        formatted.a,
        formatted.b,
        formatted.c,
        formatted.input.map(s => BigInt(s))
      );
    }

    setVerificationStatus({
      success: result,
      recorded: recordOnChain,
      transactionHash: transactionHash
    });

    setStatus({
      type: result ? 'success' : 'error',
      message: result
        ? recordOnChain 
          ? `✓ Verification passed and recorded on-chain! Tx: ${transactionHash?.slice(0, 10)}...`
          : '✓ Verification passed!'
        : recordOnChain
          ? `✗ Verification failed (recorded on-chain for audit)`
          : '✗ Verification failed'
    });

    if (result && onNext) {
      setTimeout(() => onNext(), 2000);
    }
  } catch (error) {
    console.error('Verification error:', error);
    setStatus({
      type: 'error',
      message: `Verification error: ${error.message}`
    });
  } finally {
    setLoading(false);
  }
};
```

**File**: `frontend/src/components/SubmitProof.css`

Add styles:

```css
/* Verification Mode Selector */
.verification-mode-selector {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.mode-badge.record {
  background: #fbbf24;
  color: #92400e;
  font-weight: 600;
}

.record-info-box {
  margin-top: 16px;
  padding: 16px;
  background: #fffbeb;
  border: 2px solid #fbbf24;
  border-radius: 8px;
  font-size: 0.9rem;
}

.record-info-box strong {
  color: #92400e;
  display: block;
  margin-bottom: 8px;
}

.record-info-box ul {
  margin: 8px 0;
  padding-left: 20px;
}

.record-info-box li {
  margin: 4px 0;
  color: #78350f;
}
```

---

### 3. Frontend: New Step 5 (Verification Records)

**File**: `frontend/src/components/VerificationRecords.jsx` (NEW)

Create a new component to display all recorded verifications:

```javascript
import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import './VerificationRecords.css';

const AGE_VERIFICATION_ABI = [
  "event ProofVerificationRecorded(address indexed user, bool indexed result, uint256 timestamp, uint256 currentDate, uint256 minAge, uint256 requiredCitizenship, uint256 issuerAPubkeyX, uint256 issuerAPubkeyY, uint256 issuerBPubkeyX, uint256 issuerBPubkeyY, uint256 userPubkey, uint256 subjectWallet, uint256[2] proofA, uint256[2][2] proofB, uint256[2] proofC)"
];

function VerificationRecords({ contractAddress, walletMode, onBack }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedRecord, setExpandedRecord] = useState(null);
  const [filterResult, setFilterResult] = useState('all'); // 'all', 'success', 'failure'
  const [filterUser, setFilterUser] = useState('');

  useEffect(() => {
    if (contractAddress && walletMode === 'ganache') {
      fetchRecords();
    }
  }, [contractAddress, walletMode]);

  const fetchRecords = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
      const contract = new ethers.Contract(contractAddress, AGE_VERIFICATION_ABI, provider);
      
      console.log('Fetching ProofVerificationRecorded events...');
      
      // Query all events from block 0 to latest
      const filter = contract.filters.ProofVerificationRecorded();
      const events = await contract.queryFilter(filter, 0, 'latest');
      
      console.log(`Found ${events.length} verification records`);
      
      // Parse events into structured records
      const parsedRecords = await Promise.all(
        events.map(async (event) => {
          const args = event.args;
          const block = await event.getBlock();
          
          // Calculate issuer hashes (same as contract does)
          const issuerAHash = ethers.solidityPackedKeccak256(
            ['uint256', 'uint256'],
            [args.issuerAPubkeyX, args.issuerAPubkeyY]
          );
          const issuerBHash = ethers.solidityPackedKeccak256(
            ['uint256', 'uint256'],
            [args.issuerBPubkeyX, args.issuerBPubkeyY]
          );
          
          return {
            blockNumber: event.blockNumber,
            transactionHash: event.transactionHash,
            timestamp: Number(block.timestamp),
            user: args.user,
            result: args.result,
            recordTimestamp: Number(args.timestamp),
            publicSignals: {
              currentDate: args.currentDate.toString(),
              minAge: args.minAge.toString(),
              requiredCitizenship: args.requiredCitizenship.toString(),
              issuerAPubkeyX: args.issuerAPubkeyX.toString(),
              issuerAPubkeyY: args.issuerAPubkeyY.toString(),
              issuerBPubkeyX: args.issuerBPubkeyX.toString(),
              issuerBPubkeyY: args.issuerBPubkeyY.toString(),
              userPubkey: args.userPubkey.toString(),
              subjectWallet: args.subjectWallet.toString()
            },
            issuerHashes: {
              issuerA: issuerAHash,
              issuerB: issuerBHash
            },
            proof: {
              a: [args.proofA[0].toString(), args.proofA[1].toString()],
              b: [
                [args.proofB[0][0].toString(), args.proofB[0][1].toString()],
                [args.proofB[1][0].toString(), args.proofB[1][1].toString()]
              ],
              c: [args.proofC[0].toString(), args.proofC[1].toString()]
            }
          };
        })
      );
      
      // Sort by newest first
      parsedRecords.sort((a, b) => b.blockNumber - a.blockNumber);
      setRecords(parsedRecords);
      
    } catch (err) {
      console.error('Error fetching records:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredRecords = records.filter(record => {
    // Filter by result
    if (filterResult === 'success' && !record.result) return false;
    if (filterResult === 'failure' && record.result) return false;
    
    // Filter by user address
    if (filterUser && !record.user.toLowerCase().includes(filterUser.toLowerCase())) {
      return false;
    }
    
    return true;
  });

  const formatDate = (timestamp) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const formatAddress = (address) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="card verification-records-page">
      <h2>Step 5: Verification Records (Audit Trail)</h2>

      <div className="step-explanation">
        <h3>📋 On-Chain Verification History</h3>
        <p>
          This page displays all verifications that were recorded on-chain using the{' '}
          <code>verifyAndRecord()</code> function. Each record includes complete proof data,
          issuer information, and verification results for comprehensive audit purposes.
        </p>
        
        <div className="ganache-note">
          <strong>ℹ️ Note:</strong> This feature currently works with Ganache local blockchain
          by scanning blocks sequentially. For production use on mainnet/testnets, you would use:
          <ul>
            <li><strong>The Graph</strong> - Decentralized indexing protocol</li>
            <li><strong>Etherscan API</strong> - Centralized event querying</li>
            <li><strong>Alchemy/Infura Enhanced APIs</strong> - Improved event filtering</li>
          </ul>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <div className="filter-group">
          <label>Result:</label>
          <select value={filterResult} onChange={(e) => setFilterResult(e.target.value)}>
            <option value="all">All</option>
            <option value="success">Success Only</option>
            <option value="failure">Failures Only</option>
          </select>
        </div>
        
        <div className="filter-group">
          <label>User Address:</label>
          <input
            type="text"
            placeholder="Filter by address..."
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
          />
        </div>

        <button className="btn btn-secondary" onClick={fetchRecords} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh Records'}
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="loading-state">
          <span className="loading"></span>
          <p>Scanning blockchain for verification records...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="error-message">
          <strong>Error loading records:</strong> {error}
        </div>
      )}

      {/* Records Table */}
      {!loading && !error && (
        <>
          <div className="records-summary">
            <p>
              <strong>Total Records:</strong> {records.length} |{' '}
              <strong>Filtered:</strong> {filteredRecords.length} |{' '}
              <strong>Success:</strong> {records.filter(r => r.result).length} |{' '}
              <strong>Failed:</strong> {records.filter(r => !r.result).length}
            </p>
          </div>

          {filteredRecords.length === 0 ? (
            <div className="empty-state">
              <p>No verification records found.</p>
              <p>Records will appear here after using "Record On-Chain" mode in Step 3.</p>
            </div>
          ) : (
            <div className="records-table">
              <table>
                <thead>
                  <tr>
                    <th>Block</th>
                    <th>Timestamp</th>
                    <th>User</th>
                    <th>Result</th>
                    <th>Issuer A Hash</th>
                    <th>Issuer B Hash</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((record, index) => (
                    <React.Fragment key={index}>
                      <tr className={record.result ? 'success-row' : 'failure-row'}>
                        <td>{record.blockNumber}</td>
                        <td title={formatDate(record.timestamp)}>
                          {new Date(record.timestamp * 1000).toLocaleDateString()}
                        </td>
                        <td title={record.user}>{formatAddress(record.user)}</td>
                        <td>
                          <span className={`status-badge ${record.result ? 'success' : 'failure'}`}>
                            {record.result ? '✓ PASS' : '✗ FAIL'}
                          </span>
                        </td>
                        <td className="hash-cell" title={record.issuerHashes.issuerA}>
                          {record.issuerHashes.issuerA.slice(0, 10)}...
                        </td>
                        <td className="hash-cell" title={record.issuerHashes.issuerB}>
                          {record.issuerHashes.issuerB.slice(0, 10)}...
                        </td>
                        <td>
                          <button
                            className="btn-expand"
                            onClick={() =>
                              setExpandedRecord(expandedRecord === index ? null : index)
                            }
                          >
                            {expandedRecord === index ? '▼ Hide' : '▶ Show'}
                          </button>
                        </td>
                      </tr>
                      
                      {/* Expanded Details */}
                      {expandedRecord === index && (
                        <tr className="expanded-row">
                          <td colSpan="7">
                            <div className="record-details">
                              
                              {/* Transaction Info */}
                              <div className="detail-section">
                                <h4>Transaction Information</h4>
                                <div className="detail-grid">
                                  <div className="detail-item">
                                    <strong>Transaction Hash:</strong>
                                    <code>{record.transactionHash}</code>
                                  </div>
                                  <div className="detail-item">
                                    <strong>Block Number:</strong>
                                    <span>{record.blockNumber}</span>
                                  </div>
                                  <div className="detail-item">
                                    <strong>Timestamp:</strong>
                                    <span>{formatDate(record.timestamp)}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Public Signals */}
                              <div className="detail-section">
                                <h4>Public Signals</h4>
                                <div className="detail-grid">
                                  <div className="detail-item">
                                    <strong>User:</strong>
                                    <code>{record.user}</code>
                                  </div>
                                  <div className="detail-item">
                                    <strong>Subject Wallet:</strong>
                                    <code>{record.publicSignals.subjectWallet}</code>
                                  </div>
                                  <div className="detail-item">
                                    <strong>Min Age:</strong>
                                    <span>{record.publicSignals.minAge}</span>
                                  </div>
                                  <div className="detail-item">
                                    <strong>Required Citizenship:</strong>
                                    <span>{record.publicSignals.requiredCitizenship}</span>
                                  </div>
                                  <div className="detail-item">
                                    <strong>Proof Date:</strong>
                                    <span>{formatDate(Number(record.publicSignals.currentDate))}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Issuer Information */}
                              <div className="detail-section">
                                <h4>Issuer Information</h4>
                                <div className="issuer-info">
                                  <div className="issuer-card">
                                    <strong>Issuer A (DOB Credential)</strong>
                                    <div className="issuer-details">
                                      <p><strong>Public Key X:</strong></p>
                                      <code>{record.publicSignals.issuerAPubkeyX}</code>
                                      <p><strong>Public Key Y:</strong></p>
                                      <code>{record.publicSignals.issuerAPubkeyY}</code>
                                      <p><strong>Registry Hash:</strong></p>
                                      <code>{record.issuerHashes.issuerA}</code>
                                    </div>
                                  </div>
                                  
                                  <div className="issuer-card">
                                    <strong>Issuer B (Citizenship Credential)</strong>
                                    <div className="issuer-details">
                                      <p><strong>Public Key X:</strong></p>
                                      <code>{record.publicSignals.issuerBPubkeyX}</code>
                                      <p><strong>Public Key Y:</strong></p>
                                      <code>{record.publicSignals.issuerBPubkeyY}</code>
                                      <p><strong>Registry Hash:</strong></p>
                                      <code>{record.issuerHashes.issuerB}</code>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Proof Data */}
                              <div className="detail-section">
                                <h4>Groth16 Proof Components</h4>
                                <div className="proof-data">
                                  <div className="proof-component">
                                    <strong>π_A (G1 point):</strong>
                                    <pre>{JSON.stringify(record.proof.a, null, 2)}</pre>
                                  </div>
                                  <div className="proof-component">
                                    <strong>π_B (G2 point):</strong>
                                    <pre>{JSON.stringify(record.proof.b, null, 2)}</pre>
                                  </div>
                                  <div className="proof-component">
                                    <strong>π_C (G1 point):</strong>
                                    <pre>{JSON.stringify(record.proof.c, null, 2)}</pre>
                                  </div>
                                </div>
                              </div>

                              {/* Audit Notes */}
                              <div className="detail-section audit-note">
                                <h4>📋 Audit Trail Information</h4>
                                <p>
                                  This record provides a complete audit trail for this verification attempt.
                                  You can:
                                </p>
                                <ul>
                                  <li>Verify the proof independently using the Groth16 verifier</li>
                                  <li>Contact Issuer A using their public key hash: <code>{record.issuerHashes.issuerA.slice(0, 16)}...</code></li>
                                  <li>Contact Issuer B using their public key hash: <code>{record.issuerHashes.issuerB.slice(0, 16)}...</code></li>
                                  <li>Request the original credentials from issuers if needed</li>
                                  <li>Confirm the wallet binding matches the user address</li>
                                </ul>
                                <p className="privacy-note">
                                  <strong>Privacy Note:</strong> The actual date of birth and citizenship
                                  information are NOT recorded on-chain. Only the proof of eligibility is stored.
                                </p>
                              </div>

                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Navigation */}
      <div className="button-group">
        <button className="btn btn-secondary" onClick={onBack}>
          Back to Summary
        </button>
      </div>
    </div>
  );
}

export default VerificationRecords;
```

**File**: `frontend/src/components/VerificationRecords.css` (NEW)

```css
.verification-records-page {
  max-width: 1200px;
  margin: 0 auto;
}

.ganache-note {
  background: #eff6ff;
  border: 1px solid #93c5fd;
  border-radius: 6px;
  padding: 12px 16px;
  margin-top: 12px;
  font-size: 0.9rem;
}

.ganache-note ul {
  margin: 8px 0;
  padding-left: 20px;
}

.filters-section {
  display: flex;
  gap: 16px;
  align-items: flex-end;
  margin: 20px 0;
  padding: 16px;
  background: #f8fafc;
  border-radius: 8px;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.filter-group label {
  font-weight: 600;
  font-size: 0.9rem;
  color: #475569;
}

.filter-group select,
.filter-group input {
  padding: 8px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 0.9rem;
}

.records-summary {
  background: #f1f5f9;
  padding: 12px 16px;
  border-radius: 6px;
  margin-bottom: 16px;
}

.records-summary p {
  margin: 0;
  font-size: 0.95rem;
}

.loading-state {
  text-align: center;
  padding: 40px;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: #64748b;
}

.records-table {
  overflow-x: auto;
  margin: 20px 0;
}

.records-table table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.records-table th {
  background: #f1f5f9;
  padding: 12px;
  text-align: left;
  font-weight: 600;
  border-bottom: 2px solid #e2e8f0;
}

.records-table td {
  padding: 12px;
  border-bottom: 1px solid #e2e8f0;
}

.records-table tr.success-row {
  background: #f0fdf4;
}

.records-table tr.failure-row {
  background: #fef2f2;
}

.records-table tr:hover {
  background: #f8fafc;
}

.status-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 0.85rem;
}

.status-badge.success {
  background: #d1fae5;
  color: #065f46;
}

.status-badge.failure {
  background: #fee2e2;
  color: #991b1b;
}

.hash-cell {
  font-family: monospace;
  font-size: 0.85rem;
  color: #64748b;
}

.btn-expand {
  padding: 4px 12px;
  background: #e0e7ff;
  border: 1px solid #c7d2fe;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
}

.btn-expand:hover {
  background: #c7d2fe;
}

.expanded-row td {
  padding: 0 !important;
  background: #ffffff;
}

.record-details {
  padding: 24px;
  border-top: 2px solid #e2e8f0;
}

.detail-section {
  margin-bottom: 24px;
}

.detail-section h4 {
  margin: 0 0 12px 0;
  color: #1e293b;
  font-size: 1rem;
  padding-bottom: 8px;
  border-bottom: 2px solid #e2e8f0;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 16px;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-item strong {
  font-size: 0.85rem;
  color: #64748b;
}

.detail-item code {
  background: #f1f5f9;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.85rem;
  word-break: break-all;
}

.issuer-info {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.issuer-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 16px;
}

.issuer-card strong {
  display: block;
  margin-bottom: 12px;
  color: #1e293b;
}

.issuer-details p {
  margin: 8px 0 4px 0;
  font-size: 0.85rem;
  font-weight: 600;
  color: #64748b;
}

.issuer-details code {
  display: block;
  background: #ffffff;
  padding: 8px;
  border-radius: 4px;
  font-size: 0.8rem;
  word-break: break-all;
  margin-bottom: 12px;
}

.proof-data {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

.proof-component {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 12px;
}

.proof-component strong {
  display: block;
  margin-bottom: 8px;
  color: #475569;
  font-size: 0.9rem;
}

.proof-component pre {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  padding: 12px;
  border-radius: 4px;
  overflow-x: auto;
  font-size: 0.8rem;
  line-height: 1.5;
}

.audit-note {
  background: #eff6ff;
  border: 2px solid #93c5fd;
  border-radius: 8px;
  padding: 16px;
}

.audit-note h4 {
  border-bottom: none;
}

.audit-note ul {
  margin: 12px 0;
  padding-left: 24px;
}

.audit-note li {
  margin: 6px 0;
}

.privacy-note {
  margin-top: 12px;
  padding: 12px;
  background: #fef3c7;
  border-radius: 4px;
  font-size: 0.9rem;
}

@media (max-width: 768px) {
  .filters-section {
    flex-direction: column;
    align-items: stretch;
  }
  
  .issuer-info {
    grid-template-columns: 1fr;
  }
  
  .detail-grid {
    grid-template-columns: 1fr;
  }
}
```

---

### 4. Update App Navigation

**File**: `frontend/src/App.jsx`

Update to include Step 5:

```javascript
// Update step navigation
const totalSteps = 6; // 0-5

// Add import
import VerificationRecords from './components/VerificationRecords';

// Add Step 5 rendering
{currentStep === 5 && (
  <VerificationRecords
    contractAddress={contractAddress}
    walletMode={walletMode}
    onBack={() => setCurrentStep(4)}
  />
)}
```

**File**: `frontend/src/components/VerificationSummary.jsx`

Update "Next" button to go to Step 5:

```javascript
<button className="btn btn-primary" onClick={onNext}>
  View Verification Records →
</button>
```

---

### 5. Testing

#### E2E Tests

**File**: `test/e2e/full_flow.test.js`

Add new test cases:

```javascript
/**
 * Test verifyAndRecord function
 * Should emit ProofVerificationRecorded event with complete data
 */
async function testVerifyAndRecord() {
    console.log('\nTesting verifyAndRecord() function...');
    
    // Generate valid proof
    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - 25);
    
    const dobCredential = await issueDOBCredential(
        Math.floor(dob.getTime() / 1000),
        issuerAPrivateKey,
        userWallet.address
    );
    
    const citizenshipCredential = await issueCitizenshipCredential(
        'US',
        issuerBPrivateKey,
        userWallet.address
    );
    
    const proofData = await generateProof(
        dobCredential,
        citizenshipCredential,
        userWallet
    );
    
    // Warp block timestamp
    const proofTimestamp = BigInt(proofData.publicSignals[0]);
    await provider.send('evm_mine', [Number(proofTimestamp)]);
    
    // Call verifyAndRecord
    const contractWithWallet = ageVerificationContract.connect(userWallet);
    
    console.log(`  Calling verifyAndRecord()...`);
    const tx = await contractWithWallet.verifyAndRecord(
        proofData.proof.a,
        proofData.proof.b,
        proofData.proof.c,
        proofData.publicSignals.map(s => BigInt(s))
    );
    
    const receipt = await tx.wait();
    console.log(`  Transaction confirmed: ${receipt.hash}`);
    
    // Verify event was emitted
    const eventInterface = new ethers.Interface([
        'event ProofVerificationRecorded(address indexed user, bool indexed result, uint256 timestamp, uint256 currentDate, uint256 minAge, uint256 requiredCitizenship, uint256 issuerAPubkeyX, uint256 issuerAPubkeyY, uint256 issuerBPubkeyX, uint256 issuerBPubkeyY, uint256 userPubkey, uint256 subjectWallet, uint256[2] proofA, uint256[2][2] proofB, uint256[2] proofC)'
    ]);
    
    const event = receipt.logs.find(log => {
        try {
            const parsed = eventInterface.parseLog(log);
            return parsed.name === 'ProofVerificationRecorded';
        } catch {
            return false;
        }
    });
    
    assert(event, 'ProofVerificationRecorded event not found');
    
    const parsed = eventInterface.parseLog(event);
    console.log(`  Event emitted:`);
    console.log(`    User: ${parsed.args.user}`);
    console.log(`    Result: ${parsed.args.result}`);
    console.log(`    Timestamp: ${parsed.args.timestamp}`);
    console.log(`    Issuer A PubKey: (${parsed.args.issuerAPubkeyX}, ${parsed.args.issuerAPubkeyY})`);
    console.log(`    Issuer B PubKey: (${parsed.args.issuerBPubkeyX}, ${parsed.args.issuerBPubkeyY})`);
    
    // Verify event data
    assert(parsed.args.user === userWallet.address, 'Wrong user in event');
    assert(parsed.args.result === true, 'Expected verification success');
    assert(parsed.args.minAge.toString() === '18', 'Wrong minAge');
    
    console.log(`  ✓ Event data verified`);
}

/**
 * Test verifyAndRecord with failed verification
 * Should still emit event but with result = false
 */
async function testVerifyAndRecordFailure() {
    console.log('\nTesting verifyAndRecord() with failed verification...');
    
    // Generate proof with underage user (using soft circuit)
    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - 17); // Underage
    
    const dobCredential = await issueDOBCredential(
        Math.floor(dob.getTime() / 1000),
        issuerAPrivateKey,
        userWallet.address
    );
    
    const citizenshipCredential = await issueCitizenshipCredential(
        'US',
        issuerBPrivateKey,
        userWallet.address
    );
    
    const proofData = await generateProofSoft( // Use soft circuit
        dobCredential,
        citizenshipCredential,
        userWallet
    );
    
    // Warp block timestamp
    const proofTimestamp = BigInt(proofData.publicSignals[0]);
    await provider.send('evm_mine', [Number(proofTimestamp)]);
    
    // Call verifyAndRecord (should succeed but return false)
    const contractWithWallet = ageVerificationContract.connect(userWallet);
    
    console.log(`  Calling verifyAndRecord() with invalid proof...`);
    const tx = await contractWithWallet.verifyAndRecord(
        proofData.proof.a,
        proofData.proof.b,
        proofData.proof.c,
        proofData.publicSignals.map(s => BigInt(s))
    );
    
    const receipt = await tx.wait();
    console.log(`  Transaction confirmed (even though verification failed)`);
    
    // Verify event was emitted with result = false
    const eventInterface = new ethers.Interface([
        'event ProofVerificationRecorded(address indexed user, bool indexed result, uint256 timestamp, uint256 currentDate, uint256 minAge, uint256 requiredCitizenship, uint256 issuerAPubkeyX, uint256 issuerAPubkeyY, uint256 issuerBPubkeyX, uint256 issuerBPubkeyY, uint256 userPubkey, uint256 subjectWallet, uint256[2] proofA, uint256[2][2] proofB, uint256[2] proofC)'
    ]);
    
    const event = receipt.logs.find(log => {
        try {
            const parsed = eventInterface.parseLog(log);
            return parsed.name === 'ProofVerificationRecorded';
        } catch {
            return false;
        }
    });
    
    assert(event, 'ProofVerificationRecorded event not found');
    
    const parsed = eventInterface.parseLog(event);
    console.log(`  Event emitted with result: ${parsed.args.result}`);
    
    // Verify result is false
    assert(parsed.args.result === false, 'Expected verification failure');
    
    console.log(`  ✓ Failed verification recorded correctly`);
}

// Add to runAllTests()
await runTest('Recorded Verification - Success', testVerifyAndRecord);
if (softCircuitExists) {
    await runTest('Recorded Verification - Failure', testVerifyAndRecordFailure);
}
```

#### Foundry Tests

**File**: `test/AgeVerification.t.sol`

Add Solidity tests:

```solidity
// Add to existing test contract
event ProofVerificationRecorded(
    address indexed user,
    bool indexed result,
    uint256 timestamp,
    uint256 currentDate,
    uint256 minAge,
    uint256 requiredCitizenship,
    uint256 issuerAPubkeyX,
    uint256 issuerAPubkeyY,
    uint256 issuerBPubkeyX,
    uint256 issuerBPubkeyY,
    uint256 userPubkey,
    uint256 subjectWallet,
    uint256[2] proofA,
    uint256[2][2] proofB,
    uint256[2] proofC
);

function test_VerifyAndRecord_Success() public {
    // Setup valid proof (reuse existing test data)
    
    // Expect event emission
    vm.expectEmit(true, true, false, true);
    emit ProofVerificationRecorded(
        testUser,
        true, // success
        block.timestamp,
        input[0], input[1], input[2], input[3], input[4],
        input[5], input[6], input[7], input[8],
        a, b, c
    );
    
    // Call verifyAndRecord
    vm.prank(testUser);
    bool result = ageVerification.verifyAndRecord(a, b, c, input);
    
    assertTrue(result, "Verification should succeed");
}

function test_VerifyAndRecord_Failure() public {
    // Setup invalid proof (wrong issuer, underage, etc.)
    
    // Expect event emission with result = false
    vm.expectEmit(true, true, false, true);
    emit ProofVerificationRecorded(
        testUser,
        false, // failure
        block.timestamp,
        input[0], input[1], input[2], input[3], input[4],
        input[5], input[6], input[7], input[8],
        a, b, c
    );
    
    // Call verifyAndRecord
    vm.prank(testUser);
    bool result = ageVerification.verifyAndRecord(a, b, c, input);
    
    assertFalse(result, "Verification should fail");
}

function test_VerifyAndRecord_GasCost() public {
    // Measure gas cost
    uint256 gasBefore = gasleft();
    
    vm.prank(testUser);
    ageVerification.verifyAndRecord(a, b, c, input);
    
    uint256 gasUsed = gasBefore - gasleft();
    
    console.log("Gas used for verifyAndRecord:", gasUsed);
    // Should be around 350,000 - 400,000 gas
    assertLt(gasUsed, 500000, "Gas usage too high");
}
```

---

## Use Cases

### 1. **Compliance & Auditing**

```javascript
// Regulatory audit: Find all verifications by a specific user
const userRecords = allRecords.filter(r => r.user === targetAddress);

// Generate audit report
const report = {
  totalVerifications: userRecords.length,
  successfulVerifications: userRecords.filter(r => r.result).length,
  failedVerifications: userRecords.filter(r => !r.result).length,
  issuersUsed: [...new Set([
    ...userRecords.map(r => r.issuerHashes.issuerA),
    ...userRecords.map(r => r.issuerHashes.issuerB)
  ])]
};
```

### 2. **Issuer Accountability**

```javascript
// Find all verifications using a specific issuer
const issuerARecords = allRecords.filter(
  r => r.issuerHashes.issuerA === targetIssuerHash
);

// Check issuer success rate
const successRate = issuerARecords.filter(r => r.result).length / issuerARecords.length;
```

### 3. **Dispute Resolution**

```javascript
// User claims their verification should have passed
// Administrator can:
// 1. Look up the exact proof submitted
// 2. Verify it independently using stored proof components
// 3. Check which issuers signed the credentials
// 4. Contact issuers to verify credential authenticity
```

---

## Gas Cost Analysis

### verifyProof() (View)
- **Cost**: 0 gas (free)
- **Records**: Nothing on-chain
- **Use case**: Testing, quick checks, non-critical verifications

### verifyAndRecord() (Transaction)
- **Cost**: ~350,000 - 400,000 gas
  - Groth16 verification: ~280,000 gas
  - Event emission: ~50,000 gas
  - Other operations: ~20,000-70,000 gas
- **Records**: Full audit trail on-chain
- **Use case**: Production verifications, compliance, high-value operations

### Cost Comparison by Network

| Network | Gas Cost (ETH) | USD Cost (ETH=$2000) |
|---------|---------------|----------------------|
| Ethereum Mainnet (30 gwei) | 0.0105 ETH | ~$21 |
| Ethereum Mainnet (100 gwei) | 0.035 ETH | ~$70 |
| Optimism (L2) | 0.000105 ETH | ~$0.21 |
| Arbitrum (L2) | 0.000035 ETH | ~$0.07 |
| Polygon PoS | 0.00007 MATIC | ~$0.005 |
| Base (L2) | 0.0003 ETH | ~$0.60 |

**Recommendation**: Deploy on L2 (Optimism, Arbitrum, Base) or Polygon for cost-effective recording.

---

## Privacy Considerations

### What Gets Recorded ✅

- Wallet addresses (already public)
- Issuer public key hashes (already public)
- Public signals (age requirement, citizenship requirement, etc.)
- Proof components (π_A, π_B, π_C) - mathematically reveal nothing
- Verification result (YES/NO)
- Timestamps (already public)

### What Remains Private ❌

- Actual date of birth (never leaves user's device)
- Actual citizenship (never leaves user's device)
- Credential signatures (used locally for proof generation)
- Any other personal information

**Zero-Knowledge Guarantee**: The recorded proof components (π_A, π_B, π_C) are cryptographically proven to reveal zero bits of information about private inputs beyond what's implied by the verification result.

---

## Implementation Checklist

### Phase 1: Smart Contract
- [ ] Add `ProofVerificationRecorded` event to `AgeVerification.sol`
- [ ] Implement `verifyAndRecord()` function
- [ ] Add Foundry tests for new function
- [ ] Redeploy contract to Ganache
- [ ] Update contract address in frontend config

### Phase 2: Frontend Step 3
- [ ] Add `recordOnChain` state variable
- [ ] Create verification mode selector UI
- [ ] Add CSS styles for selector and record badge
- [ ] Update `handleSubmitProof()` to support both modes
- [ ] Update success/error messages to indicate recording status
- [ ] Test both verification modes

### Phase 3: Frontend Step 5
- [ ] Create `VerificationRecords.jsx` component
- [ ] Create `VerificationRecords.css` styles
- [ ] Implement event fetching logic
- [ ] Build records table with expandable details
- [ ] Add filtering capabilities
- [ ] Test with multiple recorded verifications

### Phase 4: Navigation
- [ ] Update `App.jsx` to include Step 5
- [ ] Update step counter (0-5 instead of 0-4)
- [ ] Update `VerificationSummary.jsx` next button
- [ ] Add back navigation from Step 5 to Step 4

### Phase 5: Testing
- [ ] Add E2E test for successful `verifyAndRecord()`
- [ ] Add E2E test for failed `verifyAndRecord()`
- [ ] Add Foundry test for event emission
- [ ] Add Foundry gas cost test
- [ ] Test event querying in Step 5
- [ ] Test filters and expandable rows

### Phase 6: Documentation
- [ ] Update `README.md` features list
- [ ] Add section in `ARCHITECTURE.md`
- [ ] Update `TUTORIAL.md` with Step 5 instructions
- [ ] Add gas cost analysis to docs
- [ ] Document production deployment considerations

---

## Future Enhancements

### 1. **Indexed Event Querying (Production)**

For mainnet/testnet deployment, integrate with indexing services:

```javascript
// Example: The Graph integration
import { gql, useQuery } from '@apollo/client';

const GET_VERIFICATION_RECORDS = gql`
  query GetVerifications($user: Bytes) {
    proofVerificationRecordeds(
      where: { user: $user }
      orderBy: timestamp
      orderDirection: desc
    ) {
      id
      user
      result
      timestamp
      issuerAPubkeyX
      issuerAPubkeyY
      issuerBPubkeyX
      issuerBPubkeyY
      transactionHash
    }
  }
`;
```

### 2. **Issuer Reputation System**

Track issuer statistics:

```javascript
// Calculate issuer reputation
const issuerStats = {
  totalVerifications: records.filter(r => r.issuerHashes.issuerA === issuerHash).length,
  successRate: ...,
  averageResponseTime: ...,
  userRatings: ...
};
```

### 3. **Export Audit Reports**

Add export functionality:

```javascript
const exportAuditReport = (records) => {
  const csv = convertToCSV(records);
  downloadFile(csv, 'verification-audit.csv');
};
```

### 4. **Real-Time Notifications**

Listen for verification events:

```javascript
contract.on("ProofVerificationRecorded", (user, result, timestamp) => {
  if (result) {
    showNotification(`New verification: ${user}`);
  }
});
```

---

## Security Notes

1. **Event Data Integrity**: Events are part of transaction receipts and cannot be modified after mining
2. **Issuer Tracking**: Enables accountability - if fraudulent credentials are used, the issuer can be identified
3. **Proof Reproducibility**: Full proof data allows independent verification by auditors
4. **Privacy Preservation**: Zero-knowledge property ensures no private data leakage despite full audit trail
5. **Gas Attack Mitigation**: Users can choose free verification mode if cost is a concern

---

## Questions & Answers

**Q: Why record failed verifications?**  
A: Security auditing. Failed attempts may indicate attack patterns or system issues.

**Q: Can the proof data be used to extract private information?**  
A: No. Groth16 proofs are mathematically proven to be zero-knowledge.

**Q: What if an issuer's key is compromised?**  
A: The audit trail allows you to identify all verifications using that issuer and take appropriate action.

**Q: How do I verify a historical proof?**  
A: Use the stored proof components (π_A, π_B, π_C) and public signals with the Groth16 verifier.

**Q: Can I delete records?**  
A: No. Blockchain data is immutable. Design your system accordingly.

---

## References

- **Groth16 Paper**: https://eprint.iacr.org/2016/260.pdf
- **Ethereum Events**: https://docs.soliditylang.org/en/latest/contracts.html#events
- **The Graph**: https://thegraph.com/docs/
- **Gas Optimization**: https://book.getfoundry.sh/forge/gas-tracking

---

**Last Updated**: 2026-01-16  
**Status**: Ready for implementation  
**Implementation Time**: 6-8 hours  
**Review Required**: Smart contract security audit after implementation
