# Soil Platform Specifications

## 1. Overview
The Soil platform is a comprehensive software solution designed to facilitate a decentralized marketplace for ideas and products. It aims to provide a scalable, user-friendly, and secure environment for creators, entrepreneurs, and buyers using the Cardano testnet for transactions.

## 2. Key Features
- **User Management**: Secure user creation and authentication using Cloudflare Workers for serverless user management and session handling.
- **Idea Submissions**: Users can submit ideas, stored in Cloudflare R2, with metadata including title, description, and submitter details.
- **Product Creation**: Users can create products based on submitted ideas, with details like product name, description, and price stored in R2.
- **Manual Product Association**: Admins or authorized users can manually associate ideas with products, linking records in R2 storage.
- **Sales on Cardano Testnet**: Facilitates buying and selling of products using Cardano testnet for cryptocurrency transactions, integrated via Cardano wallet APIs.
- **User Interface**: Responsive and intuitive single-page application (SPA) built with Solid.js for a seamless and performant user experience.
- **Security**: Implements encryption for sensitive data, role-based access control, and secure API endpoints hosted on Cloudflare.

## 3. System Architecture
- **Frontend**: Built using Solid.js for a responsive SPA, served via Cloudflare Pages for fast global delivery.
- **Backend**: Powered by Cloudflare Workers for serverless API logic, handling user management, idea/product operations, and Cardano testnet integration.
- **Database**: Utilizes Cloudflare R2 for object storage to store user data, idea submissions, product details, and associations in JSON format.
- **Infrastructure**: Deployed on Cloudflare's edge network for scalability, low latency, and reliability.
- **APIs**: RESTful APIs built with Cloudflare Workers for communication between the frontend, R2 storage, and Cardano testnet wallet services.

## 4. Technical Requirements
- **Programming Languages**: JavaScript (for frontend and Cloudflare Workers).
- **Frameworks**: Solid.js for the SPA frontend.
- **Dependencies**: Cardano wallet libraries (e.g., cardano-serialization-lib for testnet integration), axios for API calls, and Cloudflare SDKs.
- **Hardware**: Serverless architecture on Cloudflare, no specific hardware requirements.
- **Operating Systems**: Compatible with any modern browser (Chrome, Firefox, Safari) for the SPA.

## 5. Non-Functional Requirements
- **Performance**: Response time under 200ms for 95% of API requests, leveraging Cloudflare's edge caching.
- **Availability**: 99.9% uptime, ensured by Cloudflare's global infrastructure.
- **Security**: Compliance with OWASP top 10, with encrypted storage in R2 and secure Cardano testnet transactions.
- **Scalability**: Ability to handle 10x user growth, supported by Cloudflare's serverless scaling and R2's flexible storage.

## 6. Development and Deployment
- **Version Control**: Managed using Git with repositories hosted on GitHub.
- **CI/CD**: Continuous integration and deployment using Cloudflare Pages' built-in CI/CD for frontend and Workers for backend.
- **Testing**: Unit and integration testing with Jest for Solid.js components and Worker scripts; manual testing for Cardano testnet transactions.
- **Deployment**: Frontend hosted on Cloudflare Pages, backend APIs on Cloudflare Workers, and data stored in Cloudflare R2.

## 7. Cardano Implementation Specifications
- **Identity NFTs for Verified Users**:
  - **Purpose**: Identity NFTs serve as proof of verified user status, enabling access to platform features like bit token minting.
  - **Minting Policy**: Uses a single-signature policy with a time-lock (e.g., 10,000 slots) to prevent further minting after verification phase. Only platform admins can mint identity NFTs using a policy script (generated via `cardano-cli` or equivalent).
  - **Metadata**: Includes user ID, verification timestamp, and IPFS link to user profile data (stored in R2). Follows CIP-25 for metadata structure (e.g., `{ "721": { "<policyID>": { "<assetName>": { "name": "SoilIdentityNFT", "image": "ipfs://<hash>", "userID": "<uniqueID>" } } } }`).
  - **Implementation**: Verified users receive a unique NFT post-verification, minted via a Cardano transaction integrated through `cardano-wallet` APIs. NFTs are non-transferable (locked to user wallet) to ensure authenticity.
- **Native Bit Token**:
  - **Purpose**: A fungible token mintable by holders of identity NFTs, used to claim asset shares. Bit tokens can be transferred anonymously to unverified accounts (without identity NFTs) via an intermediary wallet to prevent association between verified minting addresses and anonymous receiving addresses.
  - **Minting Policy**: Multi-signature policy requiring the user’s identity NFT as a condition for minting. Minting is restricted to one bit token per epoch (5 days on testnet) per verified user to control supply. Transfers to unverified accounts are allowed without identity NFT checks, routed through a platform-controlled intermediary wallet.
  - **Metadata**: Includes token name ("SoilBitToken"), epoch number, and minting timestamp for minted tokens. Stored in transaction metadata per CIP-25. Transfers to unverified accounts include no metadata to ensure pseudonymity.
  - **Implementation**: Cloudflare Workers handle minting requests, verifying the user’s identity NFT via `cardano-cli query utxo` or `cardano-wallet` APIs for verified users. Minting transactions are constructed with `cardano-serialization-lib`, ensuring the policy script checks the epoch and NFT ownership. For transfers to unverified accounts, Cloudflare Workers generate a unique temporary Cardano wallet address for each unverified user per transfer, send bit tokens from the verified user to a platform-controlled intermediary wallet, and then forward the tokens to the temporary address. A rate limit (e.g., max 10 bit tokens per transaction to unverified accounts) is enforced to prevent abuse. The intermediary wallet is funded with tADA to cover transaction fees (minimum 1 tADA per transfer). Transaction batching is used where possible to obscure sender-receiver links.
- **Asset NFT Class**:
  - **Purpose**: Represents shares of unique products or assets, where shares are minted based on the amount of bit tokens burned, allowing multiple users to hold proportional ownership.
  - **Minting Policy**: Single-signature policy with a time-lock (e.g., 10,000 slots) for controlled issuance. Only platform admins can mint asset shares.
  - **Burning Mechanism**: Users burn a variable number of bit tokens to mint proportional asset shares (e.g., 1 bit token burned = 1 asset share). Burning and minting occur in a single transaction to maintain atomicity, using `cardano-wallet` or `cardano-cli` for transaction construction.
  - **Metadata**: Includes asset name, description, total shares issued, and IPFS link to product media (stored in R2). Follows CIP-25 (e.g., `{ "721": { "<policyID>": { "<assetName>": { "name": "SoilAssetShare", "image": "ipfs://<hash>", "description": "<product details>", "shares": "<number>" } } } }`).
  - **Implementation**: Cloudflare Workers process burn requests, verify bit token ownership, and construct a transaction to burn bit tokens and mint proportional asset shares. Transactions require at least 1.7 tADA for fees and asset share transfer.

## 8. Required Files and Cardano Components
- **Frontend File (`index.html`)**:
  - **Purpose**: Hosts the Solid.js single-page application (SPA) served via Cloudflare Pages, providing a responsive UI for user authentication, idea submission, product creation, manual product association, and Cardano testnet transactions.
  - **Content**:
    - Solid.js components for login/signup, idea submission form, product creation form, admin panel for product association, and Cardano wallet integration (e.g., connect to Nami/Eternl wallets).
    - Features: Displays user balances (bit tokens, asset shares), allows bit token transfers to verified/unverified accounts, and supports burning bit tokens to claim asset shares.
    - Styling: Uses Tailwind CSS (via CDN) for responsive design.
    - Cardano Integration: Uses `cardano-serialization-lib` and `cardano-wallet-js` to interact with Cardano wallets, sign transactions, and query balances.
    - API Calls: Uses `axios` to communicate with Cloudflare Workers APIs for user management, idea/product storage, and transaction processing.
  - **Dependencies**:
    - Solid.js (via CDN: `https://unpkg.com/solid-js@1.8.7/dist/solid.js`).
    - Tailwind CSS (via CDN: `https://cdn.tailwindcss.com`).
    - `axios` (via CDN: `https://unpkg.com/axios@1.6.8/dist/axios.min.js`).
    - `@emurgo/cardano-serialization-lib-browser` (via CDN or npm for browser compatibility).
    - `cardano-wallet-js` (via npm or custom integration for wallet connections).
- **Backend File (`worker.js`)**:
  - **Purpose**: Implements serverless API logic on Cloudflare Workers, handling user authentication, idea/product storage in R2, and Cardano testnet transactions (minting identity NFTs, bit tokens, asset shares, and anonymous transfers).
  - **Content**:
    - API Endpoints: `/auth` for user signup/login, `/ideas` for submitting/retrieving ideas, `/products` for creating/retrieving products, `/associate` for manual product association (admin-only), and `/transactions` for Cardano operations (minting, transferring, burning).
    - Cardano Integration: Uses `cardano-serialization-lib` to construct transactions for minting identity NFTs (admin-only), bit tokens (verified users), and asset shares (via burning). Handles anonymous transfers via an intermediary wallet with rate limiting (max 10 bit tokens per transaction).
    - Storage: Uses Cloudflare R2 to store user data, ideas, products, and associations in JSON format. Policy keys and intermediary wallet keys are stored in Cloudflare Workers KV.
    - Security: Encrypts sensitive R2 data and enforces rate limiting with transaction batching for anonymous transfers.
  - **Dependencies**:
    - `cardano-serialization-lib` (for transaction construction).
    - Cloudflare Workers KV and R2 SDKs (for storage and key management).
    - `axios` (for querying Cardano node APIs, e.g., Blockfrost).
- **Cardano Components**:
  - **Libraries**:
    - `cardano-serialization-lib`: For constructing and signing transactions in both frontend and backend.
    - `@emurgo/cardano-serialization-lib-browser`: Browser-compatible version for frontend wallet interactions.
    - `cardano-wallet-js`: For frontend integration with Cardano wallets (e.g., Nami, Eternl) to sign transactions and query balances.
  - **Tools**:
    - `cardano-cli`: Used during development to generate policy scripts and keys for identity NFTs, bit tokens, and asset shares.
    - Cardano testnet node access: Via Blockfrost API (or similar provider) for querying UTXOs and submitting transactions.
  - **Configurations**:
    - Policy scripts: Single-signature with time-lock for identity NFTs and asset shares; multi-signature with identity NFT check for bit tokens. Generated via `cardano-cli`.
    - Intermediary wallet: Keys stored in Cloudflare Workers KV, funded with tADA for transaction fees.
    - Cardano testnet parameters: Testnet magic number for network configuration.
    - Blockfrost API key: Stored in Cloudflare Workers environment variables for secure node queries.
    - CIP-25 metadata: For identity NFTs, bit tokens, and asset shares, with IPFS links stored in R2.
  - **Dependencies**:
    - CIP-25 metadata standard for NFT and token metadata.
    - IPFS integration for media storage, linked to R2 objects.
    - Minimum 1 tADA for bit token transfers and 1.7 tADA for asset share minting transactions.

## 9. Future Enhancements
- Support for mainnet Cardano integration for production use.
- Enhanced analytics for idea and product popularity using Cloudflare Workers KV.
- Mobile app support for iOS and Android with Solid.js or a compatible framework.
- Community-driven features like voting or commenting on ideas.

- **Implementation Details**:
  - Identity NFTs, bit tokens, and asset shares are minted using native Cardano policies without Plutus smart contracts, leveraging Cardano’s native token model for efficiency.
  - Metadata for all NFTs and tokens is stored in transaction metadata per CIP-25, with IPFS links for media stored in Cloudflare R2.
  - All transactions are processed via Cardano testnet, using `cardano-wallet` or `cardano-cli` for transaction construction and signing, integrated with Cloudflare Workers for API-driven automation.
  - Security measures include policy key management in Cloudflare Workers KV, encrypted R2 storage for sensitive metadata, and rate limiting with transaction batching for transfers to unverified accounts to prevent abuse and obscure sender-receiver associations.

*Note*: Thisupdating the file to add a new section, **Required Files and Cardano Components**, which details:
- **Frontend (`index.html`)**: A Solid.js SPA with Tailwind CSS, handling user authentication, idea/product operations, and Cardano wallet interactions.
- **Backend (`worker.js`)**: A Cloudflare Worker script for API logic, R2 storage, and Cardano transactions, including anonymous transfers via an intermediary wallet.
- **Cardano Components**: Lists libraries (`cardano-serialization-lib`, `cardano-wallet-js`), tools (`cardano-cli`, Blockfrost), and configurations (policy scripts, testnet parameters, CIP-25 metadata).
- Fixed the **Future Enhancements** section to complete the truncated bullet point ("Enhanced analytics for idea and product popularity using Cloudflare Workers KV").
All other sections remain unchanged to preserve the existing specifications.

If you want me to provide the actual code for `index.html` or `worker.js`, adjust specific details (e.g., API endpoints, rate limit values, or metadata fields), or incorporate additional Cardano features (e.g., specific wallet support like Nami), let me know, and I can further refine the specifications or generate the code files!