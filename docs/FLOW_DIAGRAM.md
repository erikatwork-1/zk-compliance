# System Flow Diagram

This document contains visual flow diagrams of the zero-knowledge identity verification system.

## Complete System Flow

```mermaid
flowchart TD
    Start([User Starts Verification Process])
    
    subgraph Issuers["🏛️ Identity Issuers"]
        IssuerA[Issuer A: DMV<br/>Issues DOB Credential]
        IssuerB[Issuer B: Immigration<br/>Issues Citizenship Credential]
    end
    
    subgraph UserProcess["👤 User Process"]
        ConnectWallet[Connect Wallet<br/>MetaMask]
        RequestCreds[User Requests Credentials<br/>with DOB/Citizenship Input]
        ReceiveDOB[Receive DOB Credential<br/>Signed by Issuer A<br/>Bound to Wallet]
        ReceiveCit[Receive Citizenship Credential<br/>Signed by Issuer B<br/>Bound to Wallet]
        GenerateProof[Generate Zero-Knowledge Proof<br/>Using Circom Circuit<br/>with Wallet Binding]
    end
    
    subgraph Circuit["🔐 Zero-Knowledge Circuit"]
        VerifySigA[Verify Issuer A<br/>ECDSA Signature]
        VerifySigB[Verify Issuer B<br/>ECDSA Signature]
        CheckAge[Check Age >= 18]
        CheckCit[Check Citizenship == US]
        VerifyUser[Verify Same User<br/>Public Key]
        VerifyWallet[Verify Wallet Binding<br/>user_pubkey == subject_wallet]
        CreateProof[Create Groth16 Proof<br/>with 9 Public Signals]
    end
    
    subgraph OnChain["⛓️ On-Chain Verification"]
        SubmitProof[Submit Proof to<br/>Smart Contract]
        VerifyWallet[Verify Wallet Match<br/>msg.sender == subject_wallet]
        VerifyProof[Verifier Contract<br/>Verifies zk-Proof]
        CheckIssuers[Check Issuer Keys<br/>in Registry]
        UpdateStatus[Update Verification<br/>Status]
        Success[✅ User Verified]
    end
    
    Start --> ConnectWallet
    ConnectWallet --> RequestCreds
    RequestCreds --> IssuerA
    RequestCreds --> IssuerB
    IssuerA --> ReceiveDOB
    IssuerB --> ReceiveCit
    ReceiveDOB --> GenerateProof
    ReceiveCit --> GenerateProof
    
    GenerateProof --> VerifySigA
    GenerateProof --> VerifySigB
    VerifySigA --> CheckAge
    VerifySigB --> CheckCit
    CheckAge --> VerifyUser
    CheckCit --> VerifyUser
    VerifyUser --> VerifyWallet
    VerifyWallet --> CreateProof
    
    CreateProof --> SubmitProof
    SubmitProof --> VerifyWallet
    VerifyWallet --> VerifyProof
    VerifyProof --> CheckIssuers
    CheckIssuers --> UpdateStatus
    UpdateStatus --> Success
    
    style Start fill:#e1f5ff
    style Success fill:#d1fae5
    style IssuerA fill:#fef3c7
    style IssuerB fill:#fef3c7
    style Circuit fill:#ddd6fe
    style OnChain fill:#dbeafe
```

## Detailed Proof Generation Flow

```mermaid
sequenceDiagram
    participant User
    participant IssuerA as Issuer A (DMV)
    participant IssuerB as Issuer B (Immigration)
    participant Circuit as ZK Circuit
    participant Contract as Smart Contract
    
    User->>IssuerA: Request DOB Credential
    IssuerA->>IssuerA: Verify User Identity
    IssuerA->>IssuerA: Create Credential<br/>(DOB, UserPubkey, Nonce)
    IssuerA->>IssuerA: Sign with ECDSA
    IssuerA->>User: Return Signed DOB Credential
    
    User->>IssuerB: Request Citizenship Credential
    IssuerB->>IssuerB: Verify User Identity
    IssuerB->>IssuerB: Create Credential<br/>(Citizenship, UserPubkey, Nonce)
    IssuerB->>IssuerB: Sign with ECDSA
    IssuerB->>User: Return Signed Citizenship Credential
    
    User->>Circuit: Load Credentials
    User->>Circuit: Calculate Age from DOB
    User->>Circuit: Prepare Circuit Inputs<br/>(including wallet address)
    
    Circuit->>Circuit: Verify Issuer A Signature
    Circuit->>Circuit: Verify Issuer B Signature
    Circuit->>Circuit: Check Age >= 18
    Circuit->>Circuit: Check Citizenship == US
    Circuit->>Circuit: Verify Same User Pubkey
    Circuit->>Circuit: Verify Wallet Binding<br/>user_pubkey == subject_wallet
    
    Circuit->>Circuit: Generate Witness
    Circuit->>Circuit: Create Groth16 Proof
    Circuit->>User: Return Proof + Public Signals
    
    User->>Contract: Submit Proof & Public Signals<br/>(9 values including subject_wallet)
    Contract->>Contract: Verify Wallet Match<br/>msg.sender == subject_wallet
    Contract->>Contract: Verify Proof (Groth16)
    Contract->>Contract: Check Issuer A in Registry
    Contract->>Contract: Check Issuer B in Registry
    Contract->>Contract: Validate Public Inputs
    Contract->>Contract: Return boolean result
    Contract->>User: Verification result (yes/no)
```

## Data Flow Diagram

```mermaid
flowchart LR
    subgraph Inputs["📥 Inputs"]
        DOB[Date of Birth<br/>Private]
        Cit[Citizenship<br/>Private]
        SigA[Issuer A Signature<br/>Private]
        SigB[Issuer B Signature<br/>Private]
        PubKeys[Issuer Public Keys<br/>Public]
        CurrentDate[Current Date<br/>Public]
        WalletAddr[Wallet Address<br/>Public<br/>subject_wallet]
    end
    
    subgraph Processing["⚙️ Processing"]
        HashA[Hash DOB Credential]
        HashB[Hash Citizenship Credential]
        VerifyA[Verify Signature A]
        VerifyB[Verify Signature B]
        CalcAge[Calculate Age]
        CheckAge[Age >= 18?]
        CheckCit[Citizenship == US?]
    end
    
    subgraph Outputs["📤 Outputs"]
        Proof[Groth16 Proof<br/>a, b, c]
        PublicSignals[Public Signals<br/>9 values<br/>includes subject_wallet]
    end
    
    DOB --> HashA
    Cit --> HashB
    HashA --> VerifyA
    HashB --> VerifyB
    SigA --> VerifyA
    SigB --> VerifyB
    PubKeys --> VerifyA
    PubKeys --> VerifyB
    
    DOB --> CalcAge
    CurrentDate --> CalcAge
    CalcAge --> CheckAge
    
    VerifyA --> Proof
    VerifyB --> Proof
    CheckAge --> Proof
    CheckCit --> Proof
    
    Proof --> PublicSignals
    PubKeys --> PublicSignals
    CurrentDate --> PublicSignals
    WalletAddr --> PublicSignals
```

## Component Interaction Diagram

```mermaid
graph TB
    subgraph External["🌐 External Systems"]
        DMV[DMV System]
        Immigration[Immigration System]
        Blockchain[Ethereum Blockchain]
    end
    
    subgraph IssuerLayer["🏛️ Issuer Layer"]
        IssuerAService[Issuer A Service<br/>Credential Issuance]
        IssuerBService[Issuer B Service<br/>Credential Issuance]
        IssuerAKey[Issuer A<br/>Private Key]
        IssuerBKey[Issuer B<br/>Private Key]
    end
    
    subgraph UserLayer["👤 User Layer"]
        UserApp[User Application<br/>Frontend/Backend]
        CredentialStore[Credential Storage<br/>Local/Secure]
        ProofGenerator[Proof Generator<br/>snarkjs]
    end
    
    subgraph CircuitLayer["🔐 Circuit Layer"]
        CircomCircuit[Circom Circuit<br/>age_citizenship.circom]
        WitnessCalc[Witness Calculator<br/>WASM]
        ProvingKey[Proving Key<br/>from Trusted Setup]
    end
    
    subgraph ContractLayer["⛓️ Contract Layer"]
        VerifierContract[Verifier Contract<br/>Groth16 Verifier]
        AgeVerification[AgeVerification Contract<br/>Business Logic]
        IssuerRegistry[Issuer Registry<br/>Trusted Keys]
    end
    
    DMV --> IssuerAService
    Immigration --> IssuerBService
    IssuerAService --> IssuerAKey
    IssuerBService --> IssuerBKey
    IssuerAService --> UserApp
    IssuerBService --> UserApp
    
    UserApp --> CredentialStore
    CredentialStore --> ProofGenerator
    ProofGenerator --> CircomCircuit
    CircomCircuit --> WitnessCalc
    WitnessCalc --> ProvingKey
    ProvingKey --> ProofGenerator
    
    ProofGenerator --> UserApp
    UserApp --> VerifierContract
    VerifierContract --> AgeVerification
    AgeVerification --> IssuerRegistry
    AgeVerification --> Blockchain
    
    style External fill:#fef3c7
    style IssuerLayer fill:#ddd6fe
    style UserLayer fill:#dbeafe
    style CircuitLayer fill:#d1fae5
    style ContractLayer fill:#fee2e2
```

## Security Flow

```mermaid
flowchart TD
    Start([User Has Credentials])
    
    subgraph Privacy["🔒 Privacy Protection"]
        HideDOB[DOB Hidden in Proof]
        HideCit[Citizenship Hidden in Proof]
        RevealOnly[Only Reveal Eligibility]
    end
    
    subgraph Verification["✓ Verification"]
        VerifySig[Signature Verification]
        VerifyAge[Age Check]
        VerifyCit[Citizenship Check]
        VerifyUser[User Binding Check]
    end
    
    subgraph Trust["🛡️ Trust Model"]
        TrustIssuers[Trust Issuer Keys]
        TrustSetup[Trust Setup Ceremony]
        TrustContract[Trust Smart Contract]
    end
    
    Start --> HideDOB
    Start --> HideCit
    HideDOB --> VerifySig
    HideCit --> VerifySig
    VerifySig --> VerifyAge
    VerifySig --> VerifyCit
    VerifyAge --> VerifyUser
    VerifyCit --> VerifyUser
    VerifyUser --> RevealOnly
    
    VerifySig --> TrustIssuers
    RevealOnly --> TrustSetup
    RevealOnly --> TrustContract
    
    RevealOnly --> Success([✅ Verified Without<br/>Revealing Data])
    
    style Privacy fill:#dbeafe
    style Verification fill:#d1fae5
    style Trust fill:#fef3c7
    style Success fill:#d1fae5
```
