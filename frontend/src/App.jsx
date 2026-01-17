import React, { useState } from 'react';
import Prerequisites from './components/Prerequisites';
import RequestCredential from './components/RequestCredential';
import GenerateProof from './components/GenerateProof';
import SubmitProof from './components/SubmitProof';
import VerificationSummary from './components/VerificationSummary';
import './App.css';

function App() {
  const [step, setStep] = useState(0);
  const [credentials, setCredentials] = useState({
    dob: null,
    citizenship: null
  });
  const [proof, setProof] = useState(null);
  const [verificationStatus, setVerificationStatus] = useState(null);
  const [walletAddress, setWalletAddress] = useState(null);
  const [walletMode, setWalletMode] = useState(null);
  const [demoMode, setDemoMode] = useState(true);
  const [issuerPrivateKeys, setIssuerPrivateKeys] = useState({
    a: '0x6cbed15c793ce57650b9877cf6fa156fbef513c4e6134f022a85b1ffdd59b2a1',
    b: '0x6370fd033278c143179d81c5526140625662b8daa446c22ee2d73db3707e620c'
  });
  const [contractAddress, setContractAddress] = useState('0x5b1869D9A4C187F2EAa108f3062412ecf0526b24');
  const [deployerPrivateKey, setDeployerPrivateKey] = useState(
    '0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d'
  );

  const handleReset = () => {
    setStep(0);
    setCredentials({ dob: null, citizenship: null });
    setProof(null);
    setVerificationStatus(null);
    setWalletAddress(null);
    setWalletMode(null);
    setDemoMode(true);
    setIssuerPrivateKeys({
      a: '0x6cbed15c793ce57650b9877cf6fa156fbef513c4e6134f022a85b1ffdd59b2a1',
      b: '0x6370fd033278c143179d81c5526140625662b8daa446c22ee2d73db3707e620c'
    });
    setContractAddress('0x5b1869D9A4C187F2EAa108f3062412ecf0526b24');
    setDeployerPrivateKey(
      '0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d'
    );
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>🔐 Zero-Knowledge Identity Verification</h1>
        <p>Prove your age and citizenship without revealing personal information</p>
      </header>

      <div className="progress-bar">
        <div className={`step ${step >= 0 ? 'active' : ''}`}>
          <div className="step-number">0</div>
          <div className="step-label">Prerequisites</div>
        </div>
        <div className={`step ${step >= 1 ? 'active' : ''}`}>
          <div className="step-number">1</div>
          <div className="step-label">Request Credentials</div>
        </div>
        <div className={`step ${step >= 2 ? 'active' : ''}`}>
          <div className="step-number">2</div>
          <div className="step-label">Generate Proof</div>
        </div>
        <div className={`step ${step >= 3 ? 'active' : ''}`}>
          <div className="step-number">3</div>
          <div className="step-label">Submit Proof</div>
        </div>
        <div className={`step ${step >= 4 ? 'active' : ''}`}>
          <div className="step-number">4</div>
          <div className="step-label">Summary</div>
        </div>
      </div>

      <main className="App-main">
        {step === 0 && (
          <Prerequisites
            issuerPrivateKeys={issuerPrivateKeys}
            setIssuerPrivateKeys={setIssuerPrivateKeys}
            contractAddress={contractAddress}
            setContractAddress={setContractAddress}
            deployerPrivateKey={deployerPrivateKey}
            setDeployerPrivateKey={setDeployerPrivateKey}
            demoMode={demoMode}
            setDemoMode={setDemoMode}
            onNext={() => setStep(1)}
          />
        )}

        {step === 1 && (
          <RequestCredential
            credentials={credentials}
            setCredentials={setCredentials}
            walletAddress={walletAddress}
            setWalletAddress={setWalletAddress}
            walletMode={walletMode}
            setWalletMode={setWalletMode}
            issuerPrivateKeys={issuerPrivateKeys}
            demoMode={demoMode}
            onNext={() => setStep(2)}
          />
        )}

        {step === 2 && (
          <GenerateProof
            credentials={credentials}
            proof={proof}
            setProof={setProof}
            walletAddress={walletAddress}
            demoMode={demoMode}
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
          />
        )}

        {step === 3 && (
          <SubmitProof
            proof={proof}
            verificationStatus={verificationStatus}
            setVerificationStatus={setVerificationStatus}
            walletAddress={walletAddress}
            walletMode={walletMode}
            contractAddress={contractAddress}
            setContractAddress={setContractAddress}
            demoMode={demoMode}
            onBack={() => setStep(2)}
            onNext={() => setStep(4)}
          />
        )}

        {step === 4 && (
          <VerificationSummary
            verificationStatus={verificationStatus}
            walletAddress={walletAddress}
            proof={proof}
            credentials={credentials}
            onBack={() => setStep(3)}
          />
        )}
      </main>

      <footer className="App-footer">
        <p>Educational Demo - Zero-Knowledge Proof System</p>
        <div className="button-group">
          <button className="btn btn-secondary" onClick={handleReset}>
            Restart Demo
          </button>
        </div>
      </footer>
    </div>
  );
}

export default App;
